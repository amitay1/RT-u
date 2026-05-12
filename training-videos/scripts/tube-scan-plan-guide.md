# Tube Scan Plan Guide — Normal Beam TCG Calibration (v4)

```
TITLE:        Tube Scan Plan Guide · Normal Beam TCG Calibration
ID:           tube-scan-plan-guide
SERIES:       Scan-Master In-App Help (Scan Plan tab)
DURATION:     540 seconds (9:00)
PREREQUISITE: Basic familiarity with the ScanMaster Wizard
APP CONTEXT:  Triggered from Scan Plan tab → Tube Scan Plan Guide button
SOURCE:       /public/documents/scan-plan-guide.pdf + Tube Scan Plan Guide.docx
LAST UPDATED: 2026-05-12 (v4 — round-3 refinements:
              • SetBasicParameters: 4-card single row, Water Path now amber-emphasised
              • RequiredEquipment: FBH bullet now reads "3/64 inch or as required"
              • SaveTCGSetup: rebuilt with real UPRDB Navigator screenshot
              • FinalChecklist: "FBH responses set to 80% FSH" (not "peaks")
              • NEW PointSequence (Set Point #1 / #2 / #3 cards)
              • NEW OptionalBackWallPoints (dedicated clip with back-wall A-scan))
```

> **Accuracy promise:** Every action and value matches the source PDF. **Pedagogical additions are marked `[ADDED]` so every claim is traceable.** v3 incorporates round-2 user feedback (re-ordering, intro/equipment/teach-in/basic-params/save-tcg explicit clips, text corrections).

---

## 1. ⭐ [ADDED] INTRO TITLE (0:00 - 0:08)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:00 | (sting) | `[ANIM]` `IntroTitle.mp4` |
| 0:02 | [confident] T-C-G Calibration for Normal Beam Inspection. | `[ANIM]` Main title appearing. |
| 0:05 | In this video, you will learn how to create, verify, and save a T-C-G setup in ScanMaster. | `[ANIM]` Subtitle reveal. |

---

## 2. ⭐ [ADDED] REQUIRED EQUIPMENT (0:08 - 0:32)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:08 | Before you start. Prepare six items. | `[ANIM]` `RequiredEquipment.mp4` |
| 0:12 | The ScanMaster system. A normal beam probe. A calibration block with at least three F-B-H reflectors. The correct material velocity for the material. A stable water path. And access to Teach In mode. | `[ANIM]` Six bullets appearing in sequence. |
| 0:28 | Once everything is ready — open the ScanMaster Wizard. | `[ANIM]` Closing line. |

---

## 3. ⭐ THREE FBH STANDARDS — LABELED (0:32 - 0:48)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:32 | On the calibration block — three F-B-H standards at different depths. We'll work from near to far. | `[ANIM]` `FBHLabels.mp4` — Hagit-block photo with Near / Middle / Far badges. |
| 0:42 | Standard one — near. Standard two — middle. Standard three — far. | `[CALLOUT]` Each badge appears in sync. |

---

## 4. ⭐ [ADDED] OPEN SCANMASTER → TEACH IN (0:48 - 1:05)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:48 | Open the ScanMaster Wizard. From the main menu — click Teach In. | `[ANIM]` `OpenScanMasterTeachIn.mp4` — zoom on the Teach In tile + arrow. |
| 1:00 | A new screen image appears. The INSTRUMENT window plus the Setup Toolbox dialog. | `[SCREEN]` `step-04-setup-toolbox-instrument.png` quickly cuts in. |

---

## 5. ⭐ [ADDED] SET BASIC PARAMETERS (1:05 - 1:35)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:05 | First — set the basic parameters. Four fields. | `[ANIM]` `SetBasicParameters.mp4` — Setup-Toolbox screenshot + four cards appearing. |
| 1:12 | One. Material velocity. From the material database — select the material you're inspecting. | `[CALLOUT]` Card 1 highlighted: "Material velocity · from the material database". |
| 1:20 | Two. Range. Set the range until you see the back wall. | `[CALLOUT]` Card 2 highlighted: "Range · until back wall is visible". |
| 1:26 | Three. Gain. Verify the response from the three-sixty-fourths-inch F-B-H. | `[CALLOUT]` Card 3 highlighted: "Gain · FBH response verified". |
| 1:32 | Four. Water path. Set seventy-six millimetres, or set the transducer-to-surface distance so the second front reflection does not appear between the first front and first back reflections. | `[CALLOUT]` Card 4 highlighted: "Water path · 76 mm · ±¼ inch". |

---

## 6. ⭐ [ADDED] CRITICAL WATER-PATH WARNING (1:35 - 1:55)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:35 | [serious] Important. | `[ANIM]` `WaterPathWarning.mp4` — amber warning card crash-in. |
| 1:39 | Keep the water path consistent — within plus or minus one quarter inch — during standardisation, initial scanning, and final evaluation. | `[CALLOUT]` Warning text appears. |
| 1:50 | Deviation beyond plus or minus a quarter inch requires re-standardisation. | `[CALLOUT]` Closing line in amber. |

---

## 7. ⭐ [ADDED] WHAT TCG ACTUALLY DOES — BEFORE / AFTER (1:55 - 2:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:55 | Before we set anything else — understand what T-C-G is solving. | `[ANIM]` `BeforeAfterTCG.mp4` |
| 2:02 | Before T-C-G — three identical flat-bottom holes, three different signal heights. Closer means stronger. Farther means weaker. | `[ANIM]` BEFORE side reveal. |
| 2:15 | After T-C-G — all F-B-H responses adjusted to eighty per cent F-S-H. One reference level. One pass-fail criterion. Across depth. | `[ANIM]` AFTER side reveal with cyan 80% line. |
| 2:27 | That is our goal. Let's build it. | `[CUT]` |

---

## 8. ⭐ [ADDED] VERIFY ACTIVE · VISIBLE · DRAG (2:30 - 2:50)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:30 | Inside the Setup Toolbox — click the T-C-G tab. The T-C-G table appears. | `[SCREEN]` Cursor click on TCG tab. |
| 2:38 | Before any other action — verify three checkboxes on the right side of the T-C-G tab. | `[ANIM]` `ActiveVisibleDrag.mp4` |
| 2:44 | [serious] Active. Visible. Drag. All three must be checked. If Drag is off — you cannot drag the yellow dots in the next steps. | `[CALLOUT]` Three checkboxes ticked. |

---

## 8.5 ⭐ [ADDED v4] THREE REFERENCE POINTS — PREVIEW (2:50 - 3:10)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:50 | The same action — repeated three times. | `[ANIM]` `PointSequence.mp4` — three Set Point cards. |
| 2:54 | Set Point one — near F-B-H at eighty per cent F-S-H. Set Point two — middle F-B-H at eighty per cent F-S-H. Set Point three — far F-B-H at eighty per cent F-S-H. | `[CALLOUT]` Three cards lighting up cyan. |
| 3:05 | Drag yellow dot. Eighty per cent F-S-H. Save. Three times. | `[CALLOUT]` Closing line. |

---

## 9. ⭐ DRAG YELLOW DOT TO FBH PEAK · 80% FSH — POINT #1 (3:10 - 4:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:10 | Move the probe to the first F-B-H — the near standard. | `[SCREEN]` Probe positioned over near hole. |
| 3:18 | On the A-scan, drag the yellow dot onto the response peak. | `[ANIM]` `DragAnd80FSH.mp4` — drag arrow demo. |
| 3:28 | Adjust the Gain so the F-B-H amplitude reaches eighty per cent F-S-H. As you turn Gain up, the trace rises. Stop when the peak touches the cyan reference line. | `[ANIM]` 80% FSH line + gain rising. |
| 3:45 | Save Point one. Click the save button on the toolbar setup. | `[SCREEN]` `step-10-tcg-list-one-node.png` + `toolbar-save-point-button.png` zoom. |
| 3:55 | Node one — locked. | `[CALLOUT]` "Point #1 saved · standard #1 @ 80% FSH" |

---

## 10. REPEAT FOR POINT #2 (3:40 - 4:20)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:40 | Move the probe to the second F-B-H — the middle standard. | `[SCREEN]` Probe over middle hole. |
| 3:48 | Drag the second yellow dot onto the new response peak. | `[ANIM]` `DragAnd80FSH.mp4` reused — drag arrow. |
| 3:58 | Adjust Gain so this peak also reaches eighty per cent F-S-H. | `[ANIM]` Gain readout + peak rises. |
| 4:09 | Save Point two. | `[SCREEN]` `step-11-tcg-list-two-nodes.png`. |
| 4:15 | Node two — locked. | `[CALLOUT]` "Point #2 saved". |

---

## 11. REPEAT FOR POINT #3 (4:20 - 5:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 4:20 | Move the probe to the third F-B-H — the far standard. | `[SCREEN]` Probe over far hole. |
| 4:28 | Drag the third yellow dot onto the response peak. | `[ANIM]` `DragAnd80FSH.mp4` reused. |
| 4:38 | Adjust Gain to eighty per cent F-S-H. | `[ANIM]` Gain + 80% FSH overlay. |
| 4:48 | Save Point three. | `[SCREEN]` `step-12-tcg-list-three-nodes-scroll.png`. |
| 4:54 | Node three — locked. Three reference points set. | `[CALLOUT]` "Point #3 saved · 3/3 reference points". |

---

## 12. SCROLL-BOX NOTE FROM THE MANUAL (5:00 - 5:15)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 5:00 | One detail from the guide. | `[TIP]` Pro-tip overlay. |
| 5:04 | With more than three segments — scroll boxes appear to the right of the segment list. The active segment is marked with an arrow next to its number. | `[SCREEN]` `step-12-note-scroll-boxes-text.png`. |

---

## 13. ⭐ [ADDED v4] OPTIONAL — BACK-WALL TCG POINTS — DEDICATED CLIP (5:15 - 5:50)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 5:15 | An optional step thirteen — for inspections that extend to full part depth. | `[ANIM]` `OptionalBackWallPoints.mp4` — dedicated clip with the real back-wall A-scan. |
| 5:22 | Add a T-C-G point on the back-wall response. | `[CALLOUT]` Big heading: "Add Back-Wall TCG Points". |
| 5:28 | Click the toolbar button to set the first point before the back-wall pulse. Then the second point after the back-wall pulse. | `[CALLOUT]` Bullet 1 reveals. |
| 5:38 | Create at least four points in total to define the T-C-G curve through the back-wall response. | `[CALLOUT]` Bullet 3 in amber (the "at least 4" rule). |
| 5:46 | Optional. Skip this step if your inspection only covers the F-B-H depth range. | `[TIP]` Skip line. |

---

## 14. ⭐ [ADDED] SAVE THE TCG SETUP (5:50 - 6:50)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 5:50 | Now save the T-C-G setup. Four clicks. | `[ANIM]` `SaveTCGSetup.mp4` |
| 5:55 | One — click the Files tab in the Setup Toolbox. | `[ANIM]` Step 1 reveal. |
| 6:02 | Two — under T-C-G, click Save. | `[ANIM]` Step 2 reveal. |
| 6:09 | Three — the U-P-R-D-B Navigator dialog opens. The default file path is displayed at the bottom. | `[ANIM]` Step 3 reveal. |
| 6:20 | Four — name the file. We recommend a naming convention that includes the probe type, the F-B-H size, and the date. For example — Normal Beam underscore T-C-G underscore three sixty-fourths F-B-H underscore today's date. Click Save. | `[ANIM]` Step 4 reveal + suggested file-name card. |
| 6:40 | T-C-G setup saved. | `[ANIM]` Green success stamp. |

---

## 15. ⭐ FINAL CHECKLIST (6:50 - 7:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 6:50 | Quick checklist before you run the inspection. | `[ANIM]` `FinalChecklist.mp4` |
| 6:54 | Teach In opened. Material velocity set. Range set. Water path kept within plus or minus a quarter inch. Three F-B-H responses set to eighty per cent F-S-H. Optional back-wall points added if needed. T-C-G setup saved. | `[ANIM]` Seven items checking off in green sequentially. |
| 7:20 | Your T-C-G is ready. Run the inspection. | `[CUT]` Closing card. |

---

## 16. CTA — SERIES CLOSER (7:30 - 8:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 7:30 | (silent breathing room — outro music swells) | `[ANIM]` Logo reveal with cyan accent. |
| 7:45 | If you need to recalibrate after a probe change, a material change, or any deviation in water path — return to step three. | `[CALLOUT]` "Re-calibrate: probe change · material change · water-path drift". |
| 8:00 | The full Scan Plan documentation is available in the Scan Plan tab. | `[CALLOUT]` "Full docs: Scan Plan tab in-app". |
| 8:10 | (logo holds, music tail) | `[ANIM]` Outro card sustain. |

---

## Source Citations (all from scan-plan-guide.pdf / Tube Scan Plan Guide.docx)

| Step in script | PDF/DOCX reference | Page in PDF |
|---|---|---|
| Title "Scan plan for Normal beam calibration" | Top of page 1 | p. 1 |
| Step 1 "TCG for Normal beam calibration" | Step 1 | p. 1 |
| Step 2 "≥3 FBH 3/64" dia · different distances" | Step 2 | p. 1 |
| Step 3 "Open scan master wizard and press Teach In" | Step 3 | p. 1 |
| Step 4 "Screen image will appear" | Step 4 | p. 1 |
| Step 5 "To create TCG" | Step 5 | p. 1 |
| Step 6 "Set all parameters · start from basic parameters" | Step 6 | p. 1 |
| Step 7 "Move to the Hagit calibration block" | Step 7 | p. 2 |
| Step 8 "Material velocity: (a) Range, (b) Gain, (c) Water path 76 mm" | Step 8 | p. 2 |
| Water-path note "second front must not appear between 1st front and 1st back" | Step 8c | p. 2 |
| Water-path consistency "±¼ inch" | Step 8c | p. 2 |
| Step 9 "≥3 FBH 3/64 dia · AMS STD E2154 (ASTM E127)" | Step 9 | p. 2 |
| Step 10a "Drag yellow dot · Gain → FBH @ 80% FSH" | Step 10a | p. 2 |
| Step 10b "Save first point on toolbar setup" | Step 10b | p. 2 |
| Step 11 "Second standard · 80% FSH · save" | Step 11 | p. 3 |
| Step 12 "Higher standard · 80% FSH · save" | Step 12 | p. 3-4 |
| Step 12 note "Scroll boxes when >3 segments · arrow marks active" | Inline note | p. 4 |
| Step 13 "Optional back-wall TCG · 80% FSH" | Step 13 | p. 4 |
| Step 13a "First point before back-wall · second after" | Step 13a | p. 4 |
| Step 13b "≥4 points to set back-wall TCG curve" | Step 13b | p. 4-5 |
| Step 13.1 "Files → TCG → Save · UPRDB Navigator dialog" | Step 13.1 | p. 5 |

### ⭐ [ADDED] Pedagogical material — NOT in source, added for video clarity

| Addition | Why it's needed | Risk? |
|---|---|---|
| Intro title card (Section 1) | Round-2 feedback #1 — give viewer a frame before screens | None — orientation only. |
| Required Equipment list (Section 2) | Round-2 feedback #2 — what to prepare | None — preparation prompt. |
| FBH labels Near/Middle/Far (Section 3) | Round-1 feedback #7 — disambiguate the block photo | None — labelling existing positions. |
| Open ScanMaster → Teach In clip (Section 4) | Round-2 feedback #3 — explicit navigation step | None — purely navigation. |
| Set Basic Parameters break-down (Section 5) | Round-2 feedback #4 — explain each field | None — explains existing step 8. |
| Water-path warning card (Section 6) | Round-1 feedback #8 — amplifies a PDF note | None — verbatim from PDF Step 8c. |
| Before/After TCG concept (Section 7) | Round-1 feedback #1 — explain the goal | None — explains existing behaviour. |
| Active/Visible/Drag callout (Section 8) | Round-1 feedback #3 — without Drag step 10 fails | None — verifying defaults. |
| 80% FSH cyan reference line overlay (Sections 9-11) | Round-1 feedback #5 — visual target | None — 80% is verbatim from PDF. |
| Drag-arrow visual overlay (Sections 9-11) | Round-1 feedback #4 — illustrate the user action | None — visualises existing step. |
| Gain-adjustment narration (Sections 9-11) | Round-1 feedback #6 — explain the verb | None — adds context to "set Gain". |
| Save TCG setup explicit clip (Section 14) | Round-2 feedback #5 — make save procedure visible | None — visualises step 13.1. |
| Suggested file name convention (Section 14) | Round-1 feedback #9 — naming guidance | None — best-practice suggestion. |
| Final checklist (Section 15) | Round-1 feedback #10 — memory aid | None — recap of existing steps. |
| Re-calibrate triggers (Section 16) | Round-2 best practice — when to repeat | None — operational best practice. |

### v3 text corrections (round-2 feedback)

| Was | Now | Reason |
|---|---|---|
| "All three peaks at 80% FSH" (Before/After) | "All FBH responses adjusted to 80% FSH" | Round-2 — more precise: not every peak is an FBH. |
| "Drift beyond ±¼ inch = calibration invalid" (Water-path) | "Deviation beyond ±¼ inch requires re-standardization" | Round-2 — professional tone, less dramatic. |
| "Water path confirmed (±¼ inch)" (Checklist) | "Water path kept within ±¼ inch" | Round-2 — emphasises consistency over confirmation. |

### v4 refinements (round-3 feedback)

| Change | Reason |
|---|---|
| SetBasicParameters → 4-card single row (was 2×2 with overlap) | Round-3 #1 — Water Path card now clearly visible, amber-emphasised |
| RequiredEquipment FBH bullet → "≥3 FBH reflectors, 3/64 inch or as required" | Round-3 #2 — explicit FBH size |
| SaveTCGSetup → real screenshot of Files tab + UPRDB Navigator on left, 4-step list on right | Round-3 #3 — visual reference, not just text |
| FinalChecklist → "Three FBH responses set to 80% FSH" (was "peaks") | Round-3 #4 — FBH-specific wording |
| **NEW PointSequence scene** — Set Point #1 / #2 / #3 cards before Step 10 | Round-3 #6 — makes the repetition explicit |
| **NEW OptionalBackWallPoints scene** — dedicated clip with back-wall A-scan + 3 bullet rules | Round-3 #5 — back-wall step now stands as its own moment, not buried in checklist |

> Every addition is verifiable against the PDF. Nothing in v3 contradicts the source.

---

## Production notes

**Voice direction (ElevenLabs):**
- Voice: Adam (locked — `pNInz6obpgDQGcFmaJgB`)
- Stability 0.45 / Similarity 0.75 / Style 0.30 / Speed 1.0
- Pace: ~150 WPM

**Total word count target:** ~1275 words (8:30 × ~150 WPM)

**Animations (in `training-videos/assets/tube-scan-plan/animations/`):**
1. `IntroTitle.mp4` (0:00-0:08)
2. `RequiredEquipment.mp4` (0:08-0:32)
3. `FBHLabels.mp4` (0:32-0:48)
4. `OpenScanMasterTeachIn.mp4` (0:48-1:05)
5. `SetBasicParameters.mp4` (1:05-1:35)
6. `WaterPathWarning.mp4` (1:35-1:55)
7. `BeforeAfterTCG.mp4` (1:55-2:30)
8. `ActiveVisibleDrag.mp4` (2:30-2:50)
9. `DragAnd80FSH.mp4` (2:50-3:22) — reused at 3:48-4:09 + 4:28-4:48
10. `SaveTCGSetup.mp4` (5:50-6:50)
11. `FinalChecklist.mp4` (6:50-7:30)

**Static screenshots:** from `training-videos/assets/tube-scan-plan/` (step-XX-*.png + toolbar-save-point-button.png).

**Captions:**
- Auto-Whisper. Hand-correct: "TCG", "FBH", "FSH", "AMS STD E2154", "ASTM E127", "UPRDB", "Hagit", "3/64".

---

## QA checklist for v3

- [x] All 10 round-1 feedback items still integrated
- [x] All 5 round-2 missing-clip items now built and placed
- [x] All 3 round-2 text corrections applied (Before/After / Water-path / Checklist)
- [x] Scene order matches user's recommended order exactly
- [x] Every action and value remains verbatim from the source PDF
- [x] Citations table complete
- [x] All animations rendered + verified
- [ ] User verifies v3 against the PDF + signs off
