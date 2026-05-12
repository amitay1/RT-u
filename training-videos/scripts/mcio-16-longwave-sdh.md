# MCI/O Video #16 — Longwave Inspection with Side-Drilled Holes (Appendix B)

```
TITLE:        MCI/O #16 — Longwave Inspection with Side-Drilled Holes
ID:           mcio-16
SERIES:       MCI/O Software Training
DURATION:     420 seconds (7:00)
PREREQUISITE: mcio-15
TABS LINKED:  CalibrationTab, ScanParametersTab
SOURCE:       MCI/O Manual, GB50010130, v3.11
              · Appendix B
              · Chapter 15.1 (UT Setup for Longwave Inspection)
LAST UPDATED: 2026-05-12
```

> **Accuracy:** Verbatim walkthrough of Appendix B. Twenty-seven steps. 5 MHz transducer, side-drilled-hole calibration block at depths 25, 30, 35, 40, 45, 47 mm. The most thorough setup in the manual. Block is flipped 180° for this procedure.

---

## 1. COLD OPEN (0:00 - 0:08)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:00 | (silence) | `[SCREEN]` SDH calibration block with 6 holes visible at depths 25, 30, 35, 40, 45, 47 mm. |
| 0:04 | [matter-of-fact] The hardest setup in the manual. Twenty-seven steps. Six T-C-G segments. Worth it. | `[ANIM]` "APPENDIX B · 27 STEPS · 6 SDH". |

---

## 2. TITLE + GOAL (0:08 - 0:25)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:08 | (sting) | `[ANIM]` "MCI/O Training · Video 16 · Longwave with SDH" |
| 0:13 | Five megahertz transducer. Calibration block with six side-drilled holes — three millimetre diameter — at depths twenty-five through forty-seven millimetres. T-C-G to correct beam-width loss with depth. | `[ANIM]` Block + holes diagram. |

---

## 3. THE PRINCIPLE (0:25 - 0:55)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:25 | Why six segments. | `[ANIM]` Beam spread visualisation. |
| 0:33 | Sound amplitude decreases with depth due to beam spread, attenuation, and scattering. Without correction, identical reflectors at different depths produce different signal heights. | `[ANIM]` Diagram: same defects at different depths = different amplitudes. |
| 0:48 | T-C-G corrects this. One node per known reflector depth. | `[CALLOUT]` "TCG flattens response across depth". |

---

## 4. ONE NOTE FROM THE MANUAL (0:55 - 1:05)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:55 | The manual specifies one detail. For this example, the calibration block is flipped one hundred and eighty degrees. | `[TIP]` Pro-tip: "Block flipped 180° for this procedure. (Manual §15.1 Note)". |

---

## 5. STEPS 1-3 — INITIAL POSITIONING + FLAT TCG (1:05 - 1:35)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:05 | Step one. Place the transducer in the area of the shallowest hole — twenty-five millimetres — and adjust position until you obtain a maximal signal. | `[SCREEN]` Probe at 25 mm hole position, signal peaks. |
| 1:18 | Step two. T-C-G tab. In the Total Gain column, double-click. The field highlights blue and combo boxes appear. | `[SCREEN]` TCG tab, Total Gain column. |
| 1:27 | Step three. Use the combo boxes. Adjust the total gain — flat T-C-G — until the signal amplitude is at eighty per cent F-S-H. | `[SCREEN]` Gain adjustment, signal at 80%. |

---

## 6. STEP 4 — VERIFY CHECKBOXES (1:35 - 1:45)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:35 | Step four. Lower right corner of the T-C-G tab. Verify that Active, Visible, and Drag are all checked. | `[SCREEN]` Three checkboxes checked. |

---

## 7. STEP 5 — ADD FIRST TCG SEGMENT (1:45 - 2:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:45 | Step five. Right side of the T-C-G tab. Click Add. A row appears in the T-C-G segment list. | `[SCREEN]` Click Add → first segment row appears. |
| 1:55 | This is the segment for your twenty-five-millimetre hole position. | `[CALLOUT]` "Segment 1 = 25 mm hole". |

---

## 8. STEP 6 — POSITION SEGMENT 1 (2:00 - 2:15)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:00 | Step six. Adjust the time value of the segment until the segment is positioned at the desired location on the signal. | `[SCREEN]` Drag segment marker to 25 mm hole signal. |
| 2:11 | The manual is explicit. Do not adjust the gain of this segment. The flat T-C-G already set the gain. | `[TIP]` Pro-tip: "First segment — adjust TIME only, NOT gain. (Manual §15.1 Step 6 Note)" |

---

## 9. STEPS 7-9 — SECOND HOLE (30 mm) (2:15 - 2:45)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:15 | Step seven. Move the transducer to the area of the thirty-millimetre hole. Adjust position until you obtain a maximal signal. | `[SCREEN]` Probe over 30 mm hole, signal peaks (smaller than 25 mm). |
| 2:28 | Step eight. T-C-G tab, click Add. A second row appears. | `[SCREEN]` Click Add → second segment row. |
| 2:36 | Step nine. Adjust the time value to position this segment at the thirty-millimetre signal. | `[SCREEN]` Drag time of segment 2 onto 30 mm signal. |

---

## 10. STEP 10 — ADJUST GAIN OF SEGMENT 2 (2:45 - 3:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:45 | Step ten. Adjust the gain of this segment until the signal amplitude at the thirty-millimetre hole is at eighty per cent F-S-H. | `[SCREEN]` Drag gain of segment 2, signal rises to 80%. |
| 2:57 | Now segments one and two both bring their respective holes to eighty per cent. | `[CALLOUT]` "25 mm + 30 mm both @ 80% FSH". |

---

## 11. STEPS 11-14 — THIRD HOLE (35 mm) (3:00 - 3:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:00 | Steps eleven through fourteen. Same pattern for the thirty-five-millimetre hole. | `[ANIM]` "REPEAT FOR 35 mm". |
| 3:08 | Move probe, find max signal. Add a third T-C-G segment. Adjust its time to the thirty-five-millimetre signal. Adjust its gain so the signal is eighty per cent F-S-H. | `[SCREEN]` Sequence of: probe move, add, time adjust, gain adjust. |
| 3:25 | Segment three locked. | `[CALLOUT]` "35 mm @ 80% FSH". |

---

## 12. STEPS 15-18 — FOURTH HOLE (40 mm) (3:30 - 4:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:30 | Steps fifteen through eighteen. Forty-millimetre hole. Same sequence. | `[ANIM]` "REPEAT FOR 40 mm". |
| 3:40 | Move. Maximise signal. Click Add. Adjust time. Adjust gain to eighty per cent. | `[SCREEN]` Sequence repeated. |
| 3:55 | Segment four locked. | `[CALLOUT]` "40 mm @ 80% FSH". |

---

## 13. STEPS 19-22 — FIFTH HOLE (45 mm) (4:00 - 4:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 4:00 | Steps nineteen through twenty-two. Forty-five-millimetre hole. | `[ANIM]` "REPEAT FOR 45 mm". |
| 4:10 | Move. Maximise. Add. Time. Gain to eighty per cent. | `[SCREEN]` Sequence. |
| 4:25 | Segment five locked. | `[CALLOUT]` "45 mm @ 80% FSH". |

---

## 14. STEPS 23-26 — SIXTH HOLE (47 mm) (4:30 - 5:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 4:30 | Steps twenty-three through twenty-six. Forty-seven-millimetre hole — the deepest. | `[ANIM]` "REPEAT FOR 47 mm". |
| 4:40 | Move. Maximise. Add. Time. Gain to eighty per cent. | `[SCREEN]` Sequence. |
| 4:55 | Segment six locked. All six segments compensate beam-spread loss. | `[CALLOUT]` "47 mm @ 80% FSH · ALL 6 LOCKED". |

---

## 15. STEP 27 — SAVE GLOBAL SETUP (5:00 - 5:20)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 5:00 | Step twenty-seven. Files tab, Global Setup. Save the U-T Setup. | `[SCREEN]` Files → Global Setup → Save. |
| 5:09 | Name it appropriately. Five Megahertz, S-D-H, Six Holes. | `[SCREEN]` Type "5MHz-SDH-6Holes" + Save. |

---

## 16. THE RESULT (5:20 - 5:50)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 5:20 | What you have now. | `[ANIM]` Final A-scan with flat 80% line across all 6 SDH echoes. |
| 5:26 | A flat eighty per cent response from the shallowest hole at twenty-five millimetres to the deepest at forty-seven. | `[CALLOUT]` "Flat 80% across 25 mm → 47 mm". |
| 5:38 | Any reflector at any depth in this range, of size similar to a three-millimetre side-drilled hole, will appear at eighty per cent F-S-H. | `[CALLOUT]` "DAC equivalent: 3 mm SDH ≈ 80% across depth". |
| 5:48 | This is the calibration that drives real production inspections. | `[CALLOUT]` "Production-grade calibration". |

---

## 17. APPLICATION NOTES (5:50 - 6:25)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 5:50 | What this enables in real work. | `[ANIM]` "USES". |
| 5:55 | Aerospace forgings. Side-drilled holes in the calibration block represent threshold reflectors for the rejection criteria. | `[CALLOUT]` "Aerospace forgings". |
| 6:04 | Tube and pipe. The depth coverage matches typical wall thicknesses. | `[CALLOUT]` "Tube/Pipe wall". |
| 6:11 | Plate stacks. Multiple thickness layers covered by one calibration. | `[CALLOUT]` "Plate stack". |
| 6:18 | Pressure vessels. The deep range matches vessel wall coverage. | `[CALLOUT]` "Pressure vessels". |

---

## 18. RECAP (6:25 - 6:50)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 6:25 | Recap. | `[ANIM]` "27-STEP SUMMARY". |
| 6:28 | Maximise signal at the shallowest hole. Adjust flat T-C-G to eighty per cent. Add the first segment — time only, no gain. | Bullet 1 |
| 6:38 | For each subsequent hole. Maximise. Add segment. Adjust time. Adjust gain to eighty per cent. | Bullet 2 |
| 6:46 | Six segments total. Save the Global Setup. | Bullet 3 |

---

## 19. CTA — SERIES CLOSER (6:50 - 7:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 6:50 | You've completed the MCI/O Software Training series. Sixteen videos. Every chapter of the manual, end to end. | `[ANIM]` Series-complete card with 16-bullet list. |
| 7:00 | Run real inspections. Tune. Save. Document. Iterate. The instrument is yours. | `[CUT]` "Series complete · ScanMaster MCI/O Training". |

---

## Source Citations (all from Appendix B, pages 15-188 to 15-192)

| Step | Manual line | Page |
|------|------|------|
| Block flipped 180° | "For this example, the calibration block is flipped 180°" | 15-188 |
| 1 | "Place transducer in area of shallowest hole (25 mm), adjust position for max signal" | 15-188 |
| 2 | "TCG tab, Total Gain column, double-click" | 15-188 |
| 3 | "Adjust total gain (flat TCG) until signal at 80% FSH" | 15-189 |
| 4 | "Verify Active, Visible, Drag all checked" | 15-189 |
| 5 | "Right side of TCG tab, click Add → row appears in list" | 15-189 |
| 6 | "Adjust time value of segment to desired location on signal" | 15-189 |
| 6-Note | "Do not adjust the gain of the TCG segment" | 15-189 |
| 7 | "Place transducer in area of 30 mm hole, adjust position for max signal" | 15-189 |
| 8 | "Click Add → row appears" | 15-189 |
| 9 | "Adjust time value of segment to location on signal" | 15-190 |
| 10 | "Adjust gain of segment until signal at 80% FSH" | 15-190 |
| 11-14 | "Place transducer in area of 35 mm hole..." (repeat sequence) | 15-190 |
| 15-18 | "Place transducer in area of 40 mm hole..." (repeat sequence) | 15-191 |
| 19-22 | "Place transducer in area of 45 mm hole..." (repeat sequence) | 15-191 |
| 23-26 | "Place transducer in area of 47 mm hole..." (repeat sequence) | 15-192 |
| 27 | "Files tab → Global Setup → save UT Setup" | 15-192 |
| Figure | Figure 22: Calibration Block with Side Drilled Holes | 15-188 |

---

## Production notes

**Voice:** Adam. 150 WPM (slower for this long technical sequence). Pronunciations:
- "T-C-G" letter-by-letter
- "S-D-H" letter-by-letter (Side-Drilled Hole)
- "F-S-H" letter-by-letter
- "U-T" letter-by-letter
- numbers spelled in words ("twenty-five millimetres" not "25 mm")

**Word count:** ~1050 (7:00 × 150 WPM).

**Required PDF figures:** TCG tab in all states, Calibration block diagram (Figure 22), A-scan with single segment, A-scan with all six segments creating flat 80%.

**This is the longest video in the series.** Justified — it's the most-used calibration in real aerospace UT work, and the manual gives 27 explicit steps. Don't cut it short.
