# ScanMaster Update Worker

Cloudflare Worker that proxies auto-update artifacts (`latest.yml`, the
installer `.exe`, and its `.blockmap`) from the private GitHub repo to
`electron-updater` clients running inside the installed ScanMaster app.

## Why

After making the main repo private, `electron-updater` can no longer fetch
release artifacts anonymously. The Worker holds a fine-grained GitHub PAT
**server-side** and forwards authenticated requests to GitHub's API, so the
installed `.exe` never carries the token.

## One-time setup (~10 min)

1. **Create a fine-grained GitHub PAT**

   - <https://github.com/settings/personal-access-tokens/new>
   - **Resource owner:** `amitay1`
   - **Repository access:** Only select repositories → `Scan-Master-16-12-25`
   - **Permissions:** Repository permissions → **Contents: Read-only**
   - **Expiration:** 1 year (set a calendar reminder to rotate)
   - Click **Generate** and copy the token (`github_pat_...`).

2. **Authenticate wrangler with Cloudflare**

   ```powershell
   cd update-worker
   npx wrangler login
   ```

   A browser tab opens — click **Allow**.

3. **Store the PAT as a Worker secret**

   ```powershell
   npx wrangler secret put GH_TOKEN
   ```

   Paste the PAT when prompted. It's stored encrypted on Cloudflare and
   never appears in `wrangler.toml` or git.

4. **Deploy**

   ```powershell
   npx wrangler deploy
   ```

   Wrangler prints the deployed URL, e.g.:

   ```
   Published scan-master-updates (1.2s)
     https://scan-master-updates.amitay1.workers.dev
   ```

   Copy that URL — the release pipeline uses it.

5. **Smoke test**

   ```powershell
   curl https://scan-master-updates.amitay1.workers.dev/latest.yml
   ```

   You should see YAML content with the current version. If you get an error,
   run `npx wrangler tail` in another terminal to see live logs.

## What's deployed

| Path                                | Action                              |
| ----------------------------------- | ----------------------------------- |
| `/latest.yml`                       | Latest release manifest (~352 B)    |
| `/ScanMaster-Setup-X.X.X.exe`       | Installer (~280 MB) streamed        |
| `/ScanMaster-Setup-X.X.X.exe.blockmap` | Diff-update blockmap            |
| Anything else                       | 404                                 |

Cache: 5 min on `latest.yml`, 1 h immutable on `.exe` / `.blockmap`.

## Rotating the PAT

When the PAT nears expiry, just generate a new one and re-run:

```powershell
npx wrangler secret put GH_TOKEN
```

No code changes, no redeploy needed beyond that.
