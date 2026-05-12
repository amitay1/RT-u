# MCI/O Video #15 — Plate Flaw Detection (Appendix A.2)

```
TITLE:        MCI/O #15 — Plate Flaw Detection
ID:           mcio-15
SERIES:       MCI/O Software Training
DURATION:     270 seconds (4:30)
PREREQUISITE: mcio-14
TABS LINKED:  AcceptanceCriteriaTab, ScanParametersTab
SOURCE:       MCI/O Manual, GB50010130, v3.11
              · Appendix A
              · Chapter 14.2 (UT Setup for Flaw Detection)
LAST UPDATED: 2026-05-12
```

> **Accuracy:** Verbatim walkthrough of Appendix A.2. Same iron plate setup as Video #14, but tuned for finding defects instead of measuring thickness.

---

## 1. COLD OPEN (0:00 - 0:08)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:00 | (silence) | `[SCREEN]` Same 19 mm iron plate, but now showing a small defect indication between front wall and backwall. |
| 0:04 | [matter-of-fact] Thickness is one mission. Finding flaws is another. Same hardware, different setup. | `[ANIM]` "FLAW DETECTION · 11 STEPS". |

---

## 2. TITLE + GOAL (0:08 - 0:25)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:08 | (sting) | `[ANIM]` "MCI/O Training · Video 15 · Plate Flaw Detection" |
| 0:13 | Same iron plate. Same dual transducer. Different objective. We're looking for a defect signal between front wall and backwall. | `[ANIM]` Two A-scans side-by-side: thickness setup vs flaw setup. |

---

## 3. STEPS 1-5 — SAME AS THICKNESS (0:25 - 0:55)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:25 | The first five steps are identical to plate thickness calibration. | `[ANIM]` "STEPS 1-5 · same as #14". |
| 0:31 | One — Receiver tab, Mode frame, Dual. | `[SCREEN]` Dual mode. |
| 0:36 | Two — Filter, closest to probe centre frequency. | `[SCREEN]` Filter. |
| 0:41 | Three — Timebase, Units, Depth. Material velocity dialog opens. | `[SCREEN]` Depth + Material velocity. |
| 0:46 | Four — Pick iron, long. Click O-K. | `[SCREEN]` iron(long) + OK. |
| 0:51 | Five — Timebase Mode, Relative. | `[SCREEN]` Rel mode. |

---

## 4. STEP 6 — RANGE FOR FULL PLATE LENGTH (0:55 - 1:15)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:55 | Step six diverges. Range. | `[ANIM]` "STEP 6 · diff". |
| 1:00 | Adjust the timebase range as necessary to accommodate the length of the plate. | `[SCREEN]` Adjust Range wheel. |
| 1:10 | Not two backwalls — the full plate length you'll be inspecting. | `[CALLOUT]` "Range = inspection area length, not 2 backwalls". |

---

## 5. STEP 7 — DELAY TO FIRST BACKWALL (1:15 - 1:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:15 | Step seven. Same as thickness calibration. Adjust delay until the first backwall signal is positioned at the value of the part thickness. Nineteen millimetres in this example. | `[SCREEN]` Delay positions first backwall at 19 mm. |

---

## 6. STEP 8 — ONE GATE OVER SEARCH AREA (1:30 - 2:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:30 | Step eight. Gates tab. Add one gate. | `[SCREEN]` Add 1 gate. |
| 1:38 | Position the gate across the area in which you are searching for a defect. | `[SCREEN]` Gate spans front-wall to backwall area. |
| 1:48 | Set the threshold of the gate to forty per cent F-S-H. | `[SCREEN]` A.Th.1 = 40. |
| 1:55 | One gate, not two. The threshold is forty, not twenty. | `[CALLOUT]` "1 gate · 40% threshold (vs 2 gates @ 20% for thickness)". |

---

## 7. STEP 9 — TUNE GAIN TO 40% ON DEFECT (2:00 - 2:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:00 | Step nine. Move the probe to find a known defect on the plate. | `[SCREEN]` Probe moves on the plate, defect echo grows. |
| 2:10 | Adjust the total gain until the defect signal height is at forty per cent F-S-H — right at the threshold. | `[SCREEN]` Gain adjusted, defect signal lands at 40% line. |
| 2:23 | Note this gain value. This is the sensitivity calibrated to your reference defect. | `[CALLOUT]` "Gain calibrated to reference defect at threshold". |

---

## 8. STEP 10 — ADD 6 dB SAFETY MARGIN (2:30 - 3:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:30 | Step ten — the safety margin step. | `[ANIM]` "+6 dB". |
| 2:36 | Add six decibels to the total gain. Use the toolbar plus-six-dB button. Or adjust the gain field. | `[SCREEN]` Click +6 dB on A-Scan toolbar. |
| 2:48 | The defect signal now overshoots the threshold by six decibels. That margin catches defects slightly smaller than your reference. | `[CALLOUT]` "+6 dB margin = catches sub-reference defects". |
| 2:58 | This is the standard plate flaw detection sensitivity. | `[TIP]` Pro-tip: "+6 dB is the manual's standard. (Manual §14.2 step 10)". |

---

## 9. STEP 11 — SAVE GLOBAL SETUP (3:00 - 3:15)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:00 | Step eleven. Files tab, Global Setup frame. Save the U-T setup. | `[SCREEN]` Files → Global Setup → Save. |
| 3:09 | Name it for this purpose. Iron Plate, Flaw Detection. | `[SCREEN]` Type "Iron-Plate-Flaw-Detect" + Save. |

---

## 10. KEY DIFFERENCES FROM THICKNESS CALIBRATION (3:15 - 3:50)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:15 | The four differences from plate thickness calibration. | `[ANIM]` "4 KEY DIFFS". |
| 3:21 | One — range covers the inspection area, not two backwalls. | `[CALLOUT]` "Range = inspection area". |
| 3:30 | Two — one gate, not two. | `[CALLOUT]` "1 gate". |
| 3:35 | Three — threshold is forty per cent, not twenty. | `[CALLOUT]` "40% threshold". |
| 3:41 | Four — gain calibrated to a known defect, then plus six decibels for safety. | `[CALLOUT]` "+6 dB safety margin". |
| 3:50 | Everything else stays. | `[CALLOUT]` "Same: mode, filter, units, material, relative mode, delay". |

---

## 11. WHAT THIS CALIBRATION UNLOCKS (3:50 - 4:15)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:50 | What you can now do. | `[ANIM]` "USES". |
| 3:55 | Scan plates for unknown defects. Any signal above the gate threshold is a hit — a defect at or larger than your reference. | `[CALLOUT]` "Gate hit = defect ≥ reference". |
| 4:07 | The plus six decibels margin means you also catch indications slightly smaller than your reference. Acceptable for "find any defect" inspections, not for precise sizing. | `[TIP]` Pro-tip: "Use for finding. Resize calibration for sizing." |

---

## 12. RECAP + CTA (4:15 - 4:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 4:15 | Recap. Eleven steps. | `[ANIM]` 11-bullet checklist. |
| 4:18 | Steps one through five — same as thickness. Six — range for inspection area. Seven — delay to thickness. Eight — one gate, forty per cent. Nine — gain to forty per cent on reference defect. Ten — add six decibels. Eleven — save. | `[ANIM]` Fast-cut bullets. |
| 4:27 | Next — the most advanced inspection setup in the manual. Longwave inspection with side-drilled holes. | `[CUT]` "MCI/O #16 — Longwave Inspection (SDH)". |

---

## Source Citations (all from Appendix A.2, pages 14-186 to 14-187)

| Step | Manual line | Page |
|------|------|------|
| 1 | "Receiver tab, Mode frame, select DUAL" | 14-186 |
| 2 | "Filter frame, receiver frequency closest to centre frequency of transducer" | 14-186 |
| 3 | "Timebase, Units, Depth → Material velocity dialog appears" | 14-186 |
| 4 | "Set material velocity (iron, long for this example)" | 14-186 |
| 5 | "Mode → Rel (relative)" | 14-186 |
| 6 | "Range — adjust to accommodate length of the plate" | 14-186 |
| 7 | "Delay — first backwall at part thickness (19 mm)" | 14-186 |
| 8 | "Gates tab → add a gate, position across search area, threshold 40% FSH" | 14-186 |
| 9 | "Locate defect, adjust total gain until signal height is at 40% FSH" | 14-186 |
| 10 | "Add 6 dB to total gain" | 14-187 |
| 11 | "Files tab → Global Setup → save UT Setup" | 14-187 |
| Figure | Figure 21: UT Setup for Plate Flaw Detection | 14-187 |

---

## Production notes

**Voice:** Adam. 155 WPM. Same pronunciation rules as #14.

**Word count:** ~700.

**Required PDF figures:** Same as #14 (Receiver tab, Timebase tab, Material velocity dialog, Gates tab, Files tab), plus Figure 21.
