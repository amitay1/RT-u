# Scan-Master Download Gate

Locks the Scan-Master installer behind a single access code. The .exe lives in
Google Drive at a fixed file ID; that URL is AES-GCM encrypted using the access
code as the key and embedded in the landing page. Without the code, the URL
cannot be recovered from the page source.

## Two pieces

### 1. The gate itself (`encrypt-url-tool.html`)
Standalone tool — open in browser, paste a URL + a code, get an encrypted blob
to paste into the landing page's `index.html` as `ENCRYPTED_DOWNLOAD`. Use this
if you ever want to rotate the access code or move the file to a new URL.

### 2. The release automation (`drive-uploader/`)
After a one-time OAuth setup (see [`drive-uploader/SETUP.md`](drive-uploader/SETUP.md)),
`scripts\release.ps1` will automatically push every new build into Drive as a
new version of the file behind the gate. No manual "Manage versions" click
needed. The access code never changes.

## Files

| File | What it does |
|---|---|
| `encrypt-url-tool.html` | One-off tool for generating the encrypted blob (only needed when rotating the code or moving the file). |
| `drive-uploader/auth-setup.mjs` | One-time OAuth setup that captures a refresh token. |
| `drive-uploader/upload.mjs` | Called by `release.ps1` to push a new `.exe` to Drive. |
| `drive-uploader/SETUP.md` | ~15-minute setup walkthrough. |
| `drive-uploader/config.local.json` | (auto-generated, git-ignored) Holds OAuth refresh token and the Drive file ID. |
| (in the landing page) `index.html` -> `ENCRYPTED_DOWNLOAD` | Where the encrypted blob lives. Stays in the public source — but is useless without the code. |

## How it works (one sentence)

The download URL is AES-GCM encrypted using your access code as the key, so it
only exists as plaintext for ~1 second in the user's browser after they type
the correct code — and never anywhere else on the internet.

## First-time setup (~5 minutes)

1. **Upload the installer to Google Drive.**
   - Drag `Scan-Master-Setup-1.1.86.exe` into your Drive.
   - Right-click the file → **Share** → **Change to anyone with the link** → set role to **Viewer** → **Done**.
   - Click **Copy link**. You get something like:
     ```
     https://drive.google.com/file/d/1aBcDeFgHiJk-LmNoPqRsT/view?usp=sharing
     ```

2. **Convert to a direct-download URL.**
   Replace `/view?usp=sharing` with `/uc?export=download`:
   ```
   https://drive.google.com/uc?export=download&id=1aBcDeFgHiJk-LmNoPqRsT
   ```
   (Test it: pasting that URL into a fresh browser tab should start the download.)

3. **Encrypt the URL.**
   - Open `download-gate/encrypt-url-tool.html` in your browser (just double-click the file).
   - Paste the direct-download URL.
   - Paste your access code (e.g. `SM-2NDE-F3WG`).
   - Click **Generate encrypted blob** → **Copy to clipboard**.

4. **Paste the blob into the landing page.**
   - On the `gh-pages` branch, edit `index.html`.
   - Find the line:
     ```js
     const ENCRYPTED_DOWNLOAD = 'REPLACE_WITH_ENCRYPTED_BLOB_FROM_TOOL';
     ```
   - Replace `REPLACE_WITH_ENCRYPTED_BLOB_FROM_TOOL` with the blob from step 3.
   - Commit and push:
     ```powershell
     git add index.html
     git commit -m "Set encrypted download URL"
     git push origin gh-pages
     ```

5. **CRITICAL: Remove the public `.exe` from existing GitHub Releases.**
   Otherwise people will just download it from `github.com/amitay1/Scan-Master-16-12-25/releases` and the gate is meaningless.
   - Go to https://github.com/amitay1/Scan-Master-16-12-25/releases
   - For each release: **Edit** → trash-icon every `.exe` and `.blockmap` asset → **Update release**.

6. **Test.**
   - Visit https://amitay1.github.io/Scan-Master-16-12-25/
   - Click **Download for Windows** → enter wrong code → "Invalid code"
   - Enter `SM-2NDE-F3WG` → download starts from Drive

## Day-to-day

### Rotate the access code

1. Re-open `encrypt-url-tool.html`.
2. Enter the **same** Drive URL with the **new** access code.
3. Click **Generate**, copy the blob.
4. Replace `ENCRYPTED_DOWNLOAD` in `index.html` again, commit, push.

The old code stops working the moment the new blob is pushed.

### Publish a new build

1. Upload the new `.exe` to Drive (replace or new file).
2. If you replaced the file in-place at the same URL, you're done.
3. If you uploaded a new file (new URL), re-encrypt with the new URL and repeat the paste-and-push.

## Security profile

### What this DOES protect against
- Anyone who lands on the page without a code (the dominant case)
- Search engines indexing the installer
- Tech-curious users opening DevTools — the URL is encrypted, not just hidden
- Sharing the landing page URL with non-customers

### What this does NOT protect against
- A customer leaking their code to someone else (rotate the code if you suspect leakage)
- A customer leaking the actual `.exe` file after they download it
- Anyone who finds the Drive share link through other means (don't share that link publicly)

This is the right level of protection for a private-beta-style distribution.
If your needs grow (per-customer codes, license tracking, audit logs), say the
word and we can upgrade to a server-side gate (Cloudflare Worker).
