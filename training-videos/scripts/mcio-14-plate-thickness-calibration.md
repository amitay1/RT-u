# MCI/O Video #14 — Plate Thickness Calibration (Appendix A.1)

```
TITLE:        MCI/O #14 — Plate Thickness Calibration
ID:           mcio-14
SERIES:       MCI/O Software Training
DURATION:     330 seconds (5:30)
PREREQUISITE: mcio-13
TABS LINKED:  CalibrationTab, AcceptanceCriteriaTab
SOURCE:       MCI/O Manual, GB50010130, v3.11
              · Appendix A
              · Chapter 14.1 (UT Setup for Thickness Calibration)
LAST UPDATED: 2026-05-12
```

> **Accuracy:** This is a verbatim walkthrough of the manual's Appendix A.1 procedure. Eleven numbered steps. Iron (long) material, dual contact transducer, 19 mm plate.

---

## 1. COLD OPEN (0:00 - 0:08)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:00 | (silence) | `[SCREEN]` 19 mm steel plate on bench, dual contact transducer beside it. |
| 0:04 | [matter-of-fact] First end-to-end inspection setup. Plate thickness calibration. Eleven steps, exactly as the manual writes them. | `[ANIM]` "APPENDIX A.1 · 11 STEPS". |

---

## 2. TITLE + GOAL (0:08 - 0:25)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:08 | (sting) | `[ANIM]` "MCI/O Training · Video 14 · Plate Thickness Calibration" |
| 0:13 | The example uses iron, long-wave velocity, a dual contact transducer, and a plate nineteen millimetres thick. | `[ANIM]` Three bullets: "Iron (long) · Dual transducer · Plate t = 19 mm". |

---

## 3. STEP 1 — INSPECTION MODE (0:25 - 0:40)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:25 | Step one. From the Receiver tab, in the Mode frame, select Dual. | `[SCREEN]` Receiver tab → Mode → DUAL. |

---

## 4. STEP 2 — RECEIVER FILTER (0:40 - 0:55)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:40 | Step two. Receiver tab, Filter frame. Select the receiver frequency setting that is closest to the centre frequency of the transducer being used. | `[SCREEN]` Receiver tab → Filter selection. |

---

## 5. STEP 3 — UNITS = DEPTH (0:55 - 1:15)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:55 | Step three. Lower middle edge of the Timebase tab, under Units, select Depth from the dropdown. | `[SCREEN]` Timebase → Units → Depth. |
| 1:06 | The Material velocity dialog box appears. | `[SCREEN]` Material velocity dialog opens. |

---

## 6. STEP 4 — MATERIAL VELOCITY (1:15 - 1:40)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:15 | Step four. From the Material velocity dialog, set the material velocity of the plate being inspected. | `[SCREEN]` Material list shown. |
| 1:25 | This example uses iron, long-wave. Select iron, long. Click O-K. | `[SCREEN]` Cursor picks "iron(long)", clicks OK. |
| 1:32 | The selected material and its velocity appear in the Material area of the Setup Toolbox. Specific delay and range values for the material automatically appear in the Delay and Range fields. | `[HIGHLIGHT]` Material area + Delay/Range auto-populated. |

---

## 7. STEP 5 — MODE = RELATIVE (1:40 - 1:50)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:40 | Step five. Lower right corner of the Timebase tab, under Mode, select Rel — relative mode. | `[SCREEN]` Mode → Rel radio button. |

---

## 8. STEP 6 — RANGE (1:50 - 2:10)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:50 | Step six. Left side of the Timebase tab, under Range, adjust the timebase range as necessary to see two backwalls. | `[SCREEN]` Cursor adjusts Range wheel until two backwalls visible. |
| 2:02 | Combo boxes, type, or drag the red dot on the wheel. | `[HIGHLIGHT]` Range adjustment methods. |

---

## 9. STEP 7 — DELAY (2:10 - 2:35)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:10 | Step seven. Left side of the Timebase tab, under Delay, adjust the timebase delay until the first backwall signal is positioned at the value of the part thickness. | `[SCREEN]` Cursor adjusts Delay wheel. |
| 2:23 | In this example, the plate is nineteen millimetres. Position the first backwall at nineteen on the timebase axis. | `[HIGHLIGHT]` First backwall at "19 mm" mark. |

---

## 10. STEP 8 — TWO GATES (2:35 - 3:05)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:35 | Step eight. Gates tab. Add two gates. | `[SCREEN]` Click Add twice → two gates appear. |
| 2:43 | Position the gates so that each gate crosses one backwall signal. The first gate over backwall one. The second gate over backwall two. | `[SCREEN]` Position both gates over respective backwalls. |
| 2:54 | Set the threshold of each gate to twenty per cent F-S-H. | `[SCREEN]` Set A.Th.1 = 20 for each gate. |

---

## 11. STEP 9 — GAIN TO 80% FSH (3:05 - 3:20)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:05 | Step nine. Adjust the total gain until the first backwall signal is at eighty per cent F-S-H. | `[SCREEN]` Cursor adjusts gain slider until first backwall = 80% FSH. |

---

## 12. STEP 10 — TCG SEGMENT (3:20 - 3:45)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:20 | Step ten. T-C-G tab. Add a T-C-G segment. | `[SCREEN]` Add TCG segment. |
| 3:28 | Position the segment over the second backwall, and adjust its gain to eighty per cent F-S-H. | `[SCREEN]` Drag segment onto second backwall, adjust gain to 80%. |
| 3:39 | Now both backwalls are at the same amplitude, regardless of depth. That is the point of T-C-G. | `[CALLOUT]` "Both backwalls = 80% FSH · TCG flat". |

---

## 13. STEP 11 — SAVE GLOBAL SETUP (3:45 - 4:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:45 | Step eleven. Files tab, Global Setup frame. Save the U-T setup. | `[SCREEN]` Files tab → Global Setup → Save. |
| 3:54 | Give it a name describing this calibration. | `[SCREEN]` Type "Iron-Plate-19mm-Thickness-Cal", click Save. |

---

## 14. THE RESULT (4:00 - 4:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 4:00 | What you have now. | `[ANIM]` Final state diagram. |
| 4:04 | A timebase calibrated in depth units to iron long-wave velocity. Range covering two backwalls. Two gates with twenty per cent thresholds. Total gain set so first backwall is at eighty per cent. T-C-G flattening the second backwall to match. | `[CALLOUT]` Five-line summary. |
| 4:25 | This is the reference state. Every plate of similar thickness can be measured against it. | `[CALLOUT]` "Reference state for plate thickness work". |

---

## 15. WHAT YOU CAN MEASURE NEXT (4:30 - 5:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 4:30 | What this calibration unlocks. | `[ANIM]` "USES". |
| 4:34 | Thickness gauging — measure unknown plates of the same material. | `[CALLOUT]` "Thickness gauging". |
| 4:42 | Wall loss detection — compare measured thickness to nominal. | `[CALLOUT]` "Wall loss detection". |
| 4:49 | Velocity verification — calibrate other samples of the same material. | `[CALLOUT]` "Velocity verification". |

---

## 16. RECAP + CTA (5:00 - 5:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 5:00 | Recap. Eleven steps. | `[ANIM]` 11-bullet checklist. |
| 5:04 | Dual mode. Receiver filter to probe. Depth units, iron long. Relative mode. Range for two backwalls. Delay to plate thickness. | Bullets 1-6 |
| 5:14 | Two gates with twenty per cent thresholds. Gain to eighty per cent on the first backwall. T-C-G segment to eighty per cent on the second. Save the Global Setup. | Bullets 7-11 |
| 5:25 | Next — same hardware, different mission. Flaw detection. | `[CUT]` "MCI/O #15 — Plate Flaw Detection". |

---

## Source Citations (all from Appendix A.1, pages 14-184 to 14-185)

| Step | Manual line | Page |
|------|------|------|
| 1 | "Receiver tab, Mode frame, select DUAL" | 14-184 |
| 2 | "Filter frame, receiver frequency closest to centre frequency of transducer" | 14-184 |
| 3 | "Timebase tab, Units, select Depth → Material velocity dialog appears" | 14-184 |
| 4 | "Set material velocity (iron, long for this example) → Setup Toolbox Material area shows velocity, Delay+Range auto-populated" | 14-184 |
| 5 | "Mode → Rel (relative)" | 14-184 |
| 6 | "Range — adjust to see 2 backwalls" | 14-184 |
| 7 | "Delay — position first backwall at value of part thickness (19 mm)" | 14-184 |
| 8 | "Gates tab → add 2 gates, position over each backwall, threshold 20% FSH each" | 14-185 |
| 9 | "Total gain → first backwall at 80% FSH" | 14-185 |
| 10 | "TCG tab → add segment, position over second backwall, gain to 80% FSH" | 14-185 |
| 11 | "Files tab → Global Setup → save UT Setup" | 14-185 |
| Figure | Figure 20: UT Setup for Plate Thickness Calibration | 14-185 |

---

## Production notes

**Voice:** Adam. 155 WPM. "F-S-H" letter-by-letter; "T-C-G" letter-by-letter; "iron(long)" → "iron, long-wave" (don't say the parenthesis).

**Word count:** ~825.

**Required PDF figures:** Receiver tab Mode selection, Timebase tab with Material area, Material velocity dialog, Gates tab with 2 gates, TCG tab with 1 segment, Figure 20 from manual.
