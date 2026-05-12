# MCI/O Video #6 — TCG / DAC Explained

```
TITLE:        MCI/O #6 — TCG / DAC Explained
ID:           mcio-06
SERIES:       MCI/O Software Training
DURATION:     300 seconds (5:00)
PREREQUISITE: mcio-05
TABS LINKED:  CalibrationTab, ScanParametersTab
SOURCE:       MCI/O Manual, GB50010130, v3.11
              · Chapter 7.5    (TCG Segments — overview)
              · Chapter 7.5.1  (Adding TCG Segments)
              · Chapter 7.5.2  (Manipulating the TCG Line)
              · Chapter 7.5.3  (Adjusting TCG Segments)
              · Chapter 7.5.4  (Deleting TCG Segments)
              · Chapter 7.5.5  (Material Attenuation Slope)
              · Chapter 7.5.6  (Selecting TCG Mode)
              · Chapter 7.5.7  (TCG Setup Files)
LAST UPDATED: 2026-05-12
```

> **Accuracy:** Every field, button, and operation comes from the manual.

---

## 1. COLD OPEN (0:00 - 0:08)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:00 | (silence) | `[SCREEN]` Empty A-scan with three echoes at decreasing amplitude with depth. |
| 0:04 | [matter-of-fact] Signal decays with depth. TCG fixes that. | `[ANIM]` Curve straightens into a flat top. |

---

## 2. TITLE + GOAL (0:08 - 0:22)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:08 | (sting) | `[ANIM]` "MCI/O Training · Video 6 · TCG / DAC Explained" |
| 0:13 | Time Corrected Gain. Distance Amplitude Correction. Same thing. The most powerful gain tool in MCI/O. | `[CALLOUT]` "TCG = DAC = Time Corrected Gain = Distance Amplitude Correction". |

---

## 3. THE TCG TAB ORIENTATION (0:22 - 0:45)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:22 | The TCG tab is where every TCG operation lives. | `[SCREEN]` Switch to TCG tab. |
| 0:28 | Seven things to know how to do. Add segments. Manipulate the line. Adjust segments. Delete segments. Set material attenuation slope. Switch modes. Save and load setups. | `[ANIM]` Seven-item list. |
| 0:42 | One note: the Fine TCG option in this tab is not relevant to this version of the application. Ignore it. | `[TIP]` Pro-tip: "Fine TCG = ignore (Manual §7.5 Note)". |

---

## 4. ADDING TCG SEGMENTS (0:45 - 1:20)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:45 | Adding segments. From the top right corner of the TCG tab, click the Add button. | `[SCREEN]` Cursor clicks Add icon. |
| 0:54 | A row appears in the TCG segment list — middle of the tab — showing the segment number, time, and gain. | `[HIGHLIGHT]` TCG list area. |
| 1:02 | Repeat to add more segments. Each new segment is appended to the last and gets the next consecutive number. | `[SCREEN]` Add 3 more segments. |
| 1:11 | On the A-Scan window, on the TCG line, the beginning of each segment is a green or blue square. | `[HIGHLIGHT]` Coloured squares on A-scan TCG line. |
| 1:17 | Make sure the Visible checkbox on the TCG tab is checked — otherwise the TCG line won't appear on the A-Scan window. | `[TIP]` Pro-tip: "Visible checkbox = required". |

---

## 5. MANIPULATING THE TCG LINE (1:20 - 2:05)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:20 | Four things you can do to the whole TCG line. | `[ANIM]` "4 line-wide operations". |
| 1:25 | Enable or disable. Check or clear the Active checkbox on the right side of the TCG tab. When disabled, you see the line but can't change segment parameters. | `[SCREEN]` Toggle Active. |
| 1:38 | Show or hide. Check or clear the Visible checkbox. Or click the TCG icon on the A-Scan window toolbar. | `[SCREEN]` Toggle Visible. |
| 1:48 | Adjust fine delay. From the top left of the TCG tab, under Fine Delay, use the combo boxes to shift the entire TCG line to the right. | `[SCREEN]` Cursor adjusts Fine Delay. |
| 1:58 | Reset. Right side of the TCG tab, click the Reset button. All segments delete. The line returns to the total gain value. | `[SCREEN]` Cursor clicks Reset. |

---

## 6. ADJUSTING INDIVIDUAL SEGMENTS (2:05 - 2:55)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:05 | To change one segment, click its row in the segment list. The arrow icon moves to that segment number. On the A-Scan window, the segment's marker turns from green to blue. | `[SCREEN]` Click segment 2 in list. |
| 2:18 | Two ways to change parameters. | `[ANIM]` "2 methods". |
| 2:21 | Coarse. Make sure the Drag checkbox at the lower right of the TCG tab is checked. Then on the A-Scan window, drag the segment marker — up and down adjusts gain, left and right adjusts time. | `[SCREEN]` Drag segment in A-scan. |
| 2:35 | Fine. In the TCG segment list, double-click the Time or Gain column for that segment. Combo boxes appear. Type a value or click. | `[SCREEN]` Type 28.5 in Time column. |
| 2:46 | Segment slope. In the row of the segment, double-click the column to the right of Gain. Toggles between graduated and straight linear. | `[SCREEN]` Toggle slope. |

---

## 7. DELETING SEGMENTS (2:55 - 3:15)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:55 | Delete one. Select the segment row. From the right edge of the TCG tab, click the Delete-one button. The segment disappears and remaining segments renumber. | `[SCREEN]` Delete segment 3. |
| 3:06 | Delete all. From the right edge, click the Delete-all button. All segments gone. Line resets to total gain. | `[SCREEN]` Delete all. |

---

## 8. MATERIAL ATTENUATION SLOPE (3:15 - 3:45)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:15 | Highly attenuative materials. Apply a material attenuation slope to compensate for expected attenuation. | `[ANIM]` Two-row table at top of TCG tab. |
| 3:24 | In the upper table of the TCG tab, double-click the Range column. Combo boxes. Pick the range — in timebase units. | `[SCREEN]` Type 30 in Range. |
| 3:33 | Then double-click the M-A column. Combo boxes. Pick the attenuation in decibels per timebase unit. | `[SCREEN]` Type 0.3 in MA. |
| 3:41 | The system interpolates that attenuation across the range. | `[CALLOUT]` "dB / timebase unit × range". |

---

## 9. TCG MODE (3:45 - 3:55)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:45 | Two display modes for the TCG tab. | `[ANIM]` "Nodes vs Graph". |
| 3:48 | Default — Nodes — TCG parameters appear in tables in the centre of the tab. | `[SCREEN]` Nodes mode. |
| 3:52 | Graph — these tables are hidden, giving you more visual room. Bottom left of the tab, under TCG Mode. | `[SCREEN]` Graph mode. |

---

## 10. TCG SETUP FILES (3:55 - 4:25)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:55 | Save the TCG configuration as a file. From the middle of the Files tab, under TCG, click Save. The UPRDB Navigator dialog opens. Type a name, click Save. | `[SCREEN]` Save sequence. |
| 4:08 | Or, save as the default — Save as default. Loaded automatically each time you open MCI/O. | `[SCREEN]` Save as default click. |
| 4:16 | Load — Files tab, TCG, Load. Or Load default. | `[SCREEN]` Load click. |
| 4:22 | Delete — Files tab, TCG, Load or Save, select the file, Delete setup. | `[SCREEN]` Delete sequence. |

---

## 11. RECAP + CTA (4:25 - 5:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 4:25 | Recap. | `[ANIM]` Five bullets. |
| 4:27 | TCG and DAC are the same thing — gain that varies with time. | Bullet 1 |
| 4:33 | Add segments from the TCG tab. Visible checkbox to see the line. Active checkbox to edit. | Bullet 2 |
| 4:42 | Adjust segments coarse with drag, fine with table inputs. | Bullet 3 |
| 4:49 | Material attenuation for highly attenuative materials. | Bullet 4 |
| 4:54 | Save TCG configurations as files. | Bullet 5 |
| 4:58 | Next — your first Gate. | `[CUT]` "MCI/O #7 — Your First Gate". |

---

## Source Citations

| Script line | Manual section | Page |
|-------------|----------------|------|
| TCG = DAC, adds extra gain in specified area | §7.5 | 7-69 |
| Fine TCG not relevant to this version | §7.5 Note | 7-70 |
| Add via top-right TCG tab button, row appears in list with #/time/gain | §7.5.1 | 7-70 |
| Green/blue squares on TCG line | §7.5.1 | 7-70/71 |
| Visible checkbox required | §7.5.1 Note | 7-70 |
| Enable/Disable via Active checkbox | §7.5.2 | 7-72 |
| Show/Hide via Visible checkbox or toolbar | §7.5.2 | 7-72 |
| Fine Delay shifts line right (from 0) | §7.5.2 | 7-72 |
| Reset deletes all segments, returns to total gain | §7.5.2 | 7-73 |
| Current segment indicated by arrow + blue square | §7.5.3 | 7-73 |
| Drag checkbox enables coarse adjust | §7.5.3 | 7-73 |
| Slope toggle: graduated / straight linear | §7.5.3 | 7-74 |
| Delete one / Delete all | §7.5.4 | 7-75 |
| Material attenuation: Range + MA columns, dB/timebase unit | §7.5.5 | 7-76 |
| Nodes mode (default) vs Graph mode | §7.5.6 | 7-77 |
| TCG Setup file save / load / default / delete | §7.5.7 | 7-78 to 7-81 |

---

## Production notes

**Voice:** Adam. 155 WPM. "T-C-G" letter-by-letter; "DAC" → "dack" (one syllable); "M-A" → "em ay"; "F-S-H" → "eff ess aitch"; "dB" → "decibels".

**Word count:** ~775.

**Captions:** Hand-correct "TCG", "DAC", "MA", "UPRDB".
