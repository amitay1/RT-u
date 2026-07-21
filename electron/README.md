# RT-PT Inspector Desktop

Electron shell for the standalone RT-PT Inspector application.

- App ID: `com.amitay.rtptinspector`
- Product name: `RT-PT Inspector`
- Installer: `RTPT-Inspector-Setup-<version>.exe`
- Update repository: `amitay1/RT-u`
- User data: Electron-managed directory belonging only to this app ID

Run locally with `npm run electron:dev`; package Windows builds with `npm run dist:win`.

Production release builds must use an Authenticode signing identity supplied by the controlled release environment. They also require `rtpt-license-public-key.pem` plus the independently controlled `RTPT_LICENSE_PUBLIC_KEY_SHA256` SPKI fingerprint; the release script verifies both before packaging and audits the exact key again inside `app.asar`. Run `npm run release:dry` for a non-mutating preflight and `npm run release` only from a clean tree. The explicitly named `-AllowUnsignedDevelopmentBuild` switch creates a local-only package, warns when licensing is unusable, and disables all commit, tag, push, release, and upload actions. See [RTPT_LICENSE_SECURITY.md](./RTPT_LICENSE_SECURITY.md).

The packaged runtime is audited before publication: `server/`, `shared/`, MRO, legacy licensing, private keys, activation packages, Scan-Master update channels, and CAD/UT-only Node packages are forbidden, while `express`, `electron-updater`, and `electron-log` remain available to the Electron main process.

USB updates use a SHA-256 value embedded in the signed `update-info.json`. The manifest is verified against the pinned `electron/update-public-key.pem`; the corresponding private key stays outside this repository. See [OFFLINE_UPDATE_SECURITY.md](./OFFLINE_UPDATE_SECURITY.md).
