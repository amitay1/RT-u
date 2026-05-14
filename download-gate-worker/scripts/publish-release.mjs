#!/usr/bin/env node
/**
 * Uploads a built .exe installer to the private R2 bucket and writes
 * latest.json so the Worker knows which file is current.
 *
 * Usage:
 *   node scripts/publish-release.mjs path/to/Scan-Master-Setup-1.1.87.exe 1.1.87
 *
 * Requires env (or .env file in cwd):
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_S3_ENDPOINT       e.g. https://<account_id>.r2.cloudflarestorage.com
 *   R2_BUCKET            e.g. scan-master-releases
 */

import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { createHash, createHmac } from 'node:crypto';

const [, , filePath, versionArg] = process.argv;
if (!filePath || !versionArg) {
  console.error('Usage: node publish-release.mjs <path-to-exe> <version>');
  process.exit(1);
}

const need = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_S3_ENDPOINT', 'R2_BUCKET'];
for (const k of need) {
  if (!process.env[k]) {
    console.error(`Missing env: ${k}`);
    process.exit(1);
  }
}

const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT, R2_BUCKET } = process.env;

const filename = basename(filePath);
const key = `releases/${versionArg}/${filename}`;
const fileBuffer = await readFile(filePath);
const fileStat = await stat(filePath);

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function signingKey(secret, date, region, service) {
  const kDate = createHmac('sha256', 'AWS4' + secret).update(date).digest();
  const kRegion = createHmac('sha256', kDate).update(region).digest();
  const kService = createHmac('sha256', kRegion).update(service).digest();
  return createHmac('sha256', kService).update('aws4_request').digest();
}

async function putR2(objectKey, body, contentType) {
  const endpoint = new URL(R2_S3_ENDPOINT);
  const host = endpoint.host;
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);

  const canonicalUri = `/${R2_BUCKET}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
  const headers = {
    host,
    'content-type': contentType,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map(h => `${h}:${headers[h]}\n`).join('');
  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
  const kSigning = signingKey(R2_SECRET_ACCESS_KEY, dateStamp, region, service);
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `${R2_S3_ENDPOINT.replace(/\/$/, '')}${canonicalUri}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, Authorization: authHeader },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${objectKey} failed: ${res.status} ${text}`);
  }
}

console.log(`[1/2] Uploading ${filename} (${(fileStat.size / 1024 / 1024).toFixed(1)} MB)...`);
await putR2(key, fileBuffer, 'application/octet-stream');

const manifest = {
  version: versionArg,
  key,
  filename,
  sizeMB: +(fileStat.size / 1024 / 1024).toFixed(0),
  uploadedAt: new Date().toISOString(),
};
console.log('[2/2] Writing latest.json:', manifest);
await putR2('latest.json', Buffer.from(JSON.stringify(manifest, null, 2)), 'application/json');

console.log('\nDone. Worker will serve this build to anyone with a valid code.');
