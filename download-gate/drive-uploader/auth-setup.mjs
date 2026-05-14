#!/usr/bin/env node
/**
 * One-time OAuth setup for Drive uploader.
 *
 * Prompts the user for:
 *   1. The OAuth client_id and client_secret from Google Cloud Console
 *   2. The file ID of the Drive file we'll be updating
 *
 * Opens a browser to Google's consent screen, captures the redirect on
 * localhost, exchanges the code for a refresh_token, and writes
 * config.local.json. After this runs once, `upload.mjs` can update the
 * Drive file headlessly until the refresh token is revoked.
 *
 * Usage: node auth-setup.mjs
 */

import { createInterface } from 'node:readline/promises';
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { exec } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'config.local.json');
const REDIRECT_PORT = 7459;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth-callback`;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

const rl = createInterface({ input: process.stdin, output: process.stdout });

function openBrowser(url) {
  const cmd = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
    ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd);
}

function captureCallback() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      if (url.pathname !== '/oauth-callback') {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get('code');
      const err = url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (err) {
        res.end(`<h1>OAuth error: ${err}</h1><p>You can close this tab and try again.</p>`);
        server.close();
        reject(new Error(`OAuth error: ${err}`));
        return;
      }
      if (!code) {
        res.end('<h1>No code received</h1>');
        server.close();
        reject(new Error('No authorization code in callback'));
        return;
      }
      res.end('<h1>Success!</h1><p>You can close this tab and return to the terminal.</p>');
      server.close();
      resolve(code);
    });
    server.listen(REDIRECT_PORT, '127.0.0.1');
    setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for OAuth callback (5 minutes)'));
    }, 5 * 60 * 1000);
  });
}

async function exchangeCodeForTokens({ code, clientId, clientSecret }) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

function extractFileId(input) {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fromUrl) return fromUrl[1];
  const fromIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fromIdParam) return fromIdParam[1];
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  throw new Error(`Could not extract a Drive file ID from: ${trimmed}`);
}

async function main() {
  console.log('\n=== Scan-Master Drive Uploader: First-time Setup ===\n');
  console.log('Before continuing, finish the Google Cloud Console setup described in SETUP.md.');
  console.log('You should have a Client ID and Client Secret ready.\n');

  const clientId = (await rl.question('OAuth Client ID: ')).trim();
  const clientSecret = (await rl.question('OAuth Client Secret: ')).trim();
  const fileInput = (await rl.question('\nDrive file URL or ID (the file users download via the access code):\n> ')).trim();
  const fileId = extractFileId(fileInput);

  if (!clientId || !clientSecret || !fileId) {
    console.error('Missing required input. Aborting.');
    process.exit(1);
  }

  console.log(`\nExtracted file ID: ${fileId}`);
  console.log('\nOpening browser for Google sign-in...');
  console.log('(If the browser does not open automatically, copy the URL printed below.)\n');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log(authUrl.toString());
  console.log('');
  openBrowser(authUrl.toString());

  console.log(`Waiting for redirect to ${REDIRECT_URI} ...`);
  const code = await captureCallback();
  console.log('Authorization code received. Exchanging for tokens...');

  const tokens = await exchangeCodeForTokens({ code, clientId, clientSecret });
  if (!tokens.refresh_token) {
    throw new Error(
      'No refresh_token returned. Revoke previous access at https://myaccount.google.com/permissions and run setup again.',
    );
  }

  const config = {
    clientId,
    clientSecret,
    refreshToken: tokens.refresh_token,
    fileId,
    createdAt: new Date().toISOString(),
  };
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`\nSaved to ${CONFIG_PATH}`);
  console.log('This file contains secrets — it is git-ignored and must NOT be committed.\n');
  console.log('Setup complete. From now on, release.ps1 will update Drive automatically.');
  rl.close();
}

main().catch((err) => {
  console.error('\nSetup failed:', err.message);
  rl.close();
  process.exit(1);
});
