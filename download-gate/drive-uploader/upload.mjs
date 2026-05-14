#!/usr/bin/env node
/**
 * Uploads a local file as the new content of the configured Drive file ID,
 * preserving the file ID and its shareable link. Equivalent to "Manage
 * versions -> Upload new version" in the Drive UI.
 *
 * Usage:
 *   node upload.mjs <local-file-path> [--name NewDisplayName.exe]
 *
 * Exits 0 on success, non-zero on failure.
 */

import { readFile, stat, open } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'config.local.json');
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB chunks for resumable upload

function parseArgs(argv) {
  const args = { filePath: null, name: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name') args.name = argv[++i];
    else if (!args.filePath) args.filePath = a;
  }
  return args;
}

async function loadConfig() {
  try {
    const txt = await readFile(CONFIG_PATH, 'utf-8');
    const cfg = JSON.parse(txt);
    for (const k of ['clientId', 'clientSecret', 'refreshToken', 'fileId']) {
      if (!cfg[k]) throw new Error(`Missing ${k} in ${CONFIG_PATH}`);
    }
    return cfg;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Config not found at ${CONFIG_PATH}. Run auth-setup.mjs first.`);
    }
    throw err;
  }
}

async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  if (!json.access_token) throw new Error('No access_token in refresh response');
  return json.access_token;
}

async function initiateResumableUpload({ fileId, accessToken, name, mimeType, size }) {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=resumable`;
  const metadata = {};
  if (name) metadata.name = name;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(size),
    },
    body: JSON.stringify(metadata),
  });
  if (!res.ok && res.status !== 200) {
    const text = await res.text();
    throw new Error(`Resumable upload init failed: ${res.status} ${text}`);
  }
  const location = res.headers.get('location');
  if (!location) throw new Error('No Location header in resumable init response');
  return location;
}

async function uploadChunks({ uploadUrl, filePath, size }) {
  const fh = await open(filePath, 'r');
  try {
    let offset = 0;
    const startedAt = Date.now();
    let lastPrintAt = 0;
    while (offset < size) {
      const end = Math.min(offset + CHUNK_SIZE, size);
      const buf = Buffer.alloc(end - offset);
      await fh.read(buf, 0, buf.length, offset);

      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(buf.length),
          'Content-Range': `bytes ${offset}-${end - 1}/${size}`,
        },
        body: buf,
      });

      if (res.status === 308) {
        const range = res.headers.get('range');
        if (range) {
          const m = range.match(/bytes=0-(\d+)/);
          if (m) offset = parseInt(m[1], 10) + 1;
          else offset = end;
        } else {
          offset = end;
        }
      } else if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        process.stdout.write(`\nUpload complete in ${elapsed}s. File ID: ${json.id || 'unknown'}\n`);
        return json;
      } else {
        const text = await res.text();
        throw new Error(`Chunk upload failed at offset ${offset}: ${res.status} ${text}`);
      }

      const now = Date.now();
      if (now - lastPrintAt > 1000) {
        const pct = ((offset / size) * 100).toFixed(1);
        const mb = (offset / (1024 * 1024)).toFixed(1);
        const totalMb = (size / (1024 * 1024)).toFixed(1);
        const elapsedSec = (now - startedAt) / 1000;
        const rate = (offset / (1024 * 1024) / Math.max(elapsedSec, 0.001)).toFixed(2);
        process.stdout.write(`\rUploading: ${mb} / ${totalMb} MB (${pct}%) at ${rate} MB/s`);
        lastPrintAt = now;
      }
    }
    throw new Error('Upload loop exited without final response');
  } finally {
    await fh.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.filePath) {
    console.error('Usage: node upload.mjs <local-file-path> [--name DisplayName.exe]');
    process.exit(1);
  }

  const cfg = await loadConfig();
  const fileStat = await stat(args.filePath);
  const sizeMB = (fileStat.size / (1024 * 1024)).toFixed(1);
  const displayName = args.name || basename(args.filePath);
  const mimeType = 'application/octet-stream';

  console.log(`Uploading ${displayName} (${sizeMB} MB) as new version of file ${cfg.fileId}...`);

  const accessToken = await refreshAccessToken(cfg);
  const uploadUrl = await initiateResumableUpload({
    fileId: cfg.fileId,
    accessToken,
    name: displayName,
    mimeType,
    size: fileStat.size,
  });

  const result = await uploadChunks({ uploadUrl, filePath: args.filePath, size: fileStat.size });
  console.log(`Drive file updated. Public download URL unchanged; new content live for the gated landing page.`);
  if (result.id !== cfg.fileId) {
    console.warn(`WARNING: returned file ID (${result.id}) differs from configured (${cfg.fileId}).`);
  }
}

main().catch((err) => {
  console.error('\nUpload failed:', err.message);
  process.exit(1);
});
