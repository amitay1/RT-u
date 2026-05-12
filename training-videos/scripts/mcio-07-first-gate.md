# MCI/O Video #7 — Your First Gate

```
TITLE:        MCI/O #7 — Your First Gate
ID:           mcio-07
SERIES:       MCI/O Software Training
DURATION:     270 seconds (4:30)
PREREQUISITE: mcio-06
TABS LINKED:  ScanParametersTab, AcceptanceCriteriaTab
SOURCE:       MCI/O Manual, GB50010130, v3.11
              · Chapter 9      (Controlling Gates — overview, 5 sub-tabs)
              · Chapter 9.1    (Adding and Naming a Gate)
              · Chapter 9.2    (Deleting a Gate)
              · Chapter 9.3    (Changing the Gate Label)
              · Chapter 9.4    (Adjusting Delay, Range, Linking, Polarity)
LAST UPDATED: 2026-05-12
```

---

## 1. COLD OPEN (0:00 - 0:08)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:00 | (silence) | `[SCREEN]` Gates tab with one gate already on screen. |
| 0:04 | [matter-of-fact] No gate, no measurement. Gates are how you decide what's a pass and what's a fail. | `[ANIM]` Cyan box appears over a defect echo. |

---

## 2. TITLE + GOAL (0:08 - 0:25)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:08 | (sting) | `[ANIM]` "MCI/O Training · Video 7 · Your First Gate" |
| 0:13 | In four and a half minutes you'll meet the Gates tab. Add a gate. Name it. Delete it. Adjust delay, range, polarity, and linking. | `[ANIM]` Five bullets. |

---

## 3. THE GATES TAB STRUCTURE (0:25 - 0:50)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:25 | The Gates tab has five sub-tabs. | `[ANIM]` "5 SUB-TABS". |
| 0:30 | Setup. Delay, range, linking, polarity for each gate. | `[HIGHLIGHT]` Setup sub-tab. |
| 0:35 | Thresholds. Amplitude and time thresholds with their polarities. | `[HIGHLIGHT]` Thresholds sub-tab. |
| 0:40 | Events. The signal event and threshold per gate for time-of-flight. | `[HIGHLIGHT]` Events sub-tab. |
| 0:45 | Tracking. Advanced gate functions. | `[HIGHLIGHT]` Tracking sub-tab. |
| 0:48 | Data. Amplitude, time of flight, logical condition per gate. | `[HIGHLIGHT]` Data sub-tab. |

---

## 4. ADDING + NAMING A GATE (0:50 - 1:25)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:50 | Adding. From the upper right corner of the Gates tab, click the Add button. | `[SCREEN]` Click Add. |
| 0:59 | The new gate is automatically assigned the next consecutive gate number. Its number, delay, range, and polarity appear in the Setup tab's Gate list. | `[HIGHLIGHT]` New row in Gate list. |
| 1:10 | On the A-Scan window, the new gate appears as a red line. | `[SCREEN]` Red gate line appears on A-scan. |
| 1:15 | Naming. From the Setup tab's Gate list, in the row of the added gate, double-click the Name field. A cursor appears. Type. Press Enter. | `[SCREEN]` Cursor types "Backwall", Enter. |

---

## 5. DELETING A GATE (1:25 - 1:45)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:25 | Delete. From the right edge of the Gates tab, click the Delete button. | `[SCREEN]` Click Delete icon. |
| 1:33 | One rule from the manual. Delete always removes the last gate — the one with the highest number. You cannot select a specific gate to delete. | `[TIP]` Pro-tip: "Delete only removes the LAST gate. (Manual §9.2 Note)" |

---

## 6. GATE LABEL DISPLAY (1:45 - 2:10)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:45 | What appears above each gate on the A-Scan window — called the gate label — is configurable. | `[ANIM]` "GATE LABEL · 4 OPTIONS". |
| 1:53 | Four choices. None — nothing shown. | `[CALLOUT]` "None". |
| 1:58 | Delay and Range — delay and range values shown. | `[CALLOUT]` "Delay & Range". |
| 2:02 | Amp and ToF — peak amplitude and time-of-flight shown. | `[CALLOUT]` "Amp & ToF". |
| 2:05 | Full — all four values. | `[CALLOUT]` "Full". |
| 2:08 | Lower right corner of the Gates tab, under Gate Label dropdown. | `[SCREEN]` Cursor selects each option. |

---

## 7. ADJUSTING DELAY (2:10 - 2:40)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:10 | Adjusting delay. Two paths. | `[ANIM]` "2 METHODS". |
| 2:14 | From the Gates tab. In the Setup sub-tab's Gate list, in the row of your gate, double-click the Delay field. Combo boxes appear. Type or click. Enter. | `[SCREEN]` Type 12.0 in Delay. |
| 2:25 | From the A-Scan window. Hover the left edge of the gate. The delay cursor appears. Hold left mouse, drag. The Delay value in the Gate list updates live. | `[SCREEN]` Drag gate left edge. |
| 2:36 | When two gates are adjacent, you must reduce the range of the first gate before reducing the delay of the second. | `[TIP]` Pro-tip from manual. |

---

## 8. ADJUSTING RANGE (2:40 - 3:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:40 | Same two paths for range. | `[ANIM]` "RANGE". |
| 2:44 | Gates tab. Setup sub-tab. Gate list. Double-click the Range field. Type or click. Enter. | `[SCREEN]` Type 8.5 in Range. |
| 2:53 | A-Scan window. Hover the right edge of the gate. The range cursor appears. Drag. | `[SCREEN]` Drag gate right edge. |

---

## 9. LINKING (3:00 - 3:40)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:00 | Linking lets one gate control the parameters of another. | `[ANIM]` "4 LINK MODES". |
| 3:08 | Normal. Free movement. | `[CALLOUT]` "Normal — independent". |
| 3:12 | Contiguous — link delay. The gate's delay is controlled by the preceding gate. The Delay field is disabled. | `[CALLOUT]` "Contiguous — preceding gate sets delay". |
| 3:21 | Equal — link range. The gate's range is controlled by the preceding gate. The Range field is disabled. | `[CALLOUT]` "Equal — preceding gate sets range". |
| 3:30 | Equaland Contiguous — both delay and range controlled by the preceding Master gate. | `[CALLOUT]` "Equaland Contiguous — Master gate controls all". |
| 3:38 | In the Setup tab, double-click the Link column, pick from the dropdown. | `[SCREEN]` Link dropdown. |

---

## 10. POLARITY (3:40 - 4:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:40 | Polarity. Three options. | `[ANIM]` "3 OPTIONS". |
| 3:43 | Absolute — captures the peak signal of either negative or positive A-scan signals in the range. | `[CALLOUT]` "Absolute". |
| 3:49 | Negative — peak of negative signals only. | `[CALLOUT]` "Negative". |
| 3:53 | Positive — peak of positive signals only. | `[CALLOUT]` "Positive". |
| 3:57 | In the Setup tab, double-click the Pol field until your desired icon appears. | `[SCREEN]` Cycle polarity icons. |

---

## 11. RECAP + CTA (4:00 - 4:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 4:00 | Recap. | `[ANIM]` Four bullets. |
| 4:02 | Five sub-tabs. Add appears as red line. Delete removes the last. | Bullet 1 |
| 4:08 | Adjust delay and range from the Gate list or by dragging the gate edges. | Bullet 2 |
| 4:14 | Four linking modes. Three polarities. | Bullet 3 |
| 4:18 | Naming and labels are configurable. | Bullet 4 |
| 4:22 | Next — Thresholds. Amplitude and time. Up to two of each per gate. | `[CUT]` "MCI/O #8 — Threshold Strategies". |

---

## Source Citations

| Script line | Manual section | Page |
|-------------|----------------|------|
| 5 sub-tabs: Setup, Thresholds, Events, Tracking, Data | §9 | 9-86 |
| Add via top-right button, auto-assigned next number | §9.1 | 9-87 |
| New gate appears as red line on A-scan | §9.1 | 9-87 |
| Name via double-click Name field, Enter | §9.1 | 9-87 |
| Delete removes LAST gate, can't pick specific | §9.2 Note | 9-88 |
| 4 gate label options: None / Delay & Range / Amp & ToF / Full | §9.3 | 9-89 |
| Adjust delay: Gate list double-click OR drag A-scan left edge | §9.4.1 | 9-90 |
| "Reduce first gate's range before reducing second gate's delay" | §9.4.1 Note | 9-90 |
| Adjust range: similar two methods | §9.4.2 | 9-91 |
| 4 link modes: Normal / Contiguous / Equal / Equaland Contiguous | §9.4.3 | 9-92 |
| 3 polarities: Absolute / Negative / Positive | §9.4.4 | 9-94 |

---

## Production notes

**Voice:** Adam. 155 WPM. "ToF" → "time of flight" or "tee oh eff". "Equaland" — exactly as written.

**Word count:** ~700.
