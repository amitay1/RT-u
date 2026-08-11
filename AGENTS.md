# AGENTS.md — RT-PT Inspector Project Guidelines

> Read `QUICK_CONTEXT.md` first. This file is authoritative for work in this
> repository.

## CRITICAL PRODUCT AND REPOSITORY BOUNDARY

RT-PT Inspector and Scan-Master are two completely independent products.
Visual similarity between their user interfaces does not create any technical,
organizational, or data relationship.

Work in this repository is limited to:

`C:\Users\Amita\Documents\RT-PT-Inspector`

The separate Scan-Master application and repository are outside the permitted
scope. In particular, never read, inspect, search, execute, copy from, write to,
move, delete, build, test, or run Git commands against:

`C:\Users\Amita\Documents\Scan-Master`

This prohibition also applies to any other directory, repository, database,
release, installer, update channel, environment, or cloud project belonging to
Scan-Master. Do not use Scan-Master as a source of code, assets, configuration,
data, schemas, credentials, or standards content.

Only an explicit user request in the current turn that names the separate
Scan-Master product may change this boundary. A request concerning "the app",
"the current project", or RT/PT never grants permission to touch Scan-Master.
If a task appears to require crossing this boundary, stop and ask the user.

## Project identity and scope

- Product: RT-PT Inspector
- Package: `rt-pt-inspector`
- Electron application ID: `com.amitay.rtptinspector`
- Release repository: `https://github.com/amitay1/RT-u`
- Production renderer output: `rtpt-dist/`
- Methods: RT Film, RT Digital/DDA, and Liquid Penetrant Testing
- Active document model: RT/PT V3; V1/V2 are explicit import-only migrations

RT-PT Inspector has its own code, data namespace, database configuration,
browser storage, desktop identity, installers, releases, and update channel.
Never introduce a shared fallback or automatic migration from another product.

## Working rules

- Prefer small, safe, incremental changes.
- Before edits, show a short plan and the intended diff.
- Preserve unrelated and user-owned changes in a dirty worktree.
- Use `apply_patch` for source and documentation edits.
- Do not install packages or change dependency sets without explicit user
  confirmation.
- Do not introduce a new global state library without explicit confirmation.
- Do not manually edit generated artifacts, including `rtpt-dist/`, `dist/`,
  packaged applications, generated PDFs, or release output.
- Do not commit, push, publish, tag, or create a release unless explicitly
  requested.
- Do not weaken validation, approval, signature, update, storage, or repository
  isolation controls to make a check pass.

## Domain rules

- Clearly distinguish planned/required technique values from achieved/performed
  inspection results.
- RT Digital/DDA is X-ray-only in the current model; do not add isotope/Gamma
  sources to that workspace.
- Treat ASTM/SAE references as guidance inputs, not automatic claims of
  compliance. The applicable revision, customer requirements, procedure, and
  Level III approval remain controlled document inputs.
- Preserve method-specific conditional logic and do not serialize inactive
  branches into editable or controlled output.
- Controlled PDF release requires an Approved document that independently
  passes current validation and approval-readiness checks.
- Keep quarantined legacy values out of editable fields and controlled PDFs.

## Active architecture

- Frontend: React 18, TypeScript, Vite, Tailwind, shadcn/Radix
- State: React local state/context and TanStack React Query
- Server: Express under `server/`, with RT/PT routes only
- Desktop: Electron under `electron/`
- PDF: jsPDF and jspdf-autotable
- Persistence: RT/PT-specific server and local document stores

Start searches in the active RT/PT surface:

- `src/components/rtpt/`
- `src/hooks/useRtPtWorkspaceState.ts`
- `src/hooks/useSheetPersistence.ts`
- `src/lib/rtPtDocumentCodec.ts`
- `src/lib/rtPtValidation.ts`
- `src/types/rtPtDocument.ts`
- `src/utils/export/RtPtTechniquePDF.ts`
- `server/rtptRoutes.ts`
- `electron/`

Historical files that are not imported by the active TypeScript program or
packaged build are not part of the RT-PT runtime. Do not revive or connect them.
Do not delete user-owned historical files without explicit approval.

## Required verification

After non-trivial logic changes, run:

```powershell
npm run lint
npm run typecheck
npm test
```

For build, Electron, release, server, or packaging changes, also run:

```powershell
npm run build
npm run smoke:release
```

The active build must write only to `rtpt-dist/`. Release contents must not
contain Scan-Master, UT/CAD runtime modules, shared identities, or legacy data.

## Release safety

Production releases require controlled Authenticode signing material and the
pinned offline-update public key at `electron/update-public-key.pem`. Private
keys and signing credentials must stay outside this repository. Never create,
invent, or substitute production signing material.
