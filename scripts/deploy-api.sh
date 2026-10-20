#!/usr/bin/env bash
# Run on the VPS after syncing the backend. Roll back the image, never the data.
set -Eeuo pipefail
umask 077

DEPLOY_DIR="${DEPLOY_DIR:-/opt/agrisense/deploy}"
HEALTH_URL="${HEALTH_URL:-https://api.agrisense.rw/api/health}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-40}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-3}"
RELEASE_ID="${1:?Usage: deploy-api.sh RELEASE_ID}"
if [[ ! "$RELEASE_ID" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$ ]]; then
  echo 'Invalid release ID' >&2
  exit 1
fi

cd "$DEPLOY_DIR"
# Use the same lock as other AgriSense deployments, including the old workflow.
exec 9>"${DEPLOY_LOCK:-/tmp/agrisense-compose.lock}"
flock -w 300 9

replacement_started=0
image_saved=0
rollback_image="agrisense-api:rollback"
candidate_image="agrisense-api:release-$RELEASE_ID"
# This is the default image name for the existing agrisense project's api service.
active_image="agrisense-api:latest"

compose() {
  docker compose -f "$DEPLOY_DIR/docker-compose.yml" "$@"
}

wait_for_api() {
  local container health attempt
  for ((attempt=1; attempt<=HEALTH_ATTEMPTS; attempt++)); do
    container="$(compose ps -q api)" || return 1
    if [[ -n "$container" ]]; then
      health="$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null)" || health=missing
      if [[ "$health" == healthy ]]; then
        return 0
      fi
    fi
    sleep "$HEALTH_INTERVAL"
  done
  echo 'API container did not become healthy' >&2
  return 1
}

check_routing() {
  # Nginx can retain the old container address until it is reloaded.
  compose exec -T nginx nginx -t || return 1
  compose exec -T nginx nginx -s reload || return 1
  curl --fail --silent --show-error --connect-timeout 5 --max-time 10 \
    --retry 5 --retry-delay 2 --retry-all-errors --retry-max-time 60 \
    "$HEALTH_URL" || return 1
}

finish() {
  local status=$?
  trap - EXIT HUP INT TERM
  set +e
  if ((status != 0 && image_saved)); then
    # Restore the normal Compose image tag even if replacement never started.
    if docker image tag "$rollback_image" "$active_image"; then
      if ((replacement_started)); then
        echo 'Deployment failed. Restoring the previous API image.' >&2
        if compose up -d --no-deps --no-build --pull never api && wait_for_api && check_routing; then
          echo 'Previous API version restored; this deployment remains failed.' >&2
        else
          echo 'ERROR: rollback did not pass health checks. Manual recovery is required.' >&2
          echo "Saved image: $rollback_image" >&2
        fi
      fi
    else
      echo "ERROR: could not restore $active_image. Manual recovery is required." >&2
    fi
  fi
  exit "$status"
}
trap finish EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# Do not replace an installation that is already broken or has no rollback image.
previous_container="$(compose ps -q api)"
if [[ -z "$previous_container" ]]; then
  echo 'No existing API container; use the initial deployment procedure first.' >&2
  exit 1
fi
if [[ "$(docker inspect --format '{{.State.Health.Status}}' "$previous_container")" != healthy ]]; then
  echo 'Existing API is unhealthy; resolve that before deploying.' >&2
  exit 1
fi
previous_image="$(docker inspect --format '{{.Image}}' "$previous_container")"
docker image tag "$previous_image" "$rollback_image"
image_saved=1

# A failed build or backup leaves the existing container running.
compose build api
docker image tag "$active_image" "$candidate_image"
bash "$DEPLOY_DIR/scripts/backup-host.sh"

replacement_started=1
compose up -d --no-deps --no-build --pull never api
wait_for_api
check_routing
echo "API release $RELEASE_ID is healthy."
