/**
 * Scan-Master Download Gate Worker
 *
 * Validates an access code and returns a short-lived presigned URL to the
 * Scan-Master installer stored in a private R2 bucket.
 *
 * Endpoints:
 *   POST /verify   { code: string }       -> { ok, url, version, sizeMB, expiresIn }
 *   GET  /version                          -> { version }   (public, no auth)
 *   OPTIONS *                              -> CORS preflight
 */

import { AwsClient } from 'aws4fetch';

export interface Env {
  /** The single global access code. Rotate by `wrangler secret put ACCESS_CODE`. */
  ACCESS_CODE: string;
  /** R2 bucket binding (also accessed via S3 API for presign). */
  RELEASES: R2Bucket;
  /** R2 S3-compatible credentials (created in Cloudflare dashboard). */
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  /** e.g. "https://<account_id>.r2.cloudflarestorage.com" */
  R2_S3_ENDPOINT: string;
  /** Bucket name (e.g. "scan-master-releases"). */
  R2_BUCKET: string;
  /** Comma-separated list of allowed Origin headers. */
  ALLOWED_ORIGINS: string;
}

const LATEST_KEY = 'latest.json';
const PRESIGN_TTL_SECONDS = 300;

function corsHeaders(env: Env, requestOrigin: string | null): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = requestOrigin && allowed.includes(requestOrigin) ? requestOrigin : allowed[0] || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(body: unknown, init: ResponseInit, env: Env, requestOrigin: string | null): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(env, requestOrigin),
      ...(init.headers || {}),
    },
  });
}

/** Constant-time string compare to avoid timing side-channels on the access code. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

interface LatestManifest {
  version: string;
  key: string;
  sizeMB?: number;
}

async function readLatest(env: Env): Promise<LatestManifest | null> {
  const obj = await env.RELEASES.get(LATEST_KEY);
  if (!obj) return null;
  try {
    const txt = await obj.text();
    const parsed = JSON.parse(txt) as LatestManifest;
    if (!parsed.version || !parsed.key) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function presignDownload(env: Env, key: string): Promise<string> {
  const aws = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });
  const url = new URL(`${env.R2_S3_ENDPOINT.replace(/\/$/, '')}/${env.R2_BUCKET}/${encodeURI(key)}`);
  url.searchParams.set('X-Amz-Expires', String(PRESIGN_TTL_SECONDS));
  const signed = await aws.sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } });
  return signed.url;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env, origin) });
    }

    if (request.method === 'GET' && url.pathname === '/version') {
      const latest = await readLatest(env);
      if (!latest) return json({ version: null }, { status: 200 }, env, origin);
      return json({ version: latest.version }, { status: 200 }, env, origin);
    }

    if (request.method === 'POST' && url.pathname === '/verify') {
      let body: { code?: unknown } = {};
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: 'invalid_json' }, { status: 400 }, env, origin);
      }
      const submitted = typeof body.code === 'string' ? body.code.trim() : '';
      if (!submitted) return json({ ok: false, error: 'missing_code' }, { status: 400 }, env, origin);

      const expected = (env.ACCESS_CODE || '').trim();
      if (!expected || !timingSafeEqual(submitted, expected)) {
        return json({ ok: false, error: 'invalid_code' }, { status: 401 }, env, origin);
      }

      const latest = await readLatest(env);
      if (!latest) return json({ ok: false, error: 'no_release_available' }, { status: 503 }, env, origin);

      const signedUrl = await presignDownload(env, latest.key);
      return json(
        {
          ok: true,
          url: signedUrl,
          version: latest.version,
          sizeMB: latest.sizeMB ?? null,
          expiresIn: PRESIGN_TTL_SECONDS,
        },
        { status: 200 },
        env,
        origin,
      );
    }

    return json({ ok: false, error: 'not_found' }, { status: 404 }, env, origin);
  },
};
