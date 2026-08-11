# RT-PT Inspector — Quick Context

## Non-negotiable boundary

This workspace is the standalone RT-PT Inspector product. It is not
Scan-Master and has no technical or data relationship to Scan-Master. A similar
UI appearance does not change that fact.

Only work inside:

`C:\Users\Amita\Documents\RT-PT-Inspector`

Do not read, inspect, search, execute, copy, modify, delete, build, test, or run
Git commands in the separate Scan-Master repository:

`C:\Users\Amita\Documents\Scan-Master`

Do not share code, assets, data, storage, databases, environment variables,
credentials, installers, releases, or update channels with Scan-Master. See the
authoritative boundary in `AGENTS.md` before doing any work.

## Product

RT-PT Inspector creates planned NDT technique documents for:

1. RT Film
2. RT Digital/DDA
3. Liquid Penetrant Testing (PT)

It uses a controlled V3 document model with validation, revision history,
approvals, PDF export, local/database persistence, and explicit V1/V2 import
migration review.

## Independent identity

| Item | RT-PT value |
|---|---|
| npm package | `rt-pt-inspector` |
| Electron app ID | `com.amitay.rtptinspector` |
| Browser storage prefix | `rtpt_inspector_*` |
| Build output | `rtpt-dist/` |
| Release repository | `amitay1/RT-u` |

There is no automatic import or migration from any other product.

## Active code

- `src/components/rtpt/` — Film, Digital, PT, control and approval UI
- `src/types/rtPtDocument.ts` — controlled V3 document types
- `src/lib/rtPtDocumentCodec.ts` — strict read/migration/write boundary
- `src/lib/rtPtValidation.ts` — domain and approval validation
- `src/hooks/useRtPtWorkspaceState.ts` — method/document workspace state
- `src/hooks/useSheetPersistence.ts` — DB/local persistence identities
- `src/utils/export/RtPtTechniquePDF.ts` — controlled PDF generation
- `server/rtptRoutes.ts` — RT/PT API
- `electron/` — independent desktop shell and updater

Historical files outside the active RT/PT program are not runtime features. Do
not reconnect them and do not delete user-owned files without explicit approval.

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

Do not change dependency sets, edit generated output, commit, push, tag, or
publish without the user's explicit authorization.
