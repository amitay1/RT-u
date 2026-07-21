# Offline update package security

USB updates are disabled unless the application contains a pinned public key at
`electron/update-public-key.pem`. The corresponding private key must remain in
the controlled release environment and must never be copied into this repository
or an update package.

The controlled release environment must also provide the independently approved
SHA-256 fingerprint of the public key's DER-encoded SubjectPublicKeyInfo. Verify
the provisioned trust anchor before packaging:

```powershell
$env:RTPT_UPDATE_PUBLIC_KEY_SHA256 = '<64-hex-character-controlled-fingerprint>'
npm run update:key:verify
```

Production release, dry-run, and upload-only flows fail closed when the public
key or fingerprint is missing, malformed, or mismatched. A local unsigned
development package may continue only with USB update installation explicitly
disabled.

## Package layout

```text
RTPT-Update-2.0.0/
  update-info.json
  update-info.sig
  RTPT-Inspector-Setup.exe
```

`update-info.json` must contain at least:

```json
{
  "version": "2.0.0",
  "installerFile": "RTPT-Inspector-Setup.exe",
  "installerSha256": "<64 lowercase hexadecimal characters>",
  "signatureFile": "update-info.sig",
  "platform": "win32"
}
```

Optional display fields are `releaseDate`, `changelog`, `size`, and
`minVersion`. File names must refer to regular files directly inside the update
folder. Nested paths, absolute paths, symbolic links, and installer types other
than `.exe` and `.msi` are rejected.

## Signing sequence

1. Build and Authenticode-sign the Windows installer in the controlled release
   environment.
2. Calculate the SHA-256 of the final signed installer and write it to
   `installerSha256`.
3. Write the final `update-info.json`; do not reformat it after signing.
4. Sign the exact bytes of `update-info.json` with the release private key and
   save the binary signature as `update-info.sig`.
5. Distribute only the public key with the application.

Example signing command for an RSA key:

```powershell
openssl dgst -sha256 -sign rtpt-update-private-key.pem -out update-info.sig update-info.json
```

The application verifies the manifest signature, validates version and
platform, verifies the installer hash, copies the installer to a private staging
directory, verifies the staged copy again, and only then starts it. Missing keys,
missing signatures, invalid hashes, and malformed paths fail closed.
