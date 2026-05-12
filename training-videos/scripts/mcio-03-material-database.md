# MCI/O Video #3 — Material Database & Velocity Calculation

```
TITLE:        MCI/O #3 — Material Database & Velocity Calculation
ID:           mcio-03
SERIES:       MCI/O Software Training
DURATION:     270 seconds (4:30)
PREREQUISITE: mcio-02
TABS LINKED:  InspectionSetupTab, CalibrationTab
SOURCE:       MCI/O Manual, GB50010130, v3.11
              · Chapter 5.3   (Working with the Material Dialog Boxes)
              · Chapter 5.3.1 (Editing the Material Database — Adding / Editing / Deleting)
              · Chapter 5.3.2 (Calculating Material Velocity / Sample Thickness)
LAST UPDATED: 2026-05-12
```

> **Accuracy:** Names, fields, and procedures all from the manual. Citations at the bottom.

---

## 1. COLD OPEN (0:00 - 0:08)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:00 | (silence) | `[SCREEN]` Material velocity dialog box, listing materials in alphabetical order. |
| 0:04 | Your material isn't in the list. You need to add it. Or your velocity is wrong. You need to fix it. | `[ANIM]` Red highlight over a hypothetical missing material. |
| 0:07 | Both, here. | `[CUT]` Title card. |

---

## 2. TITLE + GOAL (0:08 - 0:25)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:08 | (sting + music in) | `[ANIM]` "MCI/O Training · Video 3 · Material Database & Velocity Calculation" |
| 0:13 | You'll add a new material, edit an existing one, delete one, and calculate a velocity from a known sample thickness. | `[ANIM]` Four bullets: "Add · Edit · Delete · Calibrate". |
| 0:22 | All from the Material dialog boxes inside the Timebase tab. | `[SCREEN]` Cursor highlights the **Material frame** on the right of the Timebase tab. |

---

## 3. OPENING THE DATABASE (0:25 - 0:45)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:25 | From the right side of the Timebase tab, under Material, click Edit. | `[SCREEN]` Cursor moves to right side, under Material section, clicks **Edit** button. |
| 0:32 | The New Material dialog box appears. | `[SCREEN]` New Material dialog opens, showing alphabetised list. |
| 0:37 | Every material in the current database, with velocity columns in millimetres per microsecond and inches per microsecond. | `[HIGHLIGHT]` Two velocity columns visible. `[CALLOUT]` "Columns: mm/μs · inch/μs". |

---

## 4. ADDING A MATERIAL (0:45 - 1:35)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:45 | Adding a material. Five steps. | `[ANIM]` "ADD · 5 STEPS" title. |
| 0:50 | One. Select the material that you want to be listed immediately before the new one, then click New. | `[SCREEN]` Cursor selects "Steel". Clicks **New** button. |
| 1:00 | Two. A blank row appears after the material you selected. In the Material column, enter the name of the new material. | `[SCREEN]` New blank row appears. Cursor types "Titanium Ti-6Al-4V". |
| 1:11 | Three. In the blank row, double-click a field under one of the velocity columns. A velocity field and combo buttons appear. | `[SCREEN]` Cursor double-clicks the mm/μs cell. Combo buttons appear. |
| 1:20 | Four. Use the combo buttons or type a value, then press Enter. The other velocity column auto-calculates. | `[SCREEN]` Cursor types "6.1", presses Enter. inch/μs column auto-populates. |
| 1:30 | Five. From the bottom of the dialog, click Save. | `[SCREEN]` Cursor clicks **Save**. Dialog closes. |

---

## 5. EDITING A MATERIAL (1:35 - 2:05)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:35 | Editing — two paths. | `[ANIM]` "EDIT" title. |
| 1:39 | To change the name. Double-click the Material column field. A cursor appears. Type your changes. | `[SCREEN]` Double-click on a material name, edit text. |
| 1:48 | To change the velocity. Double-click a velocity column field. The value highlights blue, combo buttons appear. Type or click the new value, press Enter. The other column auto-calculates. | `[SCREEN]` Cursor edits velocity, other column updates. |
| 2:00 | Click Save to commit. | `[SCREEN]` Save button. |

---

## 6. DELETING A MATERIAL (2:05 - 2:25)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:05 | Deleting. | `[ANIM]` "DELETE" title. |
| 2:08 | From the right side of the Timebase tab, under Material, click Edit. | `[SCREEN]` Repeat Edit click. |
| 2:14 | Select the material to delete. Click Delete. The row disappears. | `[SCREEN]` Cursor selects, clicks **Delete**. Row vanishes. |
| 2:20 | Click Save. The material is gone from the database. | `[SCREEN]` Save. Confirmation. |

---

## 7. CALIBRATING VELOCITY FROM A KNOWN THICKNESS (2:25 - 3:35)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:25 | The real magic. Calculate a material's velocity from a known sample thickness. | `[ANIM]` "VELOCITY CALIBRATION" title. |
| 2:32 | From the right side of the Timebase tab, under Material, click Cal. The Material Velocity / Thickness Calibration dialog opens. | `[SCREEN]` Cursor clicks **Cal**. Calibration dialog appears. |
| 2:42 | At the top, select the Velocity radio button. The Velocity field at the bottom becomes disabled — the system will calculate it. | `[HIGHLIGHT]` Velocity radio button. Velocity field greys out. |
| 2:52 | Set six fields. | `[ANIM]` Six fields listed. |
| 2:55 | Gate number — first and second gates used for the calculation. | `[SCREEN]` First Gate dropdown, Second Gate dropdown. |
| 3:01 | Offset — only when using a single gate, leave zero for two-gate calibration. | `[HIGHLIGHT]` Offset field. |
| 3:08 | Mult, short for Multiple — the number of multiple signals between the gate pair. | `[HIGHLIGHT]` Mult field. |
| 3:14 | Average — the number of pulses to average. Standard calibration is one. | `[HIGHLIGHT]` Average field. |
| 3:19 | Material — pick from the database. | `[HIGHLIGHT]` Material dropdown. |
| 3:23 | Thickness — the measured thickness of the sample. | `[HIGHLIGHT]` Thickness field. Cursor types "25.4". |
| 3:29 | Click Cal. The calculated material velocity appears in the Velocity field. | `[SCREEN]` Cursor clicks **Cal**. Velocity field populates. |
| 3:33 | Click Save to write the new velocity back to the database. | `[SCREEN]` Save click. |

---

## 8. CALIBRATING THICKNESS FROM A KNOWN VELOCITY (3:35 - 3:55)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:35 | The mirror operation. Calculate thickness from a known velocity. | `[ANIM]` "THICKNESS CALIBRATION" title. |
| 3:42 | Same dialog. Same six fields. But at the top, select the Thickness radio button. The Thickness field disables. | `[HIGHLIGHT]` Thickness radio button. |
| 3:50 | Click Cal. Thickness appears. | `[SCREEN]` Calculation result. |

---

## 9. ACCURACY TIP FROM THE MANUAL (3:55 - 4:15)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:55 | One technique to get the most accurate calibration. | `[TIP]` Pro-tip overlay. |
| 4:00 | When distinct multiple signals are available — for example, multiple backwall echoes — increase the range between them. | `[ANIM]` A-scan with first and third backwall highlighted. |
| 4:08 | Calibrating between a first and third backwall produces a more accurate result than between a first and second. | `[CALLOUT]` "Wider gate spread = higher resolution". |

---

## 10. RECAP + CTA (4:15 - 4:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 4:15 | Quick recap. Add, edit, and delete materials from the Material dialog box. Calibrate velocity or thickness with the Material Velocity / Thickness Calibration dialog. Widen your gate spread for better calibration resolution. | `[ANIM]` Three bullets. |
| 4:25 | Next — receiver and pulser basics. Picking the right inspection mode, frequency, and pulse settings. | `[CUT]` Next-video card: "MCI/O #4 — Receiver + Pulser Basics". |

---

## Source Citations

| Script line | Manual section | Page |
|-------------|----------------|------|
| Material dialog boxes are accessed from Timebase tab Material frame | §5.3 | 5-39 |
| New Material dialog box lists materials alphabetically, velocity in mm/μs and inch/μs | §5.3.1 | 5-39 |
| Five-step Adding procedure | §5.3.1 Adding a Material | 5-40 |
| Auto-calculation of corresponding velocity column | §5.3.1 (5) | 5-41 |
| Editing material name and velocity | §5.3.1 Editing a Material | 5-42 |
| Deleting material procedure | §5.3.1 Deleting a Material | 5-43 |
| Material Velocity / Thickness Calibration dialog accessed via Cal button | §5.3.2 | 5-44 |
| Six fields: Gate number, Offset, Mult, Average, Material, Thickness | §5.3.2 | 5-45 |
| Offset only for single-gate calibration | §5.3.2 (Offset note) | 5-45 |
| Average — standard calibration requires one pulse | §5.3.2 (Average note) | 5-45 |
| "Calibrating between a first and third backwall produces a more accurate result" | §5.3.2 (Mult note) | 5-45 |
| Thickness from known velocity — Thickness radio button, Thickness field disables | §5.3.2 | 5-46 |

---

## Production notes

**Voice:** Adam locked. 155 WPM. Pronunciations: "mm/μs" → "millimetres per microsecond"; "inch/μs" → "inches per microsecond"; "Cal" → "cal" (one syllable, like calorie); "Mult" → "mult" (one syllable).

**Word count target:** ~700 words.

**Required PDF figures:** Timebase tab with Material frame, New Material dialog box, Material Velocity/Thickness Calibration dialog box (both Velocity and Thickness modes).

**Captions:** Auto-Whisper, hand-correct: "Mult", "Cal", "mm/μs", "inch/μs".

---

## QA checklist

- [x] Every fact in citations table
- [x] No invented fields or buttons
- [x] Six calibration fields named exactly as manual
- [x] Word count: ~700
- [ ] User verified against PDF
