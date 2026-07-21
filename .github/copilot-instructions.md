# DEPRECATED — DO NOT USE FOR RT-PT INSPECTOR

This file describes a separate historical product and is not authoritative for
this repository. All work here must follow `QUICK_CONTEXT.md` and `AGENTS.md`.
Do not execute, copy, reconnect, or release any Scan-Master/UT/CAD path described
below. The remainder is retained only as historical user-owned material.

# Historical ScanMaster AI Coding Instructions

## Project Overview
ScanMaster generates **technique sheets** and **inspection reports** for ultrasonic NDT compliant with aerospace standards (AMS-STD-2154, ASTM E2375, ASTM A388, BS-EN-10228).

## Architecture

### Data Flow
```
Frontend (React) → Express API → PostgreSQL (Drizzle ORM)
                 ↘ JSON job spec → Python CAD engine → STEP/PDF
```

### Frontend (`src/`)
- **React 18 + TypeScript + Vite** with shadcn/ui (Radix primitives)
- **State**: TanStack React Query for API; React local state for UI (**no Redux/Zustand**)
- **Main orchestrator**: `src/pages/Index.tsx` - 8 tabs for technique sheets, 5 tabs for inspection reports
- **3D**: `@react-three/fiber` for part visualization

### Backend (`server/`)
- **Express 5** served via `tsx` (TypeScript execution)
- **Schema**: `shared/schema.ts` - Drizzle ORM with Zod validation
- **Routes**: `server/routes.ts` - all API endpoints (~935 lines)
- **Mock org**: Development uses `MOCK_ORG_ID` for multi-tenant testing

### CAD Engine (`drawing-engine/`)
- **Python** (CadQuery + FreeCAD TechDraw) - external process
- Set `SCANMASTER_CAD_SCRIPT` env var pointing to Python entrypoint
- Job specs written to `cad-engine-jobs/`, output to `cad-3d-output/`

## Critical Patterns

### Domain Types (`src/types/techniqueSheet.ts`)
```typescript
type PartGeometry = "box" | "cylinder" | "tube" | "l_profile" | "i_profile" | ... // 27+ shapes
type AcceptanceClass = "AAA" | "AA" | "A" | "B" | "C";  // AMS-STD-2154
type StandardType = "AMS-STD-2154E" | "ASTM-A388" | "BS-EN-10228-3" | ...
```

### Auto-Fill Logic (`src/utils/autoFillLogic.ts`)
When material/class changes, dependent fields auto-populate via `materialDatabase`:
- `getRecommendedFrequency(thickness, material)` - trades resolution vs penetration
- `calculateMetalTravel(thickness)` - 3× thickness rule for calibration
- `getCouplantRecommendation(transducerType, material)` - immersion vs contact

### Split Mode State (Part A / Part B)
`src/pages/Index.tsx` maintains parallel state controlled by `activePart`:
```typescript
const [inspectionSetup, setInspectionSetup] = useState<InspectionSetupData>(...);
const [inspectionSetupB, setInspectionSetupB] = useState<InspectionSetupData>(...);
// Pattern repeats for: equipment, calibration, scanParameters, acceptanceCriteria, documentation
```

### Tab Components
Each tab in `src/components/tabs/` receives props from Index.tsx and calls setters to update state.

### Context Providers (`src/contexts/`)
- `LicenseContext` - Electron licensing via `window.electron.license.*`
- `SavedCardsContext` - Per-profile localStorage persistence
- `InspectorProfileContext` - Inspector certification data
- `SettingsContext` - App-wide settings

### Electron Integration
Desktop app uses IPC via preload script:
```typescript
// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electron;
// License check example
if (isElectron) {
  const license = await window.electron.license.check();
}
```

### Logging
Use `src/lib/logger.ts` instead of `console.log`:
```typescript
import { logInfo, logError, logWarn } from "@/lib/logger";
logInfo("message", { context });  // ℹ️ in dev, POST /api/logs in prod
```

### Export System (`src/utils/export/`)
- **ExportManager** (singleton) routes exports to appropriate exporter
- **BaseExporter** abstract class - template method pattern for PDF/Word sections
- Exporters: `pdfExporter.ts` (jsPDF), `wordExporter.ts` (docx), `tuvExporter.ts` (bilingual TÜV)
- **CaptureEngine** - Universal visual capture with 30s cache TTL and retry logic

### Validation Engine (`src/utils/standards/`)
- **validationEngine** - Real-time compliance checking with standard refs
- **complianceEngine** - Multi-standard calculations, loads from `standards/processed/`
- **fieldDependencyEngine** - Auto-fill cascade: standard→material→geometry→class

### Electron Preload (`electron/preload.cjs`)
Two exposed APIs:
- `window.electronAPI` - Legacy channel-restricted IPC
- `window.electron` - Primary API (updates, license, version info)

## Commands
```bash
npm run dev          # Dev server (tsx watch + Vite HMR)
npm run build        # Production frontend build
npm run lint         # ESLint - always run after changes
npm run db:push      # Drizzle schema push to PostgreSQL
npm run electron:dev # Desktop app development
npm run release      # Windows: version bump + electron build
```

### Release Script (`scripts/release.ps1`)
```powershell
.\scripts\release.ps1 [patch|minor|major] [message]
# Bumps version → git commit/tag/push → npm run dist:win → gh release create
```

### Release Workflow
After completing a batch of changes (bug fixes, features), run the release script in background:
```powershell
.\scripts\release.ps1
```
**Do NOT wait** for the build to finish - continue working on the next task immediately so the user can report more issues while the new version builds (~5-10 min).

## Conventions

### File Naming
| Type | Pattern | Example |
|------|---------|---------|
| Component | `PascalCase.tsx` | `CalibrationTab.tsx` |
| Hook | `use-kebab-case.ts` | `use-saved-cards.ts` |
| Types | `kebab-case.ts` | `techniqueSheet.ts` |
| Utils | `kebab-case.ts` | `autoFillLogic.ts` |

### Component Patterns
- Functional only; use `cn()` for conditional Tailwind classes
- Import UI from `@/components/ui/*` (shadcn/ui)
- Use `@/` path alias (configured in vite/tsconfig)

### API Routes (all in `server/routes.ts`)
- `GET/POST/PATCH/DELETE /api/technique-sheets` - CRUD with org scoping
- `POST /api/cad/engine/parts` - Generate STEP via Python
- `POST /api/cad/drawings` - Generate PDF drawings via Python
- `GET /api/profiles` - Inspector profile management

## Do NOT
- Install npm packages without explicit confirmation
- Edit `dist/`, `cad-3d-output/`, `cad-engine-jobs/` (build artifacts)
- Add global state libraries (Zustand, Redux, etc.)
- Change UT calculations without reading `standards/` and `docs/AUTO_FILL_DOCUMENTATION.md`
- Assume `html2canvas` exists (it doesn't)
- Use `console.log` directly - use `logInfo`/`logError` from `@/lib/logger`

## Testing
**No test suite exists yet.** When adding tests:
- Propose framework (Vitest recommended) and confirm before adding to `package.json`
- Focus on: UT calculations, auto-fill logic, geometry math

## Key Documentation
- `CLAUDE.md` - Full project context with feature checklist
- `docs/AUTO_FILL_DOCUMENTATION.md` - Field dependency rules
- `drawing-engine/README.md` - Python CAD setup
- `standards/` - UT standard data files (update data here, not code)
