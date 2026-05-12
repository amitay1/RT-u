# MCI/O Video #9 — Signal Events for TOF

```
TITLE:        MCI/O #9 — Signal Events for Time-of-Flight
ID:           mcio-09
SERIES:       MCI/O Software Training
DURATION:     270 seconds (4:30)
PREREQUISITE: mcio-08
TABS LINKED:  ScanParametersTab, CalibrationTab
SOURCE:       MCI/O Manual, GB50010130, v3.11
              · Chapter 9.6  (Defining Signal Events — Events sub-tab)
LAST UPDATED: 2026-05-12
```

> **Accuracy:** Seven signal-event types listed verbatim from the manual.

---

## 1. COLD OPEN (0:00 - 0:08)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:00 | (silence) | `[SCREEN]` A-scan with seven small markers along an echo. |
| 0:04 | [matter-of-fact] Time of flight measurement. Pick the wrong event — your thickness is wrong. | `[ANIM]` "TOF accuracy = signal event choice". |

---

## 2. TITLE + GOAL (0:08 - 0:22)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:08 | (sting) | `[ANIM]` "MCI/O Training · Video 9 · Signal Events for TOF" |
| 0:13 | Seven event types. One threshold. From the Events sub-tab. | `[ANIM]` Two bullets. |

---

## 3. WHY THIS MATTERS (0:22 - 0:45)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:22 | The signal event field defines the location on a signal used to determine its time of flight. | `[ANIM]` "WHERE on the echo = the measurement". |
| 0:32 | Selecting the proper signal event is crucial for accurate U-T thickness measurements. The manual states it plainly. | `[TIP]` Pro-tip: "Selecting the proper signal event is crucial. (Manual §9.6)". |

---

## 4. THE EVENTS SUB-TAB (0:45 - 0:55)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:45 | From the Gates tab, click Events. | `[SCREEN]` Switch to Events sub-tab. |
| 0:50 | Columns: gate number, Time, Threshold. Defines which event and which threshold for each gate. | `[HIGHLIGHT]` Columns. |

---

## 5. THE 7 EVENTS (0:55 - 2:35)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:55 | Seven events to choose from. Watch the marker on the echo as I name each. | `[ANIM]` Same echo shown 7 times, each with marker on different feature. |
| 1:03 | T-T-H. TOF position of the first portion of the signal in the gate to cut a predetermined input threshold. The threshold appears in the Threshold column of the Events tab. | `[HIGHLIGHT]` Marker at threshold crossing. `[CALLOUT]` "Tth — threshold crossing". |
| 1:20 | T-T-H-Z-C. TOF position of the first portion of the R-F signal in the gate area to cut zero per cent F-S-H. | `[HIGHLIGHT]` Marker at zero-crossing after threshold. `[CALLOUT]` "Tthzc — zero-crossing after threshold". |
| 1:34 | T-P-plus. TOF position of the maximum positive signal in the gate area. | `[HIGHLIGHT]` Marker at peak positive. `[CALLOUT]` "Tp+ — peak positive". |
| 1:46 | T-Z-C-P-plus. TOF position of the first R-F signal to cut zero per cent F-S-H immediately following the maximum positive portion. | `[HIGHLIGHT]` Marker at zero-crossing after positive peak. `[CALLOUT]` "Tzcp+ — zero after positive peak". |
| 2:02 | T-P-minus. TOF position of the maximum negative signal in the gate area. | `[HIGHLIGHT]` Marker at peak negative. `[CALLOUT]` "Tp- — peak negative". |
| 2:11 | T-Z-C-P-minus. TOF position of the first R-F signal to cut zero per cent F-S-H immediately following the maximum negative portion. | `[HIGHLIGHT]` Marker at zero-crossing after negative peak. `[CALLOUT]` "Tzcp- — zero after negative peak". |
| 2:27 | T-A-B-S. TOF position of the maximum absolute signal in the gate area. | `[HIGHLIGHT]` Marker at peak absolute. `[CALLOUT]` "Tabs — peak absolute". |

---

## 6. DEFINING THE THRESHOLD (2:35 - 3:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:35 | The threshold value represents the minimum amplitude — in amplitude scale units — of the reference threshold. | `[CALLOUT]` "Threshold value = minimum amplitude reference". |
| 2:45 | All signals above the threshold are used by the system to calculate the time of flight. | `[ANIM]` Signals above + below threshold line shown. |

---

## 7. SETTING THE EVENT (3:00 - 3:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:00 | Three steps. | `[ANIM]` "3 STEPS". |
| 3:03 | One. From the Gates tab, click Events. | `[SCREEN]` Click Events. |
| 3:08 | Two. In the row of the desired gate, double-click the Time column. Pick the signal event from the dropdown. | `[SCREEN]` Cursor selects "Tzcp+" from dropdown. |
| 3:18 | Three. Double-click the Threshold column. Combo boxes appear. Pick or type your threshold value. Enter. | `[SCREEN]` Type 30 in Threshold. |

---

## 8. ACCURACY GUIDANCE (3:30 - 3:55)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:30 | The most accurate U-T thickness measurements come from zero-crossing events. | `[ANIM]` "ZERO-CROSSING EVENTS". |
| 3:38 | T-Z-C-P-plus or T-Z-C-P-minus. The zero-crossing point is essentially independent of amplitude variation. | `[CALLOUT]` "Tzcp+ / Tzcp-  =  most amplitude-independent". |
| 3:50 | Peak events — T-P-plus, T-P-minus, T-A-B-S — vary with signal strength. | `[CALLOUT]` "Peak events shift with amplitude". |

---

## 9. RECAP + CTA (3:55 - 4:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:55 | Recap. | `[ANIM]` Four bullets. |
| 3:57 | Seven event types. Tth, Tthzc, Tp+, Tzcp+, Tp-, Tzcp-, Tabs. | Bullet 1 |
| 4:06 | Threshold = minimum amplitude for the calculation. | Bullet 2 |
| 4:11 | Set via the Events sub-tab. Double-click Time column, then Threshold column. | Bullet 3 |
| 4:20 | Zero-crossing events give the most accurate thickness measurements. | Bullet 4 |
| 4:26 | Next — Advanced Gates: tracking and automatic gain correction. | `[CUT]` "MCI/O #10 — Advanced Gates". |

---

## Source Citations

| Script line | Manual section | Page |
|-------------|----------------|------|
| Signal event defines TOF location | §9.6 | 9-102 |
| "Selecting the proper signal event is crucial" | §9.6 | 9-102 |
| 7 event types: Tth, Tthzc, Tp+, Tzcp+, Tp-, Tzcp-, Tabs | §9.6 | 9-102 |
| Tth = first portion to cut input threshold | §9.6 | 9-102 |
| Tthzc = first RF to cut 0% FSH | §9.6 | 9-102 |
| Tp+ / Tp- = peak positive / negative in gate area | §9.6 | 9-102 |
| Tzcp+ / Tzcp- = first RF to cut 0% FSH after peak+/- | §9.6 | 9-102 |
| Tabs = max absolute in gate area | §9.6 | 9-102 |
| Figure 11: locations of signal events on waveform | §9.6 | 9-102 |
| Threshold = minimum amplitude reference | §9.6 | 9-103 |
| Set via Events tab: Time dropdown + Threshold column | §9.6 (2-4) | 9-103 |
| Gate event indicates signal event used to determine TOF | §5.3.2 Note (cross-ref) | 5-45 |

---

## Production notes

**Voice:** Adam. 150 WPM (slightly slower for this dense technical content). Pronunciations:
- "Tth" → "tee tee aitch"
- "Tthzc" → "tee tee aitch zee see"
- "Tp+" → "tee pee plus"
- "Tzcp+" → "tee zee see pee plus"
- "Tp-" → "tee pee minus"
- "Tzcp-" → "tee zee see pee minus"
- "Tabs" → "tee absolute" (NOT "tabs" like the keyboard key)
- "TOF" → "tee oh eff"
- "FSH" → "eff ess aitch"
- "RF" → "arr eff"

**Word count:** ~675 (4:30 × 150 WPM).
