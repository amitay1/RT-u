#!/usr/bin/env bash

# Build a signed, RT-PT-only USB update folder. This script intentionally does
# not build server, database, licensing, Docker, or Scan-Master artifacts.

set -euo pipefail

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat >&2 <<'EOF'
Usage:
  RTPT_OFFLINE_UPDATE_PRIVATE_KEY=/secure/rtpt-update-private-key.pem \
    scripts/build-offline-package.sh <version> <signed-installer>

The installer must be named RTPT-Inspector-Setup-<version>.exe and must live
below release-workspace/. Output is created at:
  release-workspace/offline/RTPT-Update-<version>/

Optional environment variables:
  RTPT_OFFLINE_UPDATE_KEY_PASSPHRASE  Passphrase for an encrypted private key
  RTPT_OFFLINE_UPDATE_CHANGELOG       Changelog text stored in the manifest
EOF
  exit 2
}

[[ $# -eq 2 ]] || usage

VERSION="${1#v}"
INSTALLER_INPUT="$2"
PRIVATE_KEY="${RTPT_OFFLINE_UPDATE_PRIVATE_KEY:-}"
CHANGELOG="${RTPT_OFFLINE_UPDATE_CHANGELOG:-}"

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "Version must be a stable semantic version (for example, 1.2.3)."
[[ -n "$PRIVATE_KEY" ]] || fail 'RTPT_OFFLINE_UPDATE_PRIVATE_KEY must point to the controlled release private key.'

for command_name in node openssl realpath; do
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required."
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
WORKSPACE_ROOT="$REPO_ROOT/release-workspace"
PUBLIC_KEY="$REPO_ROOT/electron/update-public-key.pem"

[[ -d "$WORKSPACE_ROOT" && ! -L "$WORKSPACE_ROOT" ]] || fail "Release workspace is missing or unsafe: $WORKSPACE_ROOT"
[[ -f "$INSTALLER_INPUT" && ! -L "$INSTALLER_INPUT" ]] || fail "Installer must be a regular, non-symlink file: $INSTALLER_INPUT"
[[ -f "$PRIVATE_KEY" && ! -L "$PRIVATE_KEY" ]] || fail 'The manifest private key must be a regular, non-symlink file outside the repository.'
[[ -f "$PUBLIC_KEY" && ! -L "$PUBLIC_KEY" ]] || fail "Pinned update public key is missing or unsafe: $PUBLIC_KEY"

WORKSPACE_REAL="$(realpath "$WORKSPACE_ROOT")"
INSTALLER_REAL="$(realpath "$INSTALLER_INPUT")"
PRIVATE_KEY_REAL="$(realpath "$PRIVATE_KEY")"

case "$INSTALLER_REAL" in
  "$WORKSPACE_REAL"/*) ;;
  *) fail "Installer must resolve below $WORKSPACE_REAL" ;;
esac

case "$PRIVATE_KEY_REAL" in
  "$REPO_ROOT"/*) fail 'The offline-update private key must not be stored inside the repository.' ;;
esac

EXPECTED_INSTALLER_NAME="RTPT-Inspector-Setup-$VERSION.exe"
[[ "$(basename "$INSTALLER_REAL")" == "$EXPECTED_INSTALLER_NAME" ]] || fail "Expected installer name: $EXPECTED_INSTALLER_NAME"

OPENSSL_KEY_ARGS=()
if [[ -n "${RTPT_OFFLINE_UPDATE_KEY_PASSPHRASE:-}" ]]; then
  OPENSSL_KEY_ARGS=(-passin env:RTPT_OFFLINE_UPDATE_KEY_PASSPHRASE)
fi

openssl pkey -in "$PRIVATE_KEY_REAL" "${OPENSSL_KEY_ARGS[@]}" -check -noout >/dev/null
PRIVATE_FINGERPRINT="$(openssl pkey -in "$PRIVATE_KEY_REAL" "${OPENSSL_KEY_ARGS[@]}" -pubout -outform DER 2>/dev/null | openssl dgst -sha256 | awk '{print $2}')"
PINNED_FINGERPRINT="$(openssl pkey -pubin -in "$PUBLIC_KEY" -outform DER 2>/dev/null | openssl dgst -sha256 | awk '{print $2}')"
[[ -n "$PRIVATE_FINGERPRINT" && "$PRIVATE_FINGERPRINT" == "$PINNED_FINGERPRINT" ]] || fail 'Private key does not match electron/update-public-key.pem.'

verify_authenticode() {
  local installer_path="$1"
  local native_path="$installer_path"

  if command -v powershell.exe >/dev/null 2>&1; then
    if command -v cygpath >/dev/null 2>&1; then
      native_path="$(cygpath -w "$installer_path")"
    elif command -v wslpath >/dev/null 2>&1; then
      native_path="$(wslpath -w "$installer_path")"
    fi

    powershell.exe -NoProfile -NonInteractive -Command \
      '& { param($Installer) $signature = Get-AuthenticodeSignature -LiteralPath $Installer; if ($signature.Status -ne "Valid" -or -not $signature.SignerCertificate) { Write-Error "Installer Authenticode signature is not valid: $($signature.Status)"; exit 1 } }' \
      "$native_path" >/dev/null
    return
  fi

  if command -v osslsigncode >/dev/null 2>&1; then
    osslsigncode verify -in "$installer_path" >/dev/null
    return
  fi

  fail 'Cannot verify Authenticode. Run on Windows with powershell.exe or install osslsigncode.'
}

verify_authenticode "$INSTALLER_REAL"

OFFLINE_ROOT="$WORKSPACE_REAL/offline"
OUTPUT_DIR="$OFFLINE_ROOT/RTPT-Update-$VERSION"
[[ ! -e "$OUTPUT_DIR" ]] || fail "Refusing to overwrite existing output: $OUTPUT_DIR"

if [[ -e "$OFFLINE_ROOT" ]]; then
  [[ -d "$OFFLINE_ROOT" && ! -L "$OFFLINE_ROOT" ]] || fail "Offline output root is unsafe: $OFFLINE_ROOT"
else
  mkdir "$OFFLINE_ROOT"
fi
mkdir "$OUTPUT_DIR"

PACKAGE_INSTALLER_NAME='RTPT-Inspector-Setup.exe'
PACKAGE_INSTALLER="$OUTPUT_DIR/$PACKAGE_INSTALLER_NAME"
MANIFEST="$OUTPUT_DIR/update-info.json"
SIGNATURE="$OUTPUT_DIR/update-info.sig"
CHECKSUM_FILE="$OUTPUT_DIR/$PACKAGE_INSTALLER_NAME.sha256"

cp -- "$INSTALLER_REAL" "$PACKAGE_INSTALLER"
INSTALLER_SHA256="$(openssl dgst -sha256 "$PACKAGE_INSTALLER" | awk '{print tolower($2)}')"
[[ "$INSTALLER_SHA256" =~ ^[a-f0-9]{64}$ ]] || fail 'Unable to calculate installer SHA-256.'
INSTALLER_SIZE="$(wc -c < "$PACKAGE_INSTALLER" | tr -d '[:space:]')"
RELEASE_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

node - "$VERSION" "$INSTALLER_SHA256" "$INSTALLER_SIZE" "$RELEASE_DATE" "$CHANGELOG" "$MANIFEST" <<'NODE'
const fs = require('fs');

const [version, installerSha256, size, releaseDate, changelog, output] = process.argv.slice(2);
const manifest = {
  version,
  installerFile: 'RTPT-Inspector-Setup.exe',
  installerSha256,
  signatureFile: 'update-info.sig',
  platform: 'win32',
  releaseDate,
  size: Number(size),
};
if (changelog) manifest.changelog = changelog;

fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
NODE

printf '%s  %s\n' "$INSTALLER_SHA256" "$PACKAGE_INSTALLER_NAME" > "$CHECKSUM_FILE"
openssl dgst -sha256 -sign "$PRIVATE_KEY_REAL" "${OPENSSL_KEY_ARGS[@]}" -out "$SIGNATURE" "$MANIFEST"
openssl dgst -sha256 -verify "$PUBLIC_KEY" -signature "$SIGNATURE" "$MANIFEST" >/dev/null

COPIED_SHA256="$(openssl dgst -sha256 "$PACKAGE_INSTALLER" | awk '{print tolower($2)}')"
[[ "$COPIED_SHA256" == "$INSTALLER_SHA256" ]] || fail 'Installer changed while the offline package was being created.'

printf 'RT-PT offline update created: %s\n' "$OUTPUT_DIR"
printf 'Manifest signature and installer SHA-256 verified.\n'
