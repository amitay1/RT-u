#!/usr/bin/env node

/**
 * RT Inspector — License Studio
 *
 * A tiny local web form for issuing offline RT Inspector licenses without
 * memorising CLI flags. Paste an Installation ID + customer name, pick
 * "perpetual" or an expiry date, and get a copyable activation code.
 *
 * The Ed25519 private key never reaches the browser — signing happens
 * server-side via the existing issueLicense() routine. The server binds to
 * loopback only and rejects non-local Host headers.
 *
 * Usage:
 *   node scripts/rtpt-license-studio.cjs [--private-key <path>] [--port <n>] [--no-open]
 *   (or set RTPT_LICENSE_PRIVATE_KEY_PATH; default is ~/rtpt-signing-keys/rtpt-license-private-key.pem)
 */

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { issueLicense } = require('./issue-rtpt-license.cjs');

const HOST = '127.0.0.1';
const MAX_BODY_BYTES = 64 * 1024;

function parseArgs(argv) {
  const result = { open: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--no-open') { result.open = false; continue; }
    if (arg === '--private-key') { result.privateKey = argv[i + 1]; i += 1; continue; }
    if (arg === '--port') { result.port = Number.parseInt(argv[i + 1], 10); i += 1; continue; }
  }
  return result;
}

function resolvePrivateKeyPath(cliValue) {
  const candidates = [
    cliValue,
    process.env.RTPT_LICENSE_PRIVATE_KEY_PATH,
    path.join(os.homedir(), 'rtpt-signing-keys', 'rtpt-license-private-key.pem'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
}

/**
 * Best-effort confirmation that the private key matches the public key pinned
 * into the app (electron/rtpt-license-public-key.pem). A mismatch means issued
 * tokens would be rejected at activation, so we surface it prominently.
 */
function inspectKey(privateKeyPath) {
  try {
    const key = crypto.createPrivateKey(fs.readFileSync(privateKeyPath));
    if (key.asymmetricKeyType !== 'ed25519') {
      return { ok: false, message: 'The key is not an Ed25519 private key.' };
    }
    const der = crypto.createPublicKey(key).export({ type: 'spki', format: 'der' });
    const fingerprint = crypto.createHash('sha256').update(der).digest('hex');

    let matchesApp = null;
    const pinnedPath = path.join(__dirname, '..', 'electron', 'rtpt-license-public-key.pem');
    if (fs.existsSync(pinnedPath)) {
      try {
        const pinned = crypto.createPublicKey(fs.readFileSync(pinnedPath, 'utf8'));
        const pinnedDer = pinned.export({ type: 'spki', format: 'der' });
        const pinnedFp = crypto.createHash('sha256').update(pinnedDer).digest('hex');
        matchesApp = pinnedFp === fingerprint;
      } catch { matchesApp = null; }
    }
    return { ok: true, fingerprint, matchesApp };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function renderPage(keyStatus, privateKeyPath) {
  const statusJson = JSON.stringify({
    ...keyStatus,
    path: privateKeyPath,
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>RT Inspector — License Studio</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    background: radial-gradient(1200px 600px at 50% -10%, #172029, #0d1117 60%);
    color: #e6edf3; font: 15px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    display: flex; justify-content: center; padding: 32px 16px 64px;
  }
  .wrap { width: 100%; max-width: 640px; }
  .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
  .logo { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center;
    background: linear-gradient(135deg, #2dd4bf, #0891b2); color: #04161a; font-weight: 800; }
  h1 { font-size: 20px; margin: 0; letter-spacing: .2px; }
  .sub { color: #8b98a5; font-size: 13px; margin: 2px 0 20px; }
  .card { background: #131a22; border: 1px solid #232d38; border-radius: 14px; padding: 22px; }
  .keybar { display: flex; align-items: center; gap: 10px; font-size: 12.5px; padding: 10px 12px;
    border-radius: 10px; margin-bottom: 20px; border: 1px solid #232d38; background: #0f161d; }
  .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  .ok { background: #2ea043; } .warn { background: #d29922; } .bad { background: #f85149; }
  .mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
  label { display: block; font-weight: 600; font-size: 13px; margin: 16px 0 6px; }
  input[type=text], input[type=date] {
    width: 100%; padding: 11px 12px; border-radius: 9px; border: 1px solid #2a3644;
    background: #0d141b; color: #e6edf3; font-size: 14px;
  }
  input:focus { outline: none; border-color: #2dd4bf; box-shadow: 0 0 0 3px rgba(45,212,191,.15); }
  .row { display: flex; gap: 12px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
  .opt { display: flex; align-items: center; gap: 7px; font-size: 13.5px; color: #c9d4df; cursor: pointer; }
  button {
    margin-top: 22px; width: 100%; padding: 12px; border: none; border-radius: 10px; cursor: pointer;
    background: linear-gradient(135deg, #2dd4bf, #0891b2); color: #04161a; font-weight: 800; font-size: 15px;
  }
  button:disabled { opacity: .5; cursor: default; }
  button.copy { width: auto; margin: 0; padding: 8px 14px; font-size: 13px; }
  .result { margin-top: 22px; display: none; }
  .result.show { display: block; }
  .code { width: 100%; min-height: 118px; resize: vertical; padding: 12px; border-radius: 10px;
    border: 1px solid #234; background: #08120f; color: #7ee7d0; font-family: ui-monospace, Consolas, monospace;
    font-size: 12px; word-break: break-all; }
  .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .details { margin-top: 14px; display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; font-size: 12.5px; }
  .details .k { color: #8b98a5; } .details .v { color: #e6edf3; word-break: break-all; }
  .err { margin-top: 20px; display: none; padding: 12px 14px; border-radius: 10px; font-size: 13.5px;
    background: rgba(248,81,73,.12); border: 1px solid rgba(248,81,73,.4); color: #ffb0ab; }
  .err.show { display: block; }
  .badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(46,160,67,.15);
    border: 1px solid rgba(46,160,67,.4); color: #7ee787; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <div class="logo">RT</div>
      <div>
        <h1>License Studio</h1>
        <div class="sub">Offline activation-code issuer · RT Inspector</div>
      </div>
    </div>

    <div class="card">
      <div class="keybar" id="keybar">
        <span class="dot warn"></span><span id="keytext">Checking signing key…</span>
      </div>

      <label for="installationId">Installation ID (from the customer's activation screen)</label>
      <input id="installationId" type="text" class="mono" autocomplete="off"
             placeholder="00000000-0000-4000-8000-000000000000" />

      <label for="customer">Customer / organization name</label>
      <input id="customer" type="text" autocomplete="off" placeholder="e.g. Acme Aerospace NDT" />

      <label>License validity</label>
      <div class="row">
        <label class="opt"><input type="radio" name="validity" value="perpetual" checked /> Perpetual (no expiry)</label>
        <label class="opt"><input type="radio" name="validity" value="expires" /> Expires on</label>
        <input id="expires" type="date" style="width:auto" disabled />
      </div>

      <button id="go">Generate activation code</button>

      <div class="err" id="err"></div>

      <div class="result" id="result">
        <div class="head">
          <span class="badge">✓ Activation code ready</span>
          <button class="copy" id="copy">Copy</button>
        </div>
        <textarea class="code" id="code" readonly></textarea>
        <div class="details" id="details"></div>
      </div>
    </div>
  </div>

<script>
  const KEY = ${statusJson};
  (function () {
    const bar = document.getElementById('keybar');
    const dot = bar.querySelector('.dot');
    const txt = document.getElementById('keytext');
    if (!KEY.ok) {
      dot.className = 'dot bad';
      txt.innerHTML = 'Signing key problem: ' + (KEY.message || 'unavailable') + ' — issued codes will not activate.';
      document.getElementById('go').disabled = true;
    } else if (KEY.matchesApp === false) {
      dot.className = 'dot bad';
      txt.innerHTML = 'This key does NOT match the app\\'s pinned key — codes will be rejected at activation.';
      document.getElementById('go').disabled = true;
    } else {
      dot.className = 'dot ok';
      const suffix = KEY.matchesApp === true ? ' · matches app' : '';
      txt.innerHTML = 'Signing key loaded <span class="mono">' + (KEY.fingerprint || '').slice(0, 16) + '…</span>' + suffix;
    }
  })();

  const expiresInput = document.getElementById('expires');
  document.querySelectorAll('input[name=validity]').forEach(function (r) {
    r.addEventListener('change', function () {
      expiresInput.disabled = document.querySelector('input[name=validity]:checked').value !== 'expires';
    });
  });

  const err = document.getElementById('err');
  const result = document.getElementById('result');

  function showError(m) { err.textContent = m; err.classList.add('show'); result.classList.remove('show'); }

  document.getElementById('go').addEventListener('click', async function () {
    err.classList.remove('show'); result.classList.remove('show');
    const validity = document.querySelector('input[name=validity]:checked').value;
    const body = {
      installationId: document.getElementById('installationId').value.trim(),
      customer: document.getElementById('customer').value.trim(),
      perpetual: validity === 'perpetual',
      expires: validity === 'expires' ? expiresInput.value : undefined,
    };
    if (!body.installationId) return showError('Paste the Installation ID from the activation screen.');
    if (!body.customer) return showError('Enter a customer name.');
    if (validity === 'expires' && !body.expires) return showError('Choose an expiry date.');

    const btn = document.getElementById('go');
    btn.disabled = true; btn.textContent = 'Generating…';
    try {
      const res = await fetch('/issue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.ok) { showError(data.error || 'Could not issue the license.'); return; }
      document.getElementById('code').value = data.token;
      const p = data.payload;
      document.getElementById('details').innerHTML =
        '<div class="k">License ID</div><div class="v mono">' + p.licenseId + '</div>' +
        '<div class="k">Customer</div><div class="v">' + p.customer + '</div>' +
        '<div class="k">Installation</div><div class="v mono">' + p.installationId + '</div>' +
        '<div class="k">Expiry</div><div class="v">' + (p.expiresAt ? p.expiresAt.slice(0, 10) : 'Perpetual') + '</div>';
      result.classList.add('show');
    } catch (e) {
      showError('Request failed: ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Generate activation code';
    }
  });

  document.getElementById('copy').addEventListener('click', async function () {
    const code = document.getElementById('code');
    code.select();
    try { await navigator.clipboard.writeText(code.value); } catch { document.execCommand('copy'); }
    const b = document.getElementById('copy'); const t = b.textContent; b.textContent = 'Copied!';
    setTimeout(function () { b.textContent = t; }, 1200);
  });
</script>
</body>
</html>`;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { reject(new Error('Request body too large.')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('Invalid request body.')); }
    });
    req.on('error', reject);
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const privateKeyPath = resolvePrivateKeyPath(args.privateKey);

  if (!privateKeyPath) {
    console.error('No Ed25519 private key found. Pass --private-key <path> or set RTPT_LICENSE_PRIVATE_KEY_PATH.');
    process.exitCode = 1;
    return;
  }
  const keyStatus = inspectKey(privateKeyPath);

  const server = http.createServer(async (req, res) => {
    // Loopback-only: reject any non-local Host header.
    const host = String(req.headers.host || '');
    const port = server.address() && server.address().port;
    const allowedHosts = new Set([`${HOST}:${port}`, `localhost:${port}`]);
    if (!allowedHosts.has(host)) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(renderPage(keyStatus, privateKeyPath));
      return;
    }

    if (req.method === 'POST' && req.url === '/issue') {
      try {
        const body = await readJsonBody(req);
        const result = issueLicense({
          'private-key': privateKeyPath,
          'installation-id': String(body.installationId || ''),
          customer: String(body.customer || ''),
          perpetual: body.perpetual === true || undefined,
          expires: body.perpetual === true ? undefined : String(body.expires || ''),
        });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, token: result.token, payload: result.payload }));
      } catch (error) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
      }
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  });

  server.listen(Number.isInteger(args.port) ? args.port : 0, HOST, () => {
    const { port } = server.address();
    const url = `http://${HOST}:${port}/`;
    console.log('RT Inspector — License Studio');
    console.log(`  Signing key : ${privateKeyPath}`);
    if (keyStatus.ok && keyStatus.matchesApp === false) {
      console.log('  WARNING     : key does NOT match the app\'s pinned public key.');
    }
    console.log(`  Open        : ${url}`);
    console.log('  Press Ctrl+C to stop.');
    if (args.open) openBrowser(url);
  });
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    /* the URL is printed above; the user can open it manually */
  }
}

if (require.main === module) {
  main();
}

module.exports = { renderPage, resolvePrivateKeyPath, inspectKey };
