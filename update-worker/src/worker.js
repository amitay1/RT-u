/**
 * ScanMaster auto-update proxy.
 *
 * Lets the installed app (electron-updater, "generic" provider) fetch update
 * artifacts from a PRIVATE GitHub repo without ever seeing the GitHub PAT.
 *
 *   Client                    Worker                    GitHub
 *     |  GET /latest.yml        |                          |
 *     | -----------------------> | Authorization: Bearer X |
 *     |                          | --------------------> |
 *     |                          |    release JSON       |
 *     |                          | <-------------------- |
 *     |                          | GET asset.url (auth)  |
 *     |                          | --------------------> |
 *     |  302 / file body         |    file bytes         |
 *     | <----------------------- | <-------------------- |
 *
 * Env vars required (set via `wrangler secret put`):
 *   GH_TOKEN  – fine-grained PAT with `Contents: read` on the repo
 *
 * Env vars from wrangler.toml [vars]:
 *   GH_OWNER  – e.g. "amitay1"
 *   GH_REPO   – e.g. "Scan-Master-16-12-25"
 */

const ALLOWED = /^(latest\.yml|ScanMaster-Setup-\d+\.\d+\.\d+\.exe(\.blockmap)?)$/;

export default {
  /**
   * @param {Request} request
   * @param {{ GH_TOKEN: string, GH_OWNER: string, GH_REPO: string }} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, "");

    if (!path) {
      return new Response("ScanMaster update proxy is live.\n", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (!ALLOWED.test(path)) {
      return new Response("Not found.", { status: 404 });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed.", { status: 405 });
    }

    if (!env.GH_TOKEN || !env.GH_OWNER || !env.GH_REPO) {
      return new Response("Worker not configured (missing env vars).", {
        status: 500,
      });
    }

    // 1) Resolve "latest" release metadata.
    const apiUrl = `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/releases/latest`;
    const releaseResp = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${env.GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "scan-master-update-worker",
      },
      // Cloudflare Workers cache: 5 min on the metadata so we don't hammer the
      // GitHub API for every client check. electron-updater polls every 10min
      // by default, so this is plenty.
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    if (!releaseResp.ok) {
      const body = await releaseResp.text();
      return new Response(
        `Upstream error from GitHub /releases/latest (${releaseResp.status}): ${body.slice(0, 200)}`,
        { status: 502 }
      );
    }

    const release = await releaseResp.json();
    const asset = (release.assets || []).find((a) => a.name === path);
    if (!asset) {
      return new Response(`Asset "${path}" not found in latest release ${release.tag_name}.`, {
        status: 404,
      });
    }

    // 2) Stream the asset back to the client.
    // GitHub serves asset bytes when called with the API-specific URL plus
    // `Accept: application/octet-stream`. It redirects to a presigned S3
    // URL — we follow that redirect server-side so the client never sees the
    // signed URL or our token.
    const assetResp = await fetch(asset.url, {
      method: request.method, // GET or HEAD pass-through
      headers: {
        Authorization: `Bearer ${env.GH_TOKEN}`,
        Accept: "application/octet-stream",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "scan-master-update-worker",
      },
      redirect: "follow",
    });

    if (!assetResp.ok) {
      return new Response(
        `Asset fetch failed for "${path}" (${assetResp.status}).`,
        { status: 502 }
      );
    }

    const headers = new Headers();
    const passthrough = ["content-type", "content-length", "content-disposition", "etag", "last-modified"];
    for (const h of passthrough) {
      const v = assetResp.headers.get(h);
      if (v) headers.set(h, v);
    }
    // Cache the binary heavily — once a release exists its bytes don't change.
    headers.set("cache-control", "public, max-age=3600, immutable");

    return new Response(assetResp.body, {
      status: 200,
      headers,
    });
  },
};
