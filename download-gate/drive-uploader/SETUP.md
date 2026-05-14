# Drive Uploader — One-time setup (~15 minutes)

After this is done once, `scripts\release.ps1` will automatically push every new
build into Google Drive as a new version of the same file, keeping the access
code (`SM-2NDE-F3WG`) and the encrypted landing-page blob valid forever.

You will need:

- A Google account (the one that owns the Drive file)
- A web browser
- Node.js installed (you already have it)

---

## Step 1 — Create a Google Cloud project

1. Open https://console.cloud.google.com/
2. At the top of the page, click the **project dropdown** (next to "Google Cloud")
3. Click **New Project**
4. Project name: `scan-master-release` (or anything)
5. Click **Create**, wait ~10 seconds, then switch to that project from the dropdown

---

## Step 2 — Enable the Google Drive API

1. In the same Cloud Console, paste this URL in the address bar:
   ```
   https://console.cloud.google.com/apis/library/drive.googleapis.com
   ```
2. Make sure the project switcher at the top shows your project
3. Click **Enable**, wait until the page reloads

---

## Step 3 — Configure the OAuth consent screen

1. Open https://console.cloud.google.com/apis/credentials/consent
2. **User Type**: **External**, then **Create**
3. Fill in:
   - App name: `Scan-Master Release Uploader`
   - User support email: your Gmail
   - Developer contact: your Gmail
4. Click **Save and Continue**
5. **Scopes** screen: just click **Save and Continue** (no need to add scopes here)
6. **Test users** screen: click **+ Add Users**, enter your own Gmail address, **Add**, then **Save and Continue**
7. Summary screen: click **Back to Dashboard**

> **Why "External" + "Testing" mode?**
> This app is just for you. You don't need to publish it. "Testing" means only listed test users (you) can authorize it — perfect for this case. Refresh tokens last forever as long as you stay in Testing mode and use the app at least once every 7 days. (If you ever stop releasing for >7 days you may need to re-run `auth-setup.mjs`.)

---

## Step 4 — Create OAuth credentials

1. Open https://console.cloud.google.com/apis/credentials
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Desktop app**
4. Name: `Scan-Master Release CLI`
5. Click **Create**
6. A popup shows your **Client ID** and **Client Secret** — keep this tab open, you'll paste them in the next step

---

## Step 5 — Find your Drive file ID

The Drive file you uploaded earlier (the `ScanMaster-Setup-...exe` that the gate serves). Its URL looks like:

```
https://drive.google.com/file/d/1M1n4SE9Zc7z_8O3KkQBxqTN28XBK5Jfs/view?usp=sharing
```

The bold part — `1M1n4SE9Zc7z_8O3KkQBxqTN28XBK5Jfs` — is the file ID. You can paste either the whole URL or just the ID in the next step.

---

## Step 6 — Run the auth setup

Open a PowerShell terminal in the repo root and run:

```powershell
node download-gate\drive-uploader\auth-setup.mjs
```

The script will:

1. Ask for your **Client ID** → paste it
2. Ask for your **Client Secret** → paste it
3. Ask for your **Drive file URL or ID** → paste it
4. Open a browser tab to Google's consent screen → sign in with your Gmail → click **Allow**
5. Show a success page (you can close the tab)
6. Save `config.local.json` in the same folder

`config.local.json` contains your OAuth refresh token and is **already in `.gitignore`** — it will never be committed to GitHub. Treat it like a password.

---

## Step 7 — Test the upload

Pick any small file to test (you can use the same `.exe`):

```powershell
node download-gate\drive-uploader\upload.mjs "C:\path\to\ScanMaster-Setup-1.1.37.exe"
```

You should see:

```
Uploading ScanMaster-Setup-1.1.37.exe (231.0 MB) as new version of file 1M1n4SE9...
Uploading: 124.5 / 231.0 MB (53.9%) at 5.8 MB/s
Upload complete in 41.2s. File ID: 1M1n4SE9...
Drive file updated. Public download URL unchanged; new content live for the gated landing page.
```

After this, visit the landing page in incognito → enter `SM-2NDE-F3WG` → confirm the download works.

---

## Step 8 — You're done

From now on, when you run `.\scripts\release.ps1`, the script will:

1. Build the new `.exe`
2. **Automatically push it to Drive** as a new version of the same file
3. Commit / tag / push the source as usual
4. **Skip** uploading the `.exe` to public GitHub Releases (so the gate stays effective)

Users who type your access code on the landing page always get the latest build. Zero manual steps.

---

## Troubleshooting

### "No refresh_token returned"
Run `auth-setup.mjs` again. If it still fails, visit https://myaccount.google.com/permissions, revoke "Scan-Master Release Uploader", and re-run setup.

### "File not found" / 404 during upload (only happens once)
You authorized with an older, narrower scope. Re-run `auth-setup.mjs` (it now requests the full `drive` scope) and re-run the upload. The consent screen will show "See, edit, create, and delete all of your Google Drive files" — that's the broader access required to update a file you uploaded manually.

### Refresh token stopped working after a while
If your OAuth app is still in **Testing** mode, refresh tokens expire after **7 days of inactivity**. Either release more often, or publish your app (Step 3 → "Publish App") to make tokens permanent. For a hobby/single-user setup, Testing mode is fine — just re-run `auth-setup.mjs` if it expires.

### Upload is very slow
Use a wired connection if possible. The script uses 8 MiB chunks with resumable upload, which handles flaky networks but can't fix slow upstream bandwidth.

### "Token refresh failed: 400 invalid_grant"
The refresh token is no longer valid (revoked, expired, or app moved between testing/production). Re-run `auth-setup.mjs`.
