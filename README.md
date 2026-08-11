# RT-PT Inspector

Standalone desktop application, with a same-origin local browser/PWA mode, for creating radiographic and liquid-penetrant NDT technique sheets.

The signed Electron desktop package is the supported production enforcement boundary: licensing, protected storage, downloads, and controlled exports are rechecked by the main process. Local browser/PWA mode requires the licensed loopback service and freshly revalidates before save/export actions, but client-executed browser code is not a tamper-resistant DRM boundary against a workstation owner who can modify the bundle or runtime. Use the signed desktop package wherever adversarial local enforcement is required.

## Inspection workspaces

- RT Film — reference suggestions for practices such as ASTM E1742
- RT Digital — reference suggestions for practices such as ASTM E2698
- Liquid Penetrant Testing — reference suggestions for practices such as ASTM E1417

These suggestions are not an automatic claim of compliance. The controlled reference, applicable revision, and customer/procedure requirements must be entered, reviewed, and approved for each document.

RT-PT Inspector is a standalone product. It has its own application identity, data namespace, repository, installers, releases, and update channel.

## Development

```powershell
npm install
npm run dev
```

Quality checks:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

The active production renderer is generated only under `rtpt-dist/`. The legacy `dist/` directory is not served or packaged by RT-PT Inspector.

## Desktop builds

```powershell
npm run electron:dev
npm run dist:win
```

Windows artifacts are named `RTPT-Inspector-Setup-<version>.exe` and are installed under the independent Electron application ID `com.amitay.rtptinspector`.

## Independent updates

Production builds check only the RT-PT Inspector release channel:

`https://github.com/amitay1/RT-u/releases`

Production Windows releases require an Authenticode signing configuration supplied by the controlled release environment (for example, electron-builder `CSC_LINK` credentials or a configured certificate-store/cloud signing provider). The independently approved signer certificate thumbprint must be supplied as `RTPT_WINDOWS_SIGNER_SHA1`; release verification rejects another signer or a signature without a trusted timestamp. No certificate or private key is stored in this repository.

Production releases also require two independently controlled trust anchors: the Ed25519 license-verification public key at `electron/rtpt-license-public-key.pem` with `RTPT_LICENSE_PUBLIC_KEY_SHA256`, and the offline-update public key at `electron/update-public-key.pem` with `RTPT_UPDATE_PUBLIC_KEY_SHA256`. Run `npm run license:key:verify` and `npm run update:key:verify` to validate them before packaging. Both private keys and customer activation packages must remain outside the repository and every installer; see [electron/RTPT_LICENSE_SECURITY.md](electron/RTPT_LICENSE_SECURITY.md) and [electron/OFFLINE_UPDATE_SECURITY.md](electron/OFFLINE_UPDATE_SECURITY.md).

Run the read-only preflight, then create a release from a clean working tree:

```powershell
npm run release:dry
npm run release
```

`release:dry` does not change `package.json`, `package-lock.json`, Git state, build directories, or GitHub. The production command validates the project and packaged contents, verifies the final Authenticode signature, stages only the two version files, and publishes RT-PT artifacts to `amitay1/RT-u` without overwriting existing assets. It does not access or publish any other product's releases.

For an unsigned local development package that can never commit, tag, push, or publish:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\release.ps1 -AllowUnsignedDevelopmentBuild
```

This explicit development mode may proceed without the controlled license or update trust anchors, but reports that licensing and USB updates are unusable. The resulting application remains activation-blocked and cannot install offline updates.

Signed USB update folders are built separately beneath `release-workspace/offline`. The offline builder requires the final Authenticode-signed installer, the pinned public key at `electron/update-public-key.pem`, and the matching private manifest-signing key supplied from outside the repository. It hashes the final installer and signs the exact `update-info.json` bytes.

## Data isolation

Browser data uses only the `rtpt_inspector_*` namespace, and Electron data is isolated by the application ID. There is no automatic legacy-data migration. V1 or V2 RT/PT documents can be imported explicitly and migrated to the V3 controlled model; only V3 documents are written. No data from any other product is ever copied into this product.
