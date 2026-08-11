# DR Technique — Developer Handoff (Remaining Gaps)

**Product:** Scan-Master RT/PT — Radiographic Technique Card
**Mode affected:** `RT-Digital` (Digital Radiography / DDA) only. **Do not touch `RT-Film` or `PT`.**
**Branch:** `rt-pt-replacement`
**Baseline commit:** `a1484ba feat(rt-pt): add digital radiography planning workflow`
**Date:** 2026-08-11

---

## 0. Context — what is already implemented

The DR restructure requested by the NDT Level III has already been implemented. Verified in code:

| Requirement | Status | Where |
|---|---|---|
| Tab renamed `General` → `Part & Inspection Definition` | Done | `src/components/RtPtWorkspace.tsx:85` |
| `Exposure Defaults` tab removed from DR (kept only in RT-Film) | Done | `src/components/RtPtWorkspace.tsx:85-95` |
| `Engineering Geometry` tab (`Geometry & Coverage`) | Done | `RtDigitalEngineeringTab.tsx` |
| New `Interpretation Plan` tab (`Interpretation Areas`) | Done | `RtDigitalInterpretationTab.tsx` |
| Thickness Definition — Single / Range / Multiple Zones | Done | `src/types/rtDigital.ts:164-191` |
| Manufacturing Process, Part Geometry, Part Dimensions per geometry | Done | `src/types/rtDigital.ts:91-162` |
| Wall Technique / Image Technique | Done | `src/types/rtDigital.ts:209-213` |
| Source + Detector + IQI-rule catalogs with immutable revision snapshots | Done | `src/hooks/useRtDigitalCatalog.ts` |
| Focal spot as catalog combo (not free text) | Done | `RtDigitalExposureTab.tsx` |
| Auto calculations: SDD/SOD/ODD, M, Ug, min SOD, max ODD, effective pixel, FOV, exposure counts, overlap, underlap | Done | `src/lib/rtDigitalPlanning.ts:86-150` |
| Detector orientation Portrait/Landscape auto-optimize | Done | `rtDigitalPlanning.ts:547` |
| Level III override with calculated value / approved value / reason / approver | Done | `src/types/rtDigital.ts:454-462` |
| Per-thickness-zone IQI outputs + governing zone | Done | `src/types/rtDigital.ts:401-421` |
| Pre-approval completeness + engineering checks | Done | `src/lib/rtPtValidation.ts:1660-2092` |

**Three gaps remain.** They are specified below in priority order.

---

## Global constraints (apply to all three tasks)

1. **Schema version.** `RT_PT_DOCUMENT_VERSION = 3` (`src/types/rtPtDocument.ts:6`). Any change to the persisted
   document shape must be handled in `src/lib/rtPtDocumentCodec.ts`, which already carries `migrateV1` (line 2253)
   and `migrateV2` (line 2277). Decide with the product owner whether to bump to `4` + add `migrateV3`, or to keep
   `3` and treat the new/removed fields as tolerant parse (see per-task notes).
2. **Approval fingerprints.** `createRtPtSha256Fingerprint` (`src/lib/rtPtFingerprint.ts:22`) hashes the canonical
   serialized document. **Changing the document shape changes the fingerprint of every previously approved card**
   and will invalidate existing Level III approvals. This must be a deliberate, communicated decision — coordinate
   with `src/lib/rtPtApprovalLifecycle.ts` and confirm the release note wording before merging.
3. **Every schema change must be reflected in four places**, or the build/tests will fail:
   `src/types/rtDigital.ts` → `src/lib/rtPtDocumentCodec.ts` → `src/lib/rtPtValidation.ts` →
   `src/utils/export/RtPtTechniquePDF.ts`, plus the fixtures in `src/lib/__tests__/rtPtV3Fixtures.ts`.
4. **Commands:** `npm run lint` and `npm test` must both pass. `npm run build` for anything touching the bundle.
5. **No new dependencies.** No new global state library. Follow existing shadcn/ui + `NumberField` / `TextField` /
   `SelectField` patterns used throughout `src/components/tabs/rt-digital/`.

---

## Task 1 — Remove the global Window/Level from the Processing tab

**Priority: High. This is a standards-correctness issue, not cosmetics.**

### Problem

A single radiograph can contain several thickness zones that require different viewing conditions. A single
technique-level Window Level / Window Width / Zoom is therefore misleading: it implies one viewing condition is
valid for the whole image. The Level III requirement is that viewing conditions live **per Interpretation Area**,
with a reusable **Viewing Preset Library** at technique level.

### Current state

- `src/components/tabs/rt-digital/RtDigitalImageProcessingTab.tsx:82-84` still renders technique-level
  `Window Level`, `Window Width`, `Zoom` inputs.
- The Viewing Preset Library **already exists** in the same tab (line 124) and writes to
  `planning.viewingPresets` (`RtDigitalViewingPreset`, `src/types/rtDigital.ts:423-433`).
- Per-area viewing conditions **already exist** on `RtDigitalInterpretationArea`
  (`src/types/rtDigital.ts:512-531`: `viewingPresetId`, `windowLevel`, `windowWidth`, `zoom`, `sharpness`,
  `permittedProcessing`, `lut`, `invert`).

So the destination already works. Only the obsolete global fields must go.

### Required change

Remove `windowLevel`, `windowWidth`, `zoom` from the technique-level `RtDigitalImageProcessing` interface
(`src/types/rtDigital.ts:590-597`). Keep `noiseReduction`, `contrastEnhancement`, `processingProcedure` —
these are genuinely technique-level policy.

The Processing tab must retain, per the Level III specification:

- Acquisition Software / Software Version (already on `RtDigitalSystem`: `softwareName`, `softwareVersion`)
- Permitted / Prohibited processing methods (`planning.processingPolicy`)
- Required Processing Procedure
- Raw image preservation + processed image saving rules (`displayAndStorage.rawDataPreservation`, `storageFormat`)
- Viewing Preset Library

### Files to change

| File | Change |
|---|---|
| `src/types/rtDigital.ts:590-597` | Drop the three fields from `RtDigitalImageProcessing`; update `createEmptyRtDigitalSheet` at line 885 |
| `src/components/tabs/rt-digital/RtDigitalImageProcessingTab.tsx:82-84` | Delete the three `NumberField`s |
| `src/lib/rtPtDocumentCodec.ts:1345` | Update `parseDigitalImageProcessing` |
| `src/lib/rtPtDocumentCodec.ts:2084-2094` | Legacy V1/V2 migration currently maps these three fields — decide the mapping (recommendation below) |
| `src/utils/export/RtPtTechniquePDF.ts:816-818` | Remove the `Planned Window Level` / `Window Width` / `Zoom` rows |
| `src/lib/__tests__/rtPtV3Fixtures.ts:731` | Update fixture |
| `src/lib/__tests__/rtPtDocumentCodec.test.ts:157` | Update fixture |

### Migration recommendation

Do **not** silently drop legacy values. In `migrateV1` / `migrateV2` and in any V3 document that still carries the
old fields, if any of the three legacy values is present, create **one** `RtDigitalViewingPreset` named
`"Legacy technique preset"` carrying those values and append it to `planning.viewingPresets`. This preserves the
engineering intent of already-approved historical cards and gives the Level III something to attach to an
Interpretation Area. Document this in the migration function with a comment.

### Validation

`src/lib/rtPtValidation.ts:1118` currently validates `technique.imageProcessing.processingProcedure` — that stays.
Add a check that **every Interpretation Area resolves to viewing conditions**: either a `viewingPresetId` pointing
at an existing preset, or explicit inline `windowLevel` + `windowWidth`. Follow the existing `addIssue(...)`
pattern with category `'processing'`.

### Acceptance criteria

- [ ] No technique-level Window/Level/Zoom input anywhere in DR mode.
- [ ] Viewing Preset Library still creates, edits and deletes presets.
- [ ] Each Interpretation Area can select a preset or override inline.
- [ ] A card cannot reach Level III approval with an Interpretation Area that has no viewing conditions.
- [ ] Exported PDF shows viewing conditions in the Interpretation Areas table, not as a global value.
- [ ] Opening a pre-change saved card produces a `Legacy technique preset` and loses no data.

---

## Task 2 — Inspection Area feature types

**Priority: Medium.**

### Problem

`RtDigitalInspectionAreaMode` (`src/types/rtDigital.ts:110`) only expresses *how many* areas exist
(`Entire Part` / `Defined Area` / `Multiple Areas`). The requested feature classification — Weld, Flange, Hub,
Boss, Other — is not modelled; it currently ends up as prose in the free-text `description`, so it cannot be
filtered, validated, or driven from a rule.

### Required change

Keep `RtDigitalInspectionAreaMode` exactly as it is — it is the cardinality selector and it is correct.
Add a **separate** classification field on each individual area.

```ts
// src/types/rtDigital.ts — new type
export type RtDigitalInspectionAreaFeature =
  | 'Weld'
  | 'Flange'
  | 'Hub'
  | 'Boss'
  | 'General Volume'
  | 'Other'
  | '';

// extend RtDigitalInspectionArea (src/types/rtDigital.ts:193-201)
export interface RtDigitalInspectionArea {
  id: string;
  areaId: string;
  feature: RtDigitalInspectionAreaFeature;   // NEW
  otherFeature: string;                       // NEW — required only when feature === 'Other'
  description: string;
  // ...unchanged
}
```

### Files to change

| File | Change |
|---|---|
| `src/types/rtDigital.ts:193-201` | Add the two fields; update the empty-area factory |
| `src/lib/rtPtDocumentCodec.ts` | Add `DIGITAL_INSPECTION_AREA_FEATURES` const next to `DIGITAL_INSPECTION_AREA_MODES` (line 114); parse with `enumField` |
| `src/components/tabs/rt-digital/RtDigitalGeneralTab.tsx:462-495` | Add a `SelectField` per area row; show `otherFeature` text input only when `Other` is selected |
| `src/lib/rtPtValidation.ts:1705-1712` | Add: feature is required for `Defined Area` / `Multiple Areas`; `otherFeature` must be filled when and only when `feature === 'Other'` (mirror the existing `otherManufacturingProcess` rule at line 1660) |
| `src/utils/export/RtPtTechniquePDF.ts` | Add a `Feature` column to the inspection-area table |
| `src/lib/__tests__/rtPtV3Fixtures.ts:298` | Update fixture |

### Notes

- `Entire Part` mode must **not** carry area records (already enforced at `rtPtValidation.ts:1705`) — so the
  feature field is simply not applicable in that mode.
- This is additive. A tolerant parse defaulting `feature` to `''` avoids a version bump; confirm with the
  product owner which route is taken and record it in the PR description.

### Acceptance criteria

- [ ] Each defined inspection area carries an explicit feature classification.
- [ ] `Other` requires free text; non-`Other` must leave it empty.
- [ ] Feature appears in the exported PDF.
- [ ] Existing saved cards open with `feature = ''` and are flagged as incomplete rather than crashing.

---

## Task 3 — Exposure patterns and `Superimposed` image technique

**Priority: Medium-Low.**

### 3a. Linear and Circular exposure patterns

**Current state.** The Exposure List (`RtDigitalAcquisitionPlanTab.tsx`) supports Add (line 77), Duplicate
(line 182), Move up/down (lines 186-205) and Delete (line 206). EXP identifiers are **already renumbered
automatically** into one ordered global sequence (`src/hooks/useRtDigitalState.ts:197-204`), so a manual
"Renumber" action is not needed.

A **Grid Pattern equivalent already exists**: `applyAutoExposureGrid` (`useRtDigitalState.ts:141`) commits the
calculated coverage grid from `createRtDigitalExposureGrid` (`src/lib/rtDigitalPlanning.ts:421`) into real
acquisitions, complete with placement, visual controls and governing IQI assignment.

**Missing:** Linear Pattern and Circular Pattern generators.

**Required change.** Add two generator functions in `src/lib/rtDigitalPlanning.ts` alongside
`createRtDigitalExposureGrid`, returning the same `RtDigitalExposureGridDescriptor[]` shape so the existing
commit path in `applyAutoExposureGrid` can be reused unchanged:

```ts
export function createRtDigitalLinearPattern(input: {
  start: { xMm: number; yMm: number };
  end: { xMm: number; yMm: number };
  count: number;
  footprintWidthMm: number;
  footprintHeightMm: number;
  orientation: 'Portrait' | 'Landscape';
}): RtDigitalExposureGridDescriptor[]

export function createRtDigitalCircularPattern(input: {
  center: { xMm: number; yMm: number };
  radiusMm: number;
  count: number;
  startAngleDegrees: number;
  sweepDegrees: number;      // 360 for a full revolution
  footprintWidthMm: number;
  footprintHeightMm: number;
  orientation: 'Portrait' | 'Landscape';
}): RtDigitalExposureGridDescriptor[]
```

Requirements:
- Respect `RT_DIGITAL_MAX_EXPOSURE_GRID_SIZE` (`rtDigitalPlanning.ts:18`).
- Circular pattern is the practical case for pipe/ring/cylinder geometry — the number of exposures should be
  validatable against the required overlap at the object surface, consistent with the existing coverage engine.
  If that consistency is not achievable in this pass, **emit an explicit warning** rather than silently
  reporting complete coverage.
- UI: two dialogs in `RtDigitalAcquisitionPlanTab.tsx` following the existing Add-exposure control style.
- Pure functions only, unit tested in `src/lib/__tests__/` (see `rtPtDigitalFoundation.test.ts` for the pattern).

### 3b. `Superimposed` image technique

`RtDigitalImageTechnique` (`src/types/rtDigital.ts:90`) is
`'SWSI' | 'DWSI' | 'DWDI' | 'Elliptical' | 'Other' | ''` — `Superimposed` is missing. The same value already
exists on the film side (`src/components/tabs/rt-film/RtFilmFilmSystemTab.tsx:93`) with a density rule at
`src/lib/rtPtValidation.ts:2349`.

**Before implementing, confirm with the NDT Level III** whether superimposed viewing is technically applicable
to DDA acquisition in this workflow, or whether it is a film-only concept. If confirmed:

| File | Change |
|---|---|
| `src/types/rtDigital.ts:90` | Add `'Superimposed'` to the union |
| `src/lib/rtPtDocumentCodec.ts:87` | Add to `DIGITAL_IMAGE_TECHNIQUES` |
| `RtDigitalGeneralTab.tsx` | Appears automatically if the select is driven from the type |
| `src/lib/rtPtValidation.ts` | Add the DR-specific rule the Level III defines for it |

### Acceptance criteria

- [ ] Linear and Circular pattern dialogs generate correctly numbered exposures with placement data.
- [ ] Generated exposures are indistinguishable in structure from grid-generated ones.
- [ ] Coverage/overlap is either validated for circular patterns or explicitly flagged as unvalidated.
- [ ] `Superimposed` is added only after Level III confirmation, with its validation rule.

---

## Suggested order

1. **Task 1** — highest standards impact, self-contained, touches the schema.
2. **Task 2** — additive, low risk, ship with Task 1 if the schema is being touched anyway (one migration,
   one fingerprint break, instead of two).
3. **Task 3a** — independent of the schema, can be done in parallel.
4. **Task 3b** — blocked on the Level III decision.

Tasks 1 and 2 should share a single PR and a single schema decision, to avoid invalidating approval
fingerprints twice.

---

## Definition of done

- `npm run lint` clean.
- `npm test` green (`vitest run` + `tsx --test server/rtptRoutes.test.ts`).
- `npm run build` succeeds.
- A card saved before the change opens without data loss, and the migration behaviour is covered by a test in
  `src/lib/__tests__/rtPtDocumentCodec.test.ts`.
- PDF export reviewed against a real technique card.
- PR description states explicitly whether `RT_PT_DOCUMENT_VERSION` was bumped and whether existing Level III
  approvals are invalidated.

---

## Out of scope

- RT-Film mode and PT mode — unchanged.
- Any change to the calculation formulas in `src/lib/rtDigitalPlanning.ts` (Ug, magnification, FOV, effective
  pixel size). They are implemented and verified; do not "improve" them.
- The Visual Planner interaction model (`RtDigitalVisualPlannerTab.tsx`).
- Any automatic interpretation of an acceptance requirement that is not an approved rule in the local catalog.
