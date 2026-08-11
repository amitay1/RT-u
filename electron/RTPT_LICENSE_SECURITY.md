# RT-PT Inspector offline licensing

RT-PT Inspector uses a product-specific offline license. It does not require a
user account, email address, password, Supabase session, or network connection.

## Trust boundary

- The desktop app verifies an Ed25519 signature with
  `electron/rtpt-license-public-key.pem`.
- The corresponding private key must be created and retained in controlled
  signing infrastructure outside this repository and outside every release.
- The offline-update key is a separate trust domain and must not be reused for
  license issuance.
- A missing public key, unavailable secure storage, invalid signature, wrong
  product/application identity, installation mismatch, expiry, or detected
  clock rollback blocks access.

### Runtime enforcement boundaries

- The signed Electron desktop package is the production enforcement boundary.
  License status is rechecked in the main process for protected APIs, downloads,
  and export paths; renderer save/export actions also request a fresh status.
- Local browser/PWA mode requires the same-origin loopback license service and
  server APIs fail closed. Because authoring, local browser storage, and PDF
  composition execute in client JavaScript, that mode is operational access
  control for a trusted workstation, not tamper-resistant DRM against a local
  operator who can modify the bundle or browser runtime.
- Production deployments requiring adversarial local enforcement must use the
  signed Electron package. Do not describe browser mode as equivalent to the
  desktop security boundary.

The activation token is signed over the exact ASCII string
`RTPT1.<base64url-payload>` and is formatted as:

```text
RTPT1.<base64url-json-payload>.<base64url-ed25519-signature>
```

The signed payload is bound to `rt-pt-inspector`,
`com.amitay.rtptinspector`, and the installation code displayed by the target
desktop installation.

## Provisioning the verification key

Provision the public half of the controlled RT-PT licensing key pair at:

```text
electron/rtpt-license-public-key.pem
```

The file must be an Ed25519 SubjectPublicKeyInfo PEM. Only the public key is
packaged. Never place the private key, a seed, a passphrase, or an exported key
pair in this repository.

The controlled release environment must also supply the independently recorded
SHA-256 fingerprint of the key's DER-encoded SubjectPublicKeyInfo:

```powershell
$env:RTPT_LICENSE_PUBLIC_KEY_SHA256 = '<64-hex-character-controlled-fingerprint>'
npm run license:key:verify
```

The key custodian can calculate the candidate SPKI fingerprint with
`node scripts/verify-rtpt-license-key.cjs --public-key <path> --print-fingerprint`.
That output must be reviewed and transferred into the release environment
through the controlled key-provisioning process; do not copy an unreviewed value
from a build log. No placeholder key or default fingerprint is provided: the
controlled release checkout must receive the approved public PEM, while the
expected fingerprint remains release-environment configuration.

Every production release, production dry run, and upload-only release fails
before packaging or publication when the PEM is missing, is not an Ed25519
public key, has no controlled expected fingerprint, or does not match it. The
post-package audit then requires both `rtpt-license-service.cjs` and the exact
public PEM inside `app.asar`, compares its bytes with the controlled source PEM,
and verifies its SPKI fingerprint again. Private-key files and activation
packages are excluded by the builder and rejected by the packaged-content
audit.

During an unpackaged development run only, a different public-key file can be
selected with `RTPT_LICENSE_PUBLIC_KEY_PATH`. Packaged builds ignore that
environment override and use the pinned packaged file.

`-AllowUnsignedDevelopmentBuild` is the only release-script mode that may build
without the controlled key/fingerprint. It prints an explicit
`RT/PT LICENSING UNUSABLE` warning when the key cannot be verified; activation
remains blocked, and that mode cannot commit, tag, upload, or publish.

## Issuing an activation code

Use the repository issuer with the private key supplied by an external secure
path:

```powershell
npm run license:issue -- `
  --private-key C:\secure\rtpt-license-private-key.pem `
  --installation-id <installation-uuid> `
  --customer "Customer name" `
  --expires 2027-12-31 `
  --output C:\secure\issued\customer.rtpt-license.json
```

Use `--perpetual` instead of `--expires` only when the commercial license is
explicitly perpetual. Output files are created with exclusive-create semantics
so an existing activation package is not silently overwritten.

### Site licenses (no installation binding)

`--any-installation` replaces `--installation-id` and issues a license whose
payload carries `installationId: null`. The desktop app then skips only the
installation check; the Ed25519 signature, the `rt-pt-inspector` /
`com.amitay.rtptinspector` identity, the clock-rollback check, and expiry are
all still enforced, and an unsigned or altered token is still rejected.

```powershell
npm run license:issue -- `
  --private-key C:\secure\rtpt-license-private-key.pem `
  --any-installation `
  --customer "Customer name" `
  --expires 2027-12-31
```

The commercial trade-off is deliberate and must be understood before use: one
site-license code activates an unlimited number of installations, it can be
forwarded by the recipient, and — like every offline license here — it cannot
be revoked after issuance. Prefer `--installation-id` whenever the target
installation code is known. Installation-bound licenses issued earlier keep
working unchanged.

## Offline limitation

An offline signed license cannot be revoked immediately after issuance. Early
revocation requires a separately designed, signed revocation-list/update flow;
it must not be simulated by weakening local verification or adding a hidden
bypass.
