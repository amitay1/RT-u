# CLAUDE.md — RT-PT Inspector

This repository is **RT-PT Inspector**: a standalone desktop application (with a
same-origin local browser/PWA mode) for creating radiographic (RT Film, RT
Digital/DDA) and liquid-penetrant (PT) NDT technique sheets.

## Read these first

1. `QUICK_CONTEXT.md` — two-minute orientation and the workspace boundary.
2. `AGENTS.md` — **authoritative** guidelines for all work in this repository.
3. `README.md` — product description, quality checks, release commands.

`AGENTS.md` wins over this file wherever they differ.

## Identity

| Item | Value |
| --- | --- |
| Product | RT-PT Inspector |
| npm package | `rt-pt-inspector` |
| Electron application ID | `com.amitay.rtptinspector` |
| Browser storage prefix | `rtpt_inspector_*` |
| Renderer build output | `rtpt-dist/` |
| Release repository | `https://github.com/amitay1/RT-u` |

This product must never be named after, branded as, or described as a variant of
any other product. Before any release, confirm the packaged surface is clean:

```powershell
npm run build
npm run smoke:release   # fails the release on legacy first-party identifiers
```

## Active code

- `src/components/rtpt/` — Film, Digital, PT, control and approval UI
- `src/types/rtPtDocument.ts` — controlled V3 document types
- `src/lib/rtPtDocumentCodec.ts` — strict read/migration/write boundary
- `src/lib/rtPtValidation.ts` — domain and approval validation
- `src/hooks/useRtPtWorkspaceState.ts` — method/document workspace state
- `src/utils/export/RtPtTechniquePDF.ts` — controlled PDF generation
- `server/rtptRoutes.ts` — RT/PT API
- `electron/` — independent desktop shell and updater

Files outside the active RT/PT program are historical and are not runtime
features. Do not reconnect them, and do not delete user-owned files without
explicit approval.

## Working rules

- Prefer small, incremental changes. Show a short plan and a diff before applying
  edits.
- Never add or change dependencies without explicit confirmation.
- Never edit generated output (`rtpt-dist/`, `release-build/`, exported PDFs).
- After any non-trivial change run `npm run lint`, `npm run typecheck`, and
  `npm test`; run `npm run build` for anything touching build or packaging.
- Do not commit, tag, push, or publish without the user's explicit authorization.

## Commands

```powershell
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke:release
npm run electron:dev
```
