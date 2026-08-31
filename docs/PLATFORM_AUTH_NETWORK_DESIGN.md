# Platform Design: User Tiers, Audit Trail, and Networked Deployment

Status: DESIGN (2026-08-28). No code from this document is implemented yet.
Owner: RT-PT Inspector platform work following the Ronex proposal gap analysis.

## 1. Goals (what the commercial proposal promises)

1. User-permission tiers — Level I, II, III, Admin — that actually restrict
   actions, not only record identities.
2. Tamper-evident engineering logs: an automatic, append-only audit trail.
3. Deployment "on-premises or via private corporate cloud networks": a
   networked multi-user server mode.
4. Multi-site standardization of controlled content.

## 2. Current state (verified in the gap analysis)

- Accountless by design: identity is a random UUID in localStorage;
  `x-user-id` is a local selector, not authentication
  (`server/rtptRoutes.ts` documents this explicitly).
- The server refuses to bind beyond loopback until an authenticated public
  mode exists (`server/index.ts` throws on non-loopback HOST) — a deliberate
  fail-closed guard this design must replace, not delete.
- `server/utils/logger.ts` defines `logAudit` with zero call sites.
- `shared/schema.ts` has organization/org_members scaffolding with roles that
  nothing enforces; runtime role is hardcoded `owner`.
- Approved-content integrity is an unkeyed SHA-256 fingerprint enforced at
  load/write/export; there is no per-event log.
- Legacy Docker/AWS/GCP artifacts in the repo are Scan-Master-era and cannot
  boot the current server; they must be deleted or rewritten, never reused.

## 3. Phase 1 — Local accounts, roles, and audit log (single workstation)

### 3.1 Accounts

- New `users` store (Electron: encrypted JSON via `safeStorage`, mirroring the
  license-record pattern; browser/server mode: `users` table).
- Record: `{ id, displayName, personnelId, role, scryptHash, salt, createdAt,
  disabledAt? }`. Passwords hashed with Node `crypto.scrypt` (N=2^15, r=8,
  p=1, 32-byte salt) — no new dependencies.
- First run with no users: an explicit setup screen creates the initial
  Admin. No silent default accounts.

### 3.2 Roles and action gates

Roles: `operator` (Level I/II work), `level3`, `admin`.

| Action | operator | level3 | admin |
| --- | --- | --- | --- |
| Edit draft techniques/reports | yes | yes | yes |
| Approve / release (bind fingerprint) | no | yes | no* |
| Acknowledge migration | no | yes | no* |
| Manage catalogs (sources/detectors/IQI/materials) | propose | yes | yes |
| Manage users / installation settings | no | no | yes |

*Admin is an administration role, not an engineering authority; approval
stays exclusively with `level3`, preserving the product's Level III
philosophy. The existing approval-readiness rule (a complete `ndt-level-3`
entry) gains a binding: the approving session's authenticated identity must
match the `ndt-level-3` approval entry (name + personnelId).

### 3.3 Enforcement points

- UI: gate the status-change controls in `RtPtControlApprovalTab` on the
  session role; show who is signed in (extends `InspectorProfileContext`).
- Server/Electron API: every write route checks the session; approval writes
  additionally verify the level3 identity binding server-side (fail closed —
  same layering as the fingerprint checks today).

### 3.4 Audit log

- Append-only JSONL per installation: `{ seq, at, userId, action, subject,
  detailHash, prevHash, entryHash }` with `entryHash = SHA-256(prev + entry)`
  (hash chaining makes truncation/edit evident).
- Wire the existing `logAudit` helper to it; call sites: login/logout, save,
  status change, approval bind, migration acknowledgement, catalog changes,
  user administration, PDF export.
- Read-only Audit view (admin + level3), plus export to the diagnostics
  bundle.

## 4. Phase 2 — Authenticated networked mode (private corporate network)

- New explicit opt-in: `RTPT_PUBLIC_MODE=authenticated` replaces the
  loopback-only throw. Without it, behaviour stays exactly as today.
- Requirements enforced at startup in public mode (fail closed):
  TLS (terminate in the app via cert paths or document a reverse-proxy with
  `RTPT_TRUST_PROXY=1` + Host allowlist from `RTPT_PUBLIC_HOSTS`), a real
  session layer (httpOnly cookies, SameSite=Strict, scrypt-verified logins,
  server-side session store with idle + absolute expiry), CSRF token on
  writes, and the existing rate limiting/sanitization middleware.
- Storage: Postgres via the existing `RTPT_DATABASE_URL` boundary; the flat
  JSON Electron store stays workstation-only.
- Multi-site standardization: the networked server becomes the source of
  truth; workstations move to server persistence. The saved-cards JSON
  exchange keeps its demote-on-import rule for cross-ORGANIZATION transfer
  only; within one server, approved documents replicate with their
  fingerprints intact.
- New deployment artifacts written from scratch (single Dockerfile +
  compose with Postgres + TLS notes); delete the legacy Scan-Master ones.

## 5. Explicitly out of scope here

- SSO/LDAP (a later enterprise phase; the session layer is designed so a
  different authenticator can slot in).
- Cryptographic signing of documents (the fingerprint remains unkeyed; a
  signing key per installation can be layered later using the license
  keypair pattern).

## 6. Testing plan

- Unit: scrypt verify, hash-chain verification (tamper detection), role
  gates per action, approval identity binding.
- Server tests: unauthenticated/insufficient-role writes rejected; public
  mode refuses to start without TLS+session config.
- Release smoke: login flow, gated approval, audit entries appended.

## 7. Effort estimate

- Phase 1: ~3–5 focused days (accounts + gates + audit + tests).
- Phase 2: ~1–2 weeks including deployment artifacts and docs.

## 8. Sequencing note

The Alpha/Beta milestones in the commercial proposal map cleanly: Phase 1 in
Alpha (tiers + audit on a workstation), Phase 2 in Beta (private-network
deployment + multi-site).
