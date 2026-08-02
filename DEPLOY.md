# Backend deploy (VPS)

Push to `main` (or **Actions → Deploy API to VPS → Run workflow**) syncs this repo to the server and rebuilds the Nest API container.

Target paths on the VPS:

- Code: `/opt/agrisense/backend/`
- Compose: `/opt/agrisense/deploy/`
- Secrets stay on the server: `/opt/agrisense/deploy/.env` (never committed)

The workflow does **not** rebuild the Python model on every API push (too heavy). Model deploys stay separate / manual.

## One-time GitHub secrets

Same values as the web repo (`AGRISENSE_WEB`):

| Secret | Value |
|---|---|
| `VPS_HOST` | `102.202.208.198` |
| `VPS_PORT` | `222` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Deploy private key (full PEM / OpenSSH private key) |

Private key file on your machine (if you still have the web deploy key):

```bash
sudo cat /home/nzizaprince/Documents/codes/Agrisense/deploy/secrets/agrisense-web-deploy
```

## After secrets are set

```bash
git push origin main
```

Or run the workflow manually from the Actions tab.

## Verify

- http://102.202.208.198/api/health
- http://102.202.208.198/api/docs
