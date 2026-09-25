# Backend deploy (VPS)

A push to `main` runs the build and Jest tests, then syncs this repo to
`/opt/agrisense/backend/`, rebuilds only the Compose `api` service, and checks
`https://api.agrisense.rw/api/health`. The workflow also supports manual runs.
The frontend remains on Vercel; the model has its own deployment workflow.

## One-time GitHub Actions setup

Set these secrets in the **backend** repository:

| Secret | Value |
| --- | --- |
| `VPS_HOST` | `92.4.152.193` |
| `VPS_PORT` | `22` (optional; the workflow defaults to 22) |
| `VPS_USER` | `ubuntu` |
| `VPS_SSH_KEY` | Private key authorized for `ubuntu`; preferably a dedicated deploy key |
| `VPS_KNOWN_HOSTS` | Verified SSH host-key line for `92.4.152.193` |

Obtain the server's public host key through the existing trusted
`ssh agrisense-oracle` connection, verify its fingerprint, and store a
`92.4.152.193 ssh-ed25519 <public-key>` line as `VPS_KNOWN_HOSTS`. Do not
generate this value with an unauthenticated `ssh-keyscan` in the workflow.
The ED25519 host-key fingerprint observed through the existing SSH alias is
`SHA256:Hmha/BVjMlbtOFQyjWnIe5lbiRoM4ZlWIbcd4AGwPGE`.
The deploy key must be authorized for the `ubuntu` account and that account
must be able to run Docker Compose. Never commit the private key or VPS `.env`.

## Before the first push

- Confirm the live Compose file remains at `/opt/agrisense/deploy/docker-compose.yml`.
  This workflow does not sync or replace it.
- Do not run the older `expired_deploy/scripts/sync-to-vps.sh`; its deploy
  config is stale and can overwrite the working VPS setup.
- Check schema changes separately. This workflow does not run database
  migrations automatically.

The backend and model workflows use the same VPS `flock` lock while rebuilding,
so their Docker builds do not run at the same time. A failed health check marks
the Actions run failed; it does not automatically roll back the deployment.
