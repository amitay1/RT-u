# CLAUDE.md – Scan-Master Project Guidelines

> **Quick Start:** Read `QUICK_CONTEXT.md` first for a condensed 2-minute overview of the entire project.
> This file contains full detailed guidelines - use it as reference for specific rules.

---

## 🆕 Latest Feature: Auto Calibration Block Recommendation (January 2026)

**IMPLEMENTED:** The system now automatically selects the appropriate calibration block based on part geometry, dimensions, and material!

### How it works:
1. User fills **Inspection Setup Tab** (material, part type, dimensions)
2. System calls `generateCalibrationRecommendationV2()` with parameters
3. Logic in `calibrationRecommenderV2.ts` selects optimal block:
   - Maps `partType` → geometry group (FLAT_PLATE, THIN_WALL_TUBULAR, etc.)
   - Checks ratios (L/T, W/T) and thresholds (wall thickness, diameter)
   - Returns block category + reasoning
4. **Calibration Tab** shows "✨ Auto-Selected" badge with tooltip explanation

### Examples:
- **Tube (OD=50, ID=40, wall=5mm)** → `cylinder_notched` (thin wall <25mm)
- **Cylinder (OD=100mm, solid)** → `flat_fbh` (diameter >50mm)
- **Plate (thickness=30mm)** → `flat_fbh` (standard for flat geometry)

### Files Modified:
- ✅ `src/components/tabs/InspectionSetupTab.tsx` - useEffect hook for auto-recommendation
- ✅ `src/pages/Index.tsx` - callback to update calibration data
- ✅ `src/components/tabs/CalibrationTab.tsx` - visual indicator (badge + tooltip)
- 📘 `docs/AUTO_CALIBRATION_RECOMMENDATION.md` - full technical documentation
- 📘 `docs/QUICK_START_AUTO_CALIBRATION.md` - user guide

---

## Project Overview

**Scan-Master** is an NDT (Non-Destructive Testing) application for ultrasonic inspection planning and documentation.

The system generates:

- **Technique sheets** – pre-inspection setup and scanning plans
- **Inspection reports** – post-inspection documentation and results
- **Technical drawings / CAD output** – multi-view drawings and STEP/DXF exports

Everything must stay aligned with aerospace UT standards (AMS-STD-2154, ASTM E2375, ASTM E127, relevant TUV specs, etc.).

Your role, Claude: you are a senior engineer on this project.
Prefer small, safe, well-explained changes over big rewrites. Ask before doing any risky refactor.

---

## How Claude should behave

- Always prefer **small, incremental changes** over large rewrites.
- Always show:
  1. A short plan.
  2. A diff of all file changes.
  before applying edits.

- **Never**:
  - Install new npm packages or change `package.json` dependencies without explicit confirmation.
  - Edit build artifacts or generated output folders: `dist/`, `cad-3d-output/`, exported PDFs, or attached assets.
  - Introduce new global state libraries (Zustand, Redux, etc.) on its own.

- When a change affects UT standards, geometry, or acceptance criteria:
  - First read the relevant docs under `standards/`, `docs/AUTO_FILL_DOCUMENTATION.md`, and `docs/TECHNIQUE_SHEET_ANALYSIS.md`.
  - Be conservative and explain the reasoning in detail.

- After each non-trivial change:
  - Run `npm run lint`.
  - For changes that touch build/deployment, run `npm run build`.

---

## Tech Stack

### Frontend

- **Framework**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui (Radix primitives)
- **Server state**: TanStack React Query
- **Local/UI state**: React local state and context
  - There is **no Zustand installed**. Do not introduce new state libraries unless explicitly requested.

- **3D Rendering**:
  - `three`, `@react-three/fiber`, `@react-three/drei`
  - Used for 3D previews of parts, scan directions and calibration blocks.

### Backend / API

- **Runtime**: Node.js + `tsx`
- **Framework**: Express 5 (server/index.ts)
- **Serverless compatibility**: `serverless.yml` for Lambda-style deployments
- **Logging / security**: `morgan`, `helmet`, `compression`, `cors`, `express-rate-limit`, `express-session` + `connect-pg-simple`.

### Data layer

- **Database**: PostgreSQL via `pg`
- **ORM**: Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `drizzle-zod`)
- **Auth / external services**: Supabase (`@supabase/supabase-js`)

Database schema and migrations must stay consistent with Drizzle + the Supabase project.

### CAD & Drawing

- **CAD / geometry**:
  - `@jscad/modeling`, `three`, `three-csg-ts`, `makerjs`, `paper`
  - Used to generate 2D/3D geometry, STEP-like output in `cad-3d-output/` and DXF-style drawings.

- **Drawing engine**:
  - Custom code under `drawing-engine/` for technical sketches.
  - Output formats include SVG/PNG/DXF/PDF (where supported).

### Documents & Export

- **PDF**: `jspdf` + `jspdf-autotable`
- **Word / DOCX**: `docx`
- Do **not** assume `html2canvas` exists – it is not part of this project.

### Desktop / Packaging

- **Electron**: `electron`, `electron-builder`
  - Electron entry: `electron/main.cjs`
  - Build targets: Windows, macOS, Linux via npm scripts.

### Tooling & Build

- **Bundler**: Vite
- **Language**: TypeScript 5
- **Linting**: ESLint 9 (config in `eslint.config.js`)
- **Styling**: Tailwind (`tailwind.config.ts`, `postcss.config.js`)

---

## Project Structure (high level)

```text
docs/archive/attached-assets/ # Archived assets attached to old jobs / docs
cad-3d-output/            # Generated 3D / STEP-like CAD output (treat as build artifacts)
cad-engine-jobs/          # Job definitions / JSON configs for CAD generation
dist/                     # Frontend build output
drawing-engine/           # Technical drawing engine (2D sketches, DXF/SVG logic)
electron/                 # Electron main process and config
legal/                    # Legal / license / contract docs (if present)
public/                   # Static frontend assets

scripts/                  # Utility scripts (PowerShell / JS / TS)
server/                   # Express server code (API routes, services)
serverless/               # Serverless deployment definitions and handlers
shared/                   # Shared domain types, schemas and utilities
src/                      # Main React frontend
standards/                # UT standard data (AMS, ASTM, TUV, materials, etc.)
supabase/                 # Supabase config, migrations, edge functions
tasks/                    # Background jobs/workers (CAD, PDFs, exports)

.env*, app.yaml, serverless.yml, docker-compose*.yml, Dockerfile  # Environment & deployment
```

> When you need to locate logic, first search in `src/`, `server/`, `shared/`, `drawing-engine/`, `standards/`, `tasks/`.

---

## Commands and workflows

Use **npm** as the default package manager (there is a `package-lock.json`).

```bash
# Dev / server
npm install
npm run dev          # Development: tsx watch server/index.ts + Vite dev client
npm run preview      # Preview built frontend

# Build & production
npm run build        # Frontend build (Vite)
npm start            # Production server (NODE_ENV=production tsx server/index.ts)

# Lint
npm run lint         # ESLint across the project

# Database / schema
npm run db:push      # Drizzle schema push

# Electron
npm run electron         # Run Electron
npm run electron:dev     # Electron in development mode
npm run electron:build   # Build Electron app
npm run dist:win         # Build Windows distributable
npm run dist:mac         # Build macOS distributable
npm run dist:linux       # Build Linux distributable
```

Whenever you modify logic:

1. Run `npm run lint` and fix all issues.
2. For changes that affect build or deployment, ensure `npm run build` succeeds.
3. For test setup:
   - Currently there is **no dedicated `npm test` script defined**.
   - Propose a test framework and script name, and ask before editing `package.json`.

---

## Application Modes

### Mode 1: Technique Sheet (8 Tabs)

| Tab | Name | Purpose |
|-----|------|---------|
| 1 | Setup | Part info, material, geometry, dimensions |
| 2 | Scan Details | 3D preview, 12 scanning directions (A-L) |
| 3 | Technical Drawing | Multi-view SVG export (PNG/SVG/DXF/PDF) |
| 4 | Equipment | Transducer, frequency, couplant settings |
| 5 | Reference Standard | Calibration block, FBH table, 3D preview |
| 6 | Scan Parameters | Method, speed, index, water path, gates |
| 7 | Acceptance Criteria | Class selection (AAA/AA/A/B/C), auto-fill |
| 8 | Documentation | Inspector info, approvals, dates |

### Mode 2: Inspection Report (5 Tabs)

| Tab | Name | Purpose |
|-----|------|---------|
| 1 | Cover Page | Document info, customer, results |
| 2 | Part Diagram | Drawing generation/upload |
| 3 | Probe Details | Probe configuration table |
| 4 | Scans | Up to 16 scan cards with C-Scan/A-Scan uploads |
| 5 | Remarks | Notes and observations |

## Key Domain Concepts

### Part Types (Geometries)

Common domain types (exact names may live in `shared/`):

- Flat plate / block
- Cylinder (solid)
- Tube (OD, ID, wall thickness)
- Rectangular tube (hollow sections)
- I / L / U profiles (structural shapes)
- Custom geometry (with image / drawing upload)

### Scanning Directions (A–L)

Up to 12 scan directions based on geometry:

- A–D: Primary axial/radial directions
- E–H: Angled beam directions (e.g. 45°, 60°)
- I–L: Special / additional directions for complex geometries

### Acceptance Classes (AMS-STD-2154) – examples

| Class | Description | Typical Use |
|-------|-------------|-------------|
| AAA | Most stringent | Critical flight components |
| AA | Very stringent | Primary structure |
| A | Stringent | Secondary structure |
| B | Standard | General aerospace |
| C | Least stringent | Non-critical parts |

### Material Properties

Defined under `standards/` (e.g. `standards/materials/`):

- `velocity` (m/s) – longitudinal wave velocity
- `impedance` (MRayl) – acoustic impedance
- `specifications` – AMS / ASTM references

---

## Critical Business Rules

### UT Standards Compliance

1. FBH sizes must match AMS-STD-2154 tables for the selected acceptance class.
2. Frequency selection trades off resolution vs penetration – do not silently change default frequencies.
3. Scan index must provide at least the required coverage (e.g. ~50% overlap or as per spec).
4. Calibration blocks should use the same material (or acoustically equivalent) as the test part.

### Geometry Calculations

1. For circular parts, always respect: `wall = (OD - ID) / 2`.
2. Near-surface zones (first few millimetres) may require special handling/notes.
3. For curved surfaces, consider beam spread and divergence; do not oversimplify coverage.

### Auto-fill Logic (Acceptance Criteria)

When acceptance class is selected:

1. Read data from `standards/` (AMS, TUV, etc.).
2. Auto-populate FBH sizes, sensitivity levels, rejection thresholds.
3. Show warnings for special materials (e.g. titanium) where extra checks apply.

---

## Code Conventions

### TypeScript

- Strict TypeScript.
- Prefer `interface` for objects, `type` for unions and composition.
- Use Zod (`drizzle-zod`, `zod`) for runtime validation where needed.
- All API responses and main domain objects must be typed.

### React Components

- Functional components only.
- Use shadcn/ui patterns + Radix primitives for UI consistency.
- Co-locate component-specific hooks with the component when reasonable.
- Use a `cn()` utility for conditional Tailwind classNames.

### State Management

- React Query for server state (API data, caching).
- Local React state/context for UI state.
- Do not add extra global state libraries without explicit decision.

### File Naming

- Components: `PascalCase.tsx`
- Hooks: `use-kebab-case.ts`
- Utils: `kebab-case.ts`
- Types: `kebab-case.types.ts`

---

## Testing Guidelines

There is currently no standardised test suite wired into `package.json`.

When adding tests:

1. Propose a test framework (e.g. Vitest / Jest / Playwright) and script name.
2. Ask before editing `package.json` and setting up the test runner.
3. Focus tests on:
   - UT standard calculations (FBH, acceptance criteria).
   - Geometry math (OD/ID/thickness, scan coverage).
   - Auto-fill logic for acceptance classes.
   - Drawing/dimension generation correctness.

Place tests in:

- `__tests__/` folders or `*.test.ts` files near the code, based on whatever pattern is introduced first.

---

## Common Tasks

### Adding a New Part Type

1. Add the type to the central domain types in `shared/` (e.g. `PartType` union).
2. Extend the Zod schema(s) in `shared/` for that geometry.
3. Add or update 3D model / viewer components in `src/` (3D area).
4. Add drawing generator logic in `drawing-engine/`.
5. Update scan direction logic/hooks and UI forms accordingly.

### Adding or Updating a Standard

1. Add or update data files under `standards/` (new folder per standard if needed).
2. Type them properly in a dedicated TypeScript module.
3. Update any services in `server/` that read these standards.
4. Ensure auto-fill / validation hooks on the frontend use the new data.

---

## Performance Considerations

- 3D viewer components should use `React.memo`, `useMemo` and `useCallback` where needed.
- Large tables should be virtualised (TanStack Virtual or similar) when implemented.
- CAD and heavy drawing work should run in background tasks (`tasks/`, workers) rather than blocking the UI.
- PDF generation and large exports should avoid blocking the main React thread.

---

## Environment Variables (examples)

```env
DATABASE_URL=           # PostgreSQL connection string
SUPABASE_URL=           # Supabase project URL
SUPABASE_ANON_KEY=      # Supabase anonymous key
VITE_API_URL=           # API base URL for frontend
CAD_WORKER_THREADS=     # Number of CAD worker threads (default: 2)
```

---

## Feature Status Checklist

> **This checklist is for planning and tracking only.**
> It does NOT mean all features already exist. Do not assume implementation
> unless the status is explicitly marked as ✅ and verified in the code.

**Instructions**: Update status after testing each feature.

- ✅ Working
- ❌ Not working / Missing
- 🔧 Needs improvement (add note)
- ⏳ Not tested yet

### Mode 1: TECHNIQUE SHEET

#### Tab 1: Setup

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1.1 | Part Number / Part Name | ⏳ | |
| 1.2 | Material Selection | ⏳ | |
| 1.3 | Material Specification | ⏳ | |
| 1.4 | Material Properties (Velocity, Impedance) | ⏳ | |
| 1.5 | Part Type Selector (icons) | ⏳ | |
| 1.6 | Custom Geometry (image + dimensions) | ⏳ | |
| 1.7 | Part Dimensions (thickness, length, width) | ⏳ | |
| 1.8 | Circular Dimensions (OD/ID/wall) | ⏳ | |
| 1.9 | Smart Recommendations (AI) | ⏳ | |

#### Tab 2: Scan Details

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 2.1 | 3D Inspection Plan Preview | ⏳ | |
| 2.2 | 12 Scanning Directions (A-L) table | ⏳ | |

#### Tab 3: Technical Drawing

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 3.1 | Export PNG/SVG/DXF/PDF | ⏳ | |
| 3.2 | Scan Coverage Toggle | ⏳ | |
| 3.3 | Multi-view Drawing (Front/Top/Side/Iso) | ⏳ | |
| 3.4 | ISO 128 Line Standards | ⏳ | |

#### Tab 4: Equipment

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 4.1 | Equipment Info (manufacturer, model, serial) | ⏳ | |
| 4.2 | Frequency Selection (smart recommendation) | ⏳ | |
| 4.3 | Transducer Settings (type, element diameter) | ⏳ | |
| 4.4 | Couplant & Linearity | ⏳ | |
| 4.5 | Resolution (auto-calculated) | ⏳ | |

#### Tab 5: Reference Standard (Calibration)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 5.1 | FBH Drawing (ASTM E127) | ⏳ | |
| 5.2 | Angle Beam Drawing (circular geometries) | ⏳ | |
| 5.3 | FBH Holes Table (dropdowns) | ⏳ | |
| 5.4 | 3D Block Preview | ⏳ | |
| 5.5 | Block Catalog | ⏳ | |
| 5.6 | Block Settings (material, dimensions, serial, cal date) | ⏳ | |
| 5.7 | CAD Integration (STEP export) | ⏳ | |

#### Tab 6: Scan Parameters

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 6.1 | Scan Method (Immersion/Contact/Squirter) | ⏳ | |
| 6.2 | Scan Type (Manual/Semi-Auto/Fully Auto) | ⏳ | |
| 6.3 | Speed & Index & Coverage | ⏳ | |
| 6.4 | Water Path (Immersion only) | ⏳ | |
| 6.5 | PRF, Gain, Gates | ⏳ | |

#### Tab 7: Acceptance Criteria

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 7.1 | Acceptance Class (AAA/AA/A/B/C) | ⏳ | |
| 7.2 | Auto-filled Criteria | ⏳ | |
| 7.3 | Material Warnings (titanium) | ⏳ | |
| 7.4 | Special Requirements | ⏳ | |

#### Tab 8: Documentation

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 8.1 | Inspector Info (name, cert, level) | ⏳ | |
| 8.2 | Inspection Details (date, procedure, drawing) | ⏳ | |
| 8.3 | Level III Approval | ⏳ | |

---

### Mode 2: INSPECTION REPORT

#### Tab 1: Cover Page

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| R1.1 | Document Info (number, revision) | ⏳ | |
| R1.2 | Customer Info (customer, PO, description) | ⏳ | |
| R1.3 | Sample Details (serial numbers, quantity) | ⏳ | |
| R1.4 | Testing Details (scan type, equipment, TCG) | ⏳ | |
| R1.5 | Results (observations, Accept/Reject) | ⏳ | |

#### Tab 2: Part Diagram

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| R2.1 | Generate Drawing (auto) | ⏳ | |
| R2.2 | Upload Drawing | ⏳ | |
| R2.3 | Export DXF | ⏳ | |

#### Tab 3: Probe Details

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| R3.1 | Probe Table (all columns) | ⏳ | |

#### Tab 4: Scans (up to 16)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| R4.1 | Scan Cards (expandable) | ⏳ | |
| R4.2 | C-Scan Upload | ⏳ | |
| R4.3 | A-Scan Upload | ⏳ | |

#### Tab 5: Remarks

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| R5.1 | Remarks Management (add/delete) | ⏳ | |

---

### General Features (All Modes)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| G1 | 3D Part Viewer (sidebar) | ⏳ | |
| G2 | Completion Gauge (liquid progress) | ⏳ | |
| G3 | Standard Selector | ⏳ | |
| G4 | Save/Load (DB) | ⏳ | |
| G5 | PDF Export | ⏳ | |
| G6 | Split Mode (Part A/B) | ⏳ | |
| G7 | TUV Export | ⏳ | |

---

## Known Issues & Tech Debt

1. Drawing engine needs DXF export improvement (line weights)
2. Some scan directions not fully implemented for I/L/U profiles
3. TUV export format needs validation against latest spec
4. Mobile responsiveness incomplete on Scan Details tab

---

## Related Documentation (in repo)

- [AUTO_FILL_DOCUMENTATION.md](docs/AUTO_FILL_DOCUMENTATION.md) – Auto-fill logic details
- [TECHNIQUE_SHEET_ANALYSIS.md](TECHNIQUE_SHEET_ANALYSIS.md) – Technique sheet structure and domain rules
- [TUV_EXPORT_SYSTEM_README.md](TUV_EXPORT_SYSTEM_README.md) / [TUV_EXPORT_SYSTEM_ENHANCED_README.md](TUV_EXPORT_SYSTEM_ENHANCED_README.md) – TUV export formats
- [ROADMAP.md](docs/ROADMAP.md) – Feature roadmap and priorities
- [PRODUCTION_TO_INSTALLATION_GUIDE.md](docs/PRODUCTION_TO_INSTALLATION_GUIDE.md) – Deployment / installation flow
- `standards/` – UT standard reference data (AMS, ASTM, TUV, materials)
