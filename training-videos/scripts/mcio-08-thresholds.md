# MCI/O Video #8 — Threshold Strategies

```
TITLE:        MCI/O #8 — Threshold Strategies (Amplitude + Time)
ID:           mcio-08
SERIES:       MCI/O Software Training
DURATION:     270 seconds (4:30)
PREREQUISITE: mcio-07
TABS LINKED:  ScanParametersTab, AcceptanceCriteriaTab
SOURCE:       MCI/O Manual, GB50010130, v3.11
              · Chapter 9.5    (Setting Thresholds — overview)
              · Chapter 9.5.1  (Amplitude Thresholds)
              · Chapter 9.5.2  (Time Thresholds)
LAST UPDATED: 2026-05-12
```

---

## 1. COLD OPEN (0:00 - 0:08)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:00 | (silence) | `[SCREEN]` A gate with two threshold lines crossing it. |
| 0:04 | [matter-of-fact] Two amplitude thresholds. Two time thresholds. Per gate. | `[ANIM]` "2 + 2 = pass/fail logic". |

---

## 2. TITLE + GOAL (0:08 - 0:22)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:08 | (sting) | `[ANIM]` "MCI/O Training · Video 8 · Threshold Strategies" |
| 0:13 | Amplitude thresholds. Time thresholds. Polarities. All from the Thresholds sub-tab. | `[ANIM]` Three bullets. |

---

## 3. THE THRESHOLDS SUB-TAB (0:22 - 0:35)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:22 | From the Gates tab, click Thresholds. | `[SCREEN]` Switch to Thresholds sub-tab. |
| 0:27 | This is where all amplitude and time threshold settings live, with their polarities. | `[HIGHLIGHT]` Columns: A.Th.1, Pol, A.Th.2, Pol, T.Th.1, Pol, T.Th.2, Pol. |

---

## 4. AMPLITUDE THRESHOLDS — CONCEPT (0:35 - 0:55)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:35 | Up to two amplitude thresholds per gate. | `[ANIM]` "≤2 amplitude thresholds". |
| 0:40 | Each can be positive-going or negative-going. | `[ANIM]` Two arrows: up arrow / down arrow. |
| 0:45 | Positive-going. Any gated peak amplitude that exceeds the threshold results in a logical high condition. | `[CALLOUT]` "Crossing UP → logical HIGH". |
| 0:51 | Negative-going. Any gated peak that drops below the threshold results in a logical high condition. | `[CALLOUT]` "Dropping BELOW → logical HIGH". |

---

## 5. SETTING THE FIRST AMPLITUDE THRESHOLD (0:55 - 1:35)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:55 | Two ways to set it. | `[ANIM]` "2 METHODS". |
| 0:59 | One. From the A-Scan window, position the mouse in the middle of the gate. The threshold cursor appears. Hold left mouse, drag up or down. The A.Th.1 value in the Gates tab updates live. | `[SCREEN]` Drag threshold inside gate on A-scan. |
| 1:14 | Two. From the Gates tab, Thresholds sub-tab, double-click the A.Th.1 field. Combo boxes. Type or click. Enter. | `[SCREEN]` Type 80 in A.Th.1. |
| 1:25 | The units depend on the Display tab's Amplitude Scale setting. Per cent, decibels, volts, or A-D bits. | `[CALLOUT]` "Units = Amp. Scale (Display tab)". |

---

## 6. POLARITY OF FIRST AMPLITUDE THRESHOLD (1:35 - 1:50)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:35 | Polarity. Default is positive-going. | `[ANIM]` "DEFAULT: positive-going". |
| 1:40 | To switch, in the Thresholds tab, double-click the Pol field next to A.Th.1. The icon flips. On the A-Scan window, the polarity marker on the gate matches. | `[SCREEN]` Toggle polarity icon. |

---

## 7. SECOND AMPLITUDE THRESHOLD (1:50 - 2:15)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:50 | Want a second amplitude threshold? Same procedure. | `[ANIM]` "+ A.Th.2". |
| 1:55 | Gates tab, Thresholds, double-click A.Th.2. Combo boxes. Type or click. Enter. | `[SCREEN]` Type 30 in A.Th.2. |
| 2:04 | Set its polarity by double-clicking the Pol field to the right of A.Th.2. | `[SCREEN]` Toggle A.Th.2 polarity. |
| 2:10 | Now this gate fires on both a positive-going crossing of one level and a negative-going crossing of another. | `[CALLOUT]` "Both conditions logical OR each other". |

---

## 8. TIME THRESHOLDS — CONCEPT (2:15 - 2:40)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:15 | Up to two time thresholds per gate. | `[ANIM]` "≤2 time thresholds". |
| 2:20 | Each can be inside-going or outside-going. | `[ANIM]` Two arrows pointing inward / outward. |
| 2:25 | Inside-going. Any gated peak that falls below the defined value results in a logical high. | `[CALLOUT]` "Inside-going → fall below → HIGH". |
| 2:32 | Outside-going. Any peak that exceeds the defined value results in a logical high. | `[CALLOUT]` "Outside-going → exceed → HIGH". |

---

## 9. SETTING TIME THRESHOLDS (2:40 - 3:20)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:40 | Time thresholds are set via the table only. | `[ANIM]` "TABLE INPUT". |
| 2:45 | Gates tab, Thresholds sub-tab. Double-click the T.Th.1 field. Combo boxes. Type or click. Enter. | `[SCREEN]` Type 35.0 in T.Th.1. |
| 2:56 | The icon position on the A-Scan window updates to match. | `[SCREEN]` Threshold icon moves on A-scan. |
| 3:02 | The units depend on the Timebase tab's Units setting. Samples, time, depth, vertical depth, horizontal depth. | `[CALLOUT]` "Units = Timebase tab Units". |
| 3:12 | For a second time threshold — T.Th.2 — repeat. Same procedure. | `[SCREEN]` Type 42.0 in T.Th.2. |

---

## 10. POLARITY OF TIME THRESHOLDS (3:20 - 3:45)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:20 | Polarity. Default is outside-going. If no icon appears in the Pol field, the polarity is automatically outside-going. | `[ANIM]` "DEFAULT: outside-going". |
| 3:30 | To switch to inside-going, double-click the Pol field to the right of the threshold value. The inside-going icon appears. On the A-Scan window, the icon flips. | `[SCREEN]` Toggle T.Th.1 polarity. |
| 3:40 | Same for the second time threshold. | `[SCREEN]` Toggle T.Th.2 polarity. |

---

## 11. RECAP + CTA (3:45 - 4:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:45 | Recap. | `[ANIM]` Five bullets. |
| 3:47 | Two amplitude thresholds per gate. Positive-going or negative-going. | Bullet 1 |
| 3:54 | Set amplitude thresholds by dragging the cursor on the A-scan or by typing in the Thresholds table. | Bullet 2 |
| 4:02 | Two time thresholds per gate. Inside-going or outside-going. | Bullet 3 |
| 4:08 | Set time thresholds in the Thresholds table only. | Bullet 4 |
| 4:15 | Amplitude units come from the Display tab. Time units come from the Timebase tab. | Bullet 5 |
| 4:23 | Next — Signal Events. How the system measures time of flight. | `[CUT]` "MCI/O #9 — Signal Events for TOF". |

---

## Source Citations

| Script line | Manual section | Page |
|-------------|----------------|------|
| Up to 2 amplitude thresholds per gate | §9.5.1 | 9-95 |
| Positive-going / negative-going semantics | §9.5.1 | 9-95 |
| Figure 9: gate with two amplitude thresholds | §9.5.1 | 9-95 |
| Amplitude units from Display tab Amplitude Scale | §9.5.1 | 9-95 |
| Set amplitude via A-scan drag OR Thresholds table | §9.5.1 (1a-d) | 9-96 |
| Default polarity = positive-going | §9.5.1 (2) | 9-97 |
| Up to 2 time thresholds per gate | §9.5.2 | 9-98 |
| Inside-going / outside-going semantics | §9.5.2 | 9-98 |
| Figure 10: gate with two outside-going time thresholds | §9.5.2 | 9-98 |
| Time units from Timebase tab Units | §9.5.2 | 9-99 |
| Set time thresholds via T.Th.1 / T.Th.2 fields | §9.5.2 (1) | 9-99 |
| Default time polarity = outside-going | §9.5.2 (2) | 9-100 |

---

## Production notes

**Voice:** Adam. 155 WPM. "A.Th.1" → "ay dot tee aitch dot one"; "T.Th.1" → "tee dot tee aitch dot one". Or simpler: "Amp Threshold 1", "Time Threshold 1".

**Word count:** ~700.
