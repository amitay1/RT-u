# Scan-Master - Quick Context

> NDT (Non-Destructive Testing) app for ultrasonic inspection planning and documentation.
> Generates: Technique Sheets, Inspection Reports, Technical Drawings (CAD/DXF).

---

## Tech Stack (One Glance)

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui (Radix) |
| State | React Query (server) + React Context (UI) |
| 3D | Three.js + @react-three/fiber + drei |
| Backend | Express 5 + tsx (Node.js) |
| Database | PostgreSQL + Drizzle ORM + Supabase |
| CAD | @jscad/modeling, makerjs, paper |
| Export | jsPDF, docx (Word) |
| Desktop | Electron |

**No Zustand/Redux** - use React Context only.

---

## Project Structure

```
src/                  # React frontend
  components/tabs/    # Main UI tabs (14 tab components)
  contexts/           # React contexts (6 contexts)
server/               # Express API
shared/               # Domain types + Drizzle schema
drawing-engine/       # 2D technical drawings (SVG/DXF)
standards/            # UT standard data (AMS, ASTM, TUV)
electron/             # Electron main process
tasks/                # Background workers (CAD, PDF)
```

---

## 2 App Modes

### Mode 1: Technique Sheet (8 Tabs)
1. **Setup** - Part info, material, geometry
2. **Scan Details** - 3D preview, 12 scan directions (A-L)
3. **Technical Drawing** - Multi-view export (PNG/SVG/DXF/PDF)
4. **Equipment** - Transducer, frequency, couplant
5. **Reference Standard** - Calibration block, FBH table
6. **Scan Parameters** - Method, speed, index, gates
7. **Acceptance Criteria** - Class (AAA/AA/A/B/C), auto-fill
8. **Documentation** - Inspector info, approvals

### Mode 2: Inspection Report (5 Tabs)
1. **Cover Page** - Document info, customer, results
2. **Part Diagram** - Drawing upload/generate
3. **Probe Details** - Probe configuration table
4. **Scans** - Up to 16 scan cards with C-Scan/A-Scan uploads
5. **Remarks** - Notes and observations

---

## Key Domain Concepts

### Part Types
Flat plate, Cylinder, Tube, Rectangular tube, I/L/U profiles, Custom

### Scanning Directions (A-L)
- A-D: Primary axial/radial
- E-H: Angled beam (45, 60)
- I-L: Special directions

### Acceptance Classes (AMS-STD-2154)
| Class | Use |
|-------|-----|
| AAA | Critical flight components |
| AA | Primary structure |
| A | Secondary structure |
| B | General aerospace |
| C | Non-critical parts |

---

## Database Schema (Main Tables)

```typescript
organizations    // Multi-tenant support
profiles         // Inspector profiles (name, cert, signature)
techniqueSheets  // Technique sheet JSON data
standards        // UT standards catalog
userStandardAccess // License/access control
```

---

## Commands

```bash
npm run dev          # Development (server + client)
npm run build        # Production build
npm run lint         # ESLint
npm run db:push      # Drizzle schema push
npm run electron:dev # Electron dev mode
npm run dist:win     # Build Windows installer
```

---

## Key Files

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Drizzle DB schema + Zod validation |
| `src/components/tabs/*.tsx` | Main tab UI components |
| `src/contexts/*.tsx` | React contexts (Settings, License, Profile) |
| `server/index.ts` | Express server entry |
| `drawing-engine/` | Technical drawing generation |
| `standards/` | UT standard reference data |

---

## Critical Rules

1. **FBH sizes** must match AMS-STD-2154 tables for acceptance class
2. **Circular geometry**: `wall = (OD - ID) / 2`
3. **Calibration blocks** use same material as test part
4. **Auto-fill** reads from `standards/` folder
5. **Never add packages** without confirmation
6. **Run `npm run lint`** after changes

---

## Related Docs (in repo)

- `CLAUDE.md` - Full project guidelines
- `docs/AUTO_FILL_DOCUMENTATION.md` - Auto-fill logic
- `TECHNIQUE_SHEET_ANALYSIS.md` - Domain rules
- `docs/ROADMAP.md` - Feature priorities
