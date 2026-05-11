# Scan Master Project Scan (Knowledge Base)

Generated: 2026-01-02
Scope: Source code and text docs scanned in repo root. Binary assets (pdf/docx/images) were not parsed.

## Overview
- Product: Scan Master Inspection Pro, NDT ultrasonic inspection planning and documentation.
- Outputs: technique sheets, inspection reports, technical drawings, CAD/STEP exports, PDF/DOCX.
- Standards focus: AMS-STD-2154E, MIL-STD-2154, ASTM A388, BS EN 10228-3/4 (plus other referenced standards).
- Modes: Technique Sheet (8 tabs) and Inspection Report (5 tabs).
- Delivery modes: web app, PWA (offline), Electron desktop, and serverless options.

## Tech Stack
- Frontend: React 18, TypeScript, Vite, Tailwind, Radix, shadcn/ui.
- Backend: Express 5, Node, tsx runtime, Drizzle ORM, PostgreSQL.
- Auth: Supabase (client + edge functions).
- 3D: three.js, @react-three/fiber, @react-three/drei, three-csg-ts.
- Drawing: Paper.js, MakerJS, JSCAD, OpenType.js.
- Export: jsPDF, docx, dxf-writer.
- Desktop: Electron, electron-builder.
- PWA: service-worker-advanced.js.

## Architecture (High Level)
- Frontend in `src/` with large tabbed UI and data models.
- Backend API in `server/` with storage via Drizzle + PostgreSQL.
- Shared types and schemas in `shared/`.
- Drawing engine (Python) in `drawing-engine/` using CadQuery + FreeCAD TechDraw.
- External CAD engine integration via env vars (STEP output).
- Update server in `update-server/` for per-factory updates.

## Key Entry Points
- Frontend app: `src/main.tsx`, `src/App.tsx`, `src/pages/Index.tsx`.
- Backend app: `server/index.ts`, `server/routes.ts`, `server/storage.ts`, `server/db.ts`.
- Shared schema: `shared/schema.ts`, CAD spec: `shared/drawingSpec.ts`.
- Electron main: `electron/main.cjs`, preload: `electron/preload.cjs`.
- Update server: `update-server/index.js`.

## UI Flow (Technique Sheet)
- Tabs: Setup, Scan Details, Technical Drawing, Equipment, Reference Standard, Scan Parameters, Acceptance, Documentation, Scan Plan.
- Split mode supports Part A/B with shared capture/export flow.
- 3D viewer panel is shown on Setup tab (scan directions overlay).
- Scan Plan tab loads documents from `public/documents/`.

## UI Flow (Inspection Report)
- Tabs: Cover Page, Part Diagram, Probe Details, Scans, Remarks.

## Data Models (Key Types)
- `src/types/techniqueSheet.ts`: StandardType, MaterialType, PartGeometry, AcceptanceClass, and core form data.
- `src/types/scanDetails.ts`: scan direction definitions and catalog.
- `shared/schema.ts`: organizations, profiles, technique_sheets, standards, access, bundles, purchase history.

## Standards and Auto-Fill
- `src/utils/autoFillLogic.ts`: materialDatabase, standardRules, geometryRecommendations.
- `src/utils/enhancedAutoFillLogic.ts`: TABLE_VI_ACCEPTANCE_LIMITS, GEOMETRY_INSPECTION_RULES, scan direction catalog.
- `src/utils/standards/fieldDependencyEngine.ts`: auto-fill rules and reasons.
- `src/data/standardsDifferences.ts`: authoritative acceptance criteria (note: autoFillLogic acceptanceLimits is deprecated).
- Standard data JSON in `standards/processed/*.json`.

## Export System
- PDF: `src/utils/export/TechniqueSheetPDF.ts`, `src/utils/professionalPdfExport.ts`.
- Word: `src/utils/exporters/wordExporter.ts`.
- TUV template: `src/utils/exporters/tuvStyleExporter.ts` (19-page report).
- Export orchestration: `src/utils/exporters/exportManager.ts`.
- Export UI: `src/components/export/ExportDialog.tsx`, `UnifiedExportDialog.tsx`.

## Drawings and CAD
- React technical drawings in `src/utils/technicalDrawings/` and `src/components/TechnicalDrawing...`.
- Python drawing engine: `drawing-engine/job_runner.py`, `drawing-engine/scanmaster_drawing_engine/*`.
- CAD drawing API: `POST /api/cad/drawings` -> Python job_runner, outputs to `cad-output/`.
- CAD STEP API: `POST /api/cad/engine/parts` -> external CAD engine, outputs to `cad-3d-output/`.
- CAD integration issues documented in `docs/CAD_ENGINE_ERROR_REPORT.md`.

## Licensing and Updates
- License generator: `scripts/license-generator.cjs` (HMAC signature).
- Electron license manager: `electron/license-manager.cjs` (AES-256-CBC local storage).
- License UI: `src/components/LicenseActivation.tsx`, gating in `src/contexts/LicenseContext.tsx`.
- Update server: `update-server/index.js` (factory configs, channels, admin endpoints).
- Electron auto-updater: `electron/main.cjs`, IPC bridge in `electron/preload.cjs`.

## Backend API (server/routes.ts)
- Health: `/api/health`; global health endpoints in `server/index.ts` at `/health`, `/health/live`, `/health/ready`, `/metrics`.
- Organizations: `/api/organizations` (mock in routes, full routes in `server/routes/organizations.ts` are disabled).
- Inspector profiles: `/api/inspector-profiles` CRUD (org enforced).
- Technique sheets: `/api/technique-sheets` CRUD (requires x-user-id and x-org-id).
- Standards: `/api/standards`, `/api/standards/:id`.
- Standard access: `/api/user-standards`, `/api/validate-standard-access`.
- Lemon Squeezy webhook: `/api/webhooks/lemon-squeezy`.
- Checkout: `/api/create-checkout` (placeholder returns mock URL).
- CAD: `/api/cad/drawings`, `/api/cad/engine/parts`.

## Supabase Edge Functions
- `supabase/functions/create-lemon-squeezy-checkout` (real checkout).
- `supabase/functions/lemon-squeezy-webhook` (grant access, renewals).
- `supabase/functions/validate-standard-access`, `get-user-standards`.

## Data Storage
- Postgres via Drizzle (`shared/schema.ts`, `server/storage.ts`).
- Migrations: `server/migrations/*.sql`.
- Offline DB seeds: `database/*.sql`.
- Electron offline mode stores JSON under userData (technique-sheets, inspector-profiles, orgs).

## Build and Run
- Dev: `npm run dev` (tsx watch server + Vite).
- Build: `npm run build`; Prod server: `npm start`.
- Lint: `npm run lint`.
- DB: `npm run db:push`.
- Electron: `npm run electron`, `npm run electron:dev`, `npm run electron:build`, `npm run dist:win|mac|linux`.
- Update server: `node update-server/index.js`.

## Deployment
- Docker: `Dockerfile`, `docker-compose.yml` (app + postgres + nginx).
- GCP App Engine: `app.yaml`.
- AWS Lambda: `serverless.yml`, handler in `serverless/lambda.js`.
- PWA assets: `public/service-worker-advanced.js`, `public/manifest.json`.

## Key Environment Variables
- Core: DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, SESSION_SECRET.
- Payments: LEMON_SQUEEZY_API_KEY, LEMON_SQUEEZY_STORE_ID, LEMON_SQUEEZY_WEBHOOK_SECRET.
- CAD engine: PYTHON_BIN, SCANMASTER_CAD_SCRIPT, CAD_ENGINE_ROOT, FREECAD_PATH, TECHDRAW_TEMPLATE_PATH.
- Update server/Electron: UPDATE_SERVER_URL (Electron), LICENSE_SECRET (license generator/manager).
- Flags: ENABLE_PWA, ENABLE_OFFLINE_MODE, ENABLE_EXPORT_IMPORT, ENABLE_3D_VIEWER.

## Known Gaps and Risks (from docs)
- Lemon Squeezy checkout in `server/routes.ts` is TODO (mock URL).
- TypeScript strictness disabled in `tsconfig.json`.
- No test runner in package.json.
- CAD engine integration can fail; see `docs/CAD_ENGINE_ERROR_REPORT.md`.
- Legal templates in `legal/` require attorney review before use.
- Some docs mention console.log cleanup and other production polish items.

## Important Docs
- `README.md`, `CLAUDE.md`
- `docs/AUTO_FILL_DOCUMENTATION.md`, `docs/ADVANCED_DRAWING_STATUS.md`
- `docs/project/SCAN_PLAN_IMPLEMENTATION.md`
- `docs/TECHNIQUE_SHEET_ANALYSIS.md`, `docs/STANDARDS_COMPARISON.md`
- `docs/TUV_EXPORT_SYSTEM_README.md`, `docs/TUV_EXPORT_SYSTEM_ENHANCED_README.md`
- `docs/licensing/LICENSING_SYSTEM.md`, `docs/licensing/LICENSING_QUICKSTART.md`, `docs/licensing/README_LICENSING.md`
- `docs/licensing/UPDATE_SERVER_INTEGRATION.md`, `docs/licensing/PRODUCTION_DEPLOYMENT.md`
- `docs/DEPLOYMENT.md`, `docs/PRODUCTION_READINESS_REPORT.md`
- `docs/setup/PROFILE_SYNC_SETUP.md`
- `docs/PRODUCTION_TO_INSTALLATION_GUIDE.md`
