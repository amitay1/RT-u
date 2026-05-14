# Scan-Master Download Gate – Deployment Guide

This guide takes you from zero to a working access-code gate in roughly **45 minutes**.
After setup, only people you give the code to can download Scan-Master.

---

## Architecture

```
                ┌────────────────────────────┐
                │  Landing page (gh-pages)   │
                │  amitay1.github.io/...     │
                └─────────────┬──────────────┘
                              │ 1. POST /verify { code }
                              ▼
                ┌────────────────────────────┐
                │  Cloudflare Worker         │  validates code (constant-time)
                │  scan-master-download-gate │  reads latest.json from R2
                └─────────────┬──────────────┘  signs a 5-minute URL
                              │ 2. signed URL
                              ▼
                ┌────────────────────────────┐
                │  Cloudflare R2 (private)   │  bucket: scan-master-releases
                │  releases/<ver>/...exe     │  + latest.json manifest
                └────────────────────────────┘
```

The installer never sits at a guessable public URL. Each successful download
request gets a fresh signed URL that expires in 5 minutes.

---

## Step 1 — Create a Cloudflare account

1. Sign up at https://dash.cloudflare.com/sign-up (free).
2. Verify your email.

You can use Cloudflare without putting the Scan-Master domain on Cloudflare DNS.
The Worker will run on a `*.workers.dev` URL.

---

## Step 2 — Create an R2 bucket

R2 is Cloudflare's S3-compatible object storage. Free tier: 10 GB storage,
10 M reads/month, no egress fees.

1. In the Cloudflare dashboard sidebar, open **R2 Object Storage**.
2. The first time you open R2 you'll be asked to add a payment method
   (free-tier still requires this for verification). Add it.
3. Click **Create bucket**.
   - Name: `scan-master-releases`
   - Location: choose **Automatic** (or the region closest to your users)
   - Click **Create bucket**.

---

## Step 3 — Create R2 S3-API credentials

The Worker uses S3-compatible API calls to sign download URLs.

1. In R2, click **Manage R2 API Tokens** → **Create API token**.
2. Permissions: **Object Read & Write**
3. Specify bucket: `scan-master-releases` (more secure than "Apply to all buckets")
4. TTL: forever (or whatever you prefer)
5. Click **Create API Token**.
6. **Copy and save these three values** (they are shown only once):
   - **Access Key ID**
   - **Secret Access Key**
   - **Endpoint** – looks like `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

---

## Step 4 — Install Wrangler and deploy the Worker

From a PowerShell window:

```powershell
cd download-gate-worker
npm install
npx wrangler login    # opens browser, sign in to Cloudflare
```

Set your secrets (replace placeholder values):

```powershell
# The download access code your users will type in
npx wrangler secret put ACCESS_CODE
# Wrangler will prompt for the value -> paste your chosen code, press Enter

npx wrangler secret put R2_ACCESS_KEY_ID
# paste the Access Key ID from step 3

npx wrangler secret put R2_SECRET_ACCESS_KEY
# paste the Secret Access Key from step 3

npx wrangler secret put R2_S3_ENDPOINT
# paste the endpoint URL from step 3 (no trailing slash)
```

Deploy:

```powershell
npx wrangler deploy
```

Wrangler prints the deployed URL, e.g.:

```
https://scan-master-download-gate.<your-subdomain>.workers.dev
```

**Copy this URL** — you need it in Step 6.

---

## Step 5 — Upload your first installer to R2

From the project root (where the .exe lives):

```powershell
cd download-gate-worker

# Set env vars for the upload script (PowerShell):
$env:R2_ACCESS_KEY_ID     = "..."        # same as wrangler secret
$env:R2_SECRET_ACCESS_KEY = "..."
$env:R2_S3_ENDPOINT       = "https://<account>.r2.cloudflarestorage.com"
$env:R2_BUCKET            = "scan-master-releases"

# Upload + write latest.json manifest:
node scripts/publish-release.mjs "..\release-build-20260513-213042\Scan-Master-Setup-1.1.86.exe" "1.1.86"
```

The script does two things:
1. Uploads the `.exe` to `releases/1.1.86/Scan-Master-Setup-1.1.86.exe`
2. Writes `latest.json` so the Worker knows what to serve

You can re-run this script with a newer build to update the "latest" pointer
without touching the Worker.

---

## Step 6 — Wire up the landing page

Open `gh-pages-worktree/index.html` and find this line near the bottom of the script section:

```js
const DOWNLOAD_GATE_URL = 'https://scan-master-download-gate.YOUR-SUBDOMAIN.workers.dev';
```

Replace it with the Worker URL from Step 4. Commit and push the `gh-pages` branch:

```powershell
cd ..\gh-pages-worktree
git add index.html
git commit -m "Wire download button to Cloudflare access-code gate"
git push origin gh-pages
```

GitHub Pages will rebuild within ~30 seconds.

---

## Step 7 — Critical clean-up: remove existing public downloads

Until you do this, anyone can still grab the old installers from your public GitHub Releases page!

Two options:

**Option A – Delete the .exe assets from each public release (recommended):**
1. Go to https://github.com/amitay1/Scan-Master-16-12-25/releases
2. For each release, click **Edit**, scroll to assets, click the trash icon next to each `.exe` and `.blockmap` file, **Save**.
3. The release tags themselves can stay (they don't expose the installer).

**Option B – Make the whole repo private** (also hides your source code):
1. Repo → Settings → **Danger Zone** → **Change repository visibility** → Private.
2. Note: GitHub Pages still works on public custom-domain or `.github.io` sites
   when the repo is private only on **paid** GitHub plans. On a free plan, making
   the repo private will turn off your landing page. Stick with Option A on a free plan.

---

## Step 8 — Test it

1. Visit https://amitay1.github.io/Scan-Master-16-12-25/
2. Click **Download for Windows** → modal opens
3. Enter a wrong code → "Invalid code"
4. Enter the real code → download begins
5. Open DevTools → Network → confirm the download URL is an R2 signed URL with `X-Amz-Signature=...` — that URL expires in 5 minutes

---

## Day-to-day operations

### Rotate the access code

```powershell
cd download-gate-worker
npx wrangler secret put ACCESS_CODE
# enter new code
```

Takes effect within seconds — no redeploy needed.

### Publish a new build

```powershell
cd download-gate-worker
node scripts/publish-release.mjs "<path to new .exe>" "1.1.87"
```

The Worker immediately starts serving the new build.

### Inspect Worker logs (debugging)

```powershell
npx wrangler tail
```

### Restrict by domain (already configured)

`wrangler.toml` sets `ALLOWED_ORIGINS = "https://amitay1.github.io"`.
Only requests from that origin pass CORS. If you add a custom domain later,
update this and redeploy.

---

## Cost expectation

Cloudflare free tier:

| Resource | Free limit | Your expected use |
|---|---|---|
| Worker requests | 100,000 / day | A few hundred / month |
| R2 storage | 10 GB | One ~200 MB installer |
| R2 Class A ops | 1M / month | ~1 per release |
| R2 Class B ops | 10M / month | ~1 per download |
| R2 egress | unlimited & free | unlimited & free |

Realistically: **$0 / month** until you grow significantly.

---

## What this DOES protect against

- ✅ Casual users finding the download
- ✅ Search engines / scrapers indexing it
- ✅ Sharing the GitHub Pages URL with unauthorized people
- ✅ Replay attacks (signed URLs expire in 5 min)

## What this does NOT protect against

- ❌ A holder of the code sharing it with others (rotate the code if you suspect leakage)
- ❌ A user re-distributing the .exe after downloading it (use license/signing in the app itself for that)

For per-user codes or one-time-use codes, upgrade to Cloudflare KV — happy to wire that next if you need it.
