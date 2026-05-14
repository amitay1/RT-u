# Scan-Master Download Gate

Cloudflare Worker that puts the Scan-Master installer behind a single global access code.

- Landing page asks for a code
- Worker validates it (constant-time compare) against `ACCESS_CODE` secret
- Worker returns a 5-minute presigned URL to the installer in a private R2 bucket
- Installer is **not** publicly reachable; signed URL expires quickly

## Files

| Path | Purpose |
|---|---|
| `src/worker.ts` | The Worker. Endpoints: `POST /verify`, `GET /version`. |
| `wrangler.toml` | Worker config + R2 binding. |
| `scripts/publish-release.mjs` | Uploads a new `.exe` to R2 and updates `latest.json`. |
| `DEPLOYMENT.md` | Full step-by-step setup (read this). |

## Quick reference

```powershell
# First time
npm install
npx wrangler login
npx wrangler secret put ACCESS_CODE
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put R2_S3_ENDPOINT
npx wrangler deploy

# Upload a build
node scripts/publish-release.mjs <path-to-exe> <version>

# Rotate the code
npx wrangler secret put ACCESS_CODE
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full walkthrough.
