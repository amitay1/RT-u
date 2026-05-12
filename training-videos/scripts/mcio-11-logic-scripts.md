# MCI/O Video #11 — Logic Scripts (IO Tab)

```
TITLE:        MCI/O #11 — Logic Scripts (IO Tab)
ID:           mcio-11
SERIES:       MCI/O Software Training
DURATION:     330 seconds (5:30)
PREREQUISITE: mcio-10
TABS LINKED:  AcceptanceCriteriaTab
SOURCE:       MCI/O Manual, GB50010130, v3.11
              · Chapter 10    (Logic Scripts overview)
              · Chapter 10.1  (Enabling/Disabling)
              · Chapter 10.2  (Creating a Logic Script)
              · Chapter 10.3  (Deleting)
              · Chapter 10.4  (Logic Setup Files)
LAST UPDATED: 2026-05-12
```

---

## 1. COLD OPEN (0:00 - 0:08)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:00 | (silence) | `[SCREEN]` IO tab with several logic script rows. |
| 0:04 | [matter-of-fact] Gates detect signals. Logic scripts decide what happens next. | `[ANIM]` "Signal → Logic → Action". |

---

## 2. TITLE + GOAL (0:08 - 0:25)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:08 | (sting) | `[ANIM]` "MCI/O Training · Video 11 · Logic Scripts" |
| 0:13 | The I-O tab defines digital input and output gate logic scripts and settings. You'll write scripts, set feedback, route hardware ports. | `[ANIM]` Four bullets. |

---

## 3. ENABLE / DISABLE (0:25 - 0:40)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:25 | First — turning scripts on and off. | `[SCREEN]` IO tab open. |
| 0:30 | From the I-O tab, in the row of the logic script, double-click the Enab column. The status toggles between O-N and O-F-F. | `[SCREEN]` Toggle Enab column. |

---

## 4. CREATING A LOGIC SCRIPT — STEP 1: ADD ROW (0:40 - 0:55)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:40 | Creating a script. | `[ANIM]` "STEP 1 · Add row". |
| 0:43 | Before you create the script, the gates you reference must already exist. Build the gates first. | `[TIP]` Pro-tip: "Gates first. Script second. (Manual §10.2 Note)". |
| 0:50 | From the bottom of the I-O tab, click the Add button. A row appears, auto-numbered. | `[SCREEN]` Click Add button. New row appears. |

---

## 5. STEP 2: WRITE THE SCRIPT (0:55 - 2:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:55 | Double-click the Script column. The Script field elongates and a cursor appears. | `[SCREEN]` Cursor in Script field. |
| 1:02 | Four functions are available. | `[ANIM]` "4 FUNCTIONS". |
| 1:05 | G-A — gate amplitude threshold. G-A of channel C, gate G, threshold T. If that gate detects a signal crossing the threshold, the output goes logical high. | `[CALLOUT]` "ga(c,g,t) — amplitude threshold". |
| 1:21 | G-T — gate time threshold. G-T of channel C, gate G, threshold T. Same idea, time threshold. | `[CALLOUT]` "gt(c,g,t) — time threshold". |
| 1:33 | D-I-U-P-R — digital input from port N of the U-P-R card. If the port goes high, the output goes high. N is 1 or 2. | `[CALLOUT]` "diupr(n) — UPR digital input". |
| 1:46 | D-I-O-C-C — digital input from port N of the Sensoray 826 card. Same role. | `[CALLOUT]` "diocc(n) — Sensoray digital input". |
| 1:56 | Combine functions with the logical operators AND and OR. | `[CALLOUT]` "Operators: and, or". |

---

## 6. SCRIPT EXAMPLES (2:00 - 2:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:00 | An example. | `[ANIM]` Sample script appears. |
| 2:03 | G-A of one one one AND G-A of one two one. If both gates fire on their first threshold, the output goes high. | `[CALLOUT]` "ga(1,1,1) and ga(1,2,1)". |
| 2:14 | Brackets concatenate compound expressions. Bracket open, G-A of one one one AND G-A of one two one, bracket close, OR G-A of one two one. | `[CALLOUT]` "[ga(1,1,1) and ga(1,2,1)] or ga(1,2,1)". |
| 2:26 | When you finish typing, press Enter. | `[SCREEN]` Press Enter. Script appears in column. |

---

## 7. STEP 3: SCREEN FEEDBACK (2:30 - 3:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:30 | What happens visually when a logical high is detected. Six choices. | `[ANIM]` "6 FEEDBACK TYPES". |
| 2:37 | O-F-F — no feedback. | `[CALLOUT]` "OFF — silent". |
| 2:41 | Light — a Logical outputs window appears with a screen light. Red by default. | `[CALLOUT]` "Light — screen indicator". |
| 2:47 | Light & Counter — screen light plus a counter of P-R-F cycles the condition was true. Click Reset to zero the counter. | `[CALLOUT]` "Light & Counter — with PRF count". |
| 2:55 | Latch & Reset — light stays on until you click Reset. | `[CALLOUT]` "Latch & Reset — manual clear". |
| 2:58 | Capture — A-scan image is captured, screen frozen. | `[CALLOUT]` "Capture — freeze A-scan". |
| 3:00 | BarHeight — a colour bar appears next to F-S-H, height matching the gate-crossing amplitude. | `[CALLOUT]` "BarHeight — amplitude bar". |

---

## 8. OPTIONAL: LABEL, BUZZER, OUTPUT PORT, COLOUR, DURATION (3:00 - 3:45)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:00 | Five optional refinements per script. | `[ANIM]` "5 OPTIONS". |
| 3:06 | Label. Double-click the Label column. Type an alphanumeric label describing the condition — for example, "Defect 1". | `[SCREEN]` Type "Defect 1". |
| 3:14 | Buzzer. Double-click the Buzzer column. O-N or O-F-F. Sounds the computer buzzer on logical high. | `[SCREEN]` Toggle Buzzer. |
| 3:21 | Hardware output port. Double-click the Out column. Pick from the dropdown. The U-P-R card has two ports. The O-C-C card has eight. The 626 card has twenty-four. | `[CALLOUT]` "UPR=2 · OCC=8 · 626=24 output ports". |
| 3:34 | Colour. Double-click the Color column. Pick from the dialog. Applies to Light, Light & Counter, Latch & Reset. | `[SCREEN]` Color picker. |
| 3:40 | Duration. Bottom of the tab, under Logic Duration. Sets how long Light or Light & Counter feedback stays on. | `[SCREEN]` Adjust Logic Duration. |

---

## 9. INPUTS + OUTPUTS DIALOG (3:45 - 4:25)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:45 | Configuring inputs. From the lower left of the I-O tab, click the Inputs button. Inputs dialog opens. | `[SCREEN]` Open Inputs dialog. |
| 3:53 | Three sub-tabs. U-P-R for U-P-R card inputs. O-C-C for Sensoray 826 inputs. Gates for gate inputs. | `[HIGHLIGHT]` Sub-tabs in Inputs dialog. |
| 4:01 | For each input port — set Count, the minimum number of P-R-F cycles before the input goes logically high. Invert toggles the normal condition. Manual lets you change state manually. State is read-only. | `[CALLOUT]` "Count · Invert · Manual · State". |
| 4:16 | Configuring outputs. Click the Outputs button. U-P-R, O-C-C, Analog tabs. Each output port has Delay, Duration, Units, Invert, Manual, State. | `[SCREEN]` Outputs dialog. |
| 4:23 | The Units field is not adjustable in this version. | `[TIP]` Pro-tip: "Units field disabled (Manual §10.2)". |

---

## 10. LOGIC SETUP FILES (4:25 - 4:55)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 4:25 | Save a script configuration as a Logic Setup file. From the bottom of the I-O tab, click Save. The Choose setup Save dialog opens. | `[SCREEN]` Click Save. |
| 4:36 | Enter setup name. Optional description. Click Save. | `[SCREEN]` Type name + description. |
| 4:43 | Load. Bottom of the I-O tab, click Load. Pick from the Logic Setups list. Click Load. | `[SCREEN]` Load sequence. |
| 4:50 | Delete. Open Load or Save dialog. Pick the file. Click Delete setup. | `[SCREEN]` Delete sequence. |

---

## 11. DELETING A LOGIC SCRIPT ROW (4:55 - 5:05)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 4:55 | Delete one row. From the bottom of the I-O tab, click the Delete button. | `[SCREEN]` Click Delete. |
| 5:00 | The last row in the script list — highest number — is deleted. You cannot pick a specific row. | `[TIP]` Pro-tip: "Delete only removes the LAST row (Manual §10.3)". |

---

## 12. RECAP + CTA (5:05 - 5:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 5:05 | Recap. | `[ANIM]` Four bullets. |
| 5:07 | Functions: ga, gt, diupr, diocc. Combine with and, or, brackets. | Bullet 1 |
| 5:14 | Six feedback types: Off, Light, Light & Counter, Latch & Reset, Capture, BarHeight. | Bullet 2 |
| 5:20 | Optional: Label, Buzzer, Output port, Colour, Duration. | Bullet 3 |
| 5:24 | Save Logic Setup files for reuse. | Bullet 4 |
| 5:27 | Next — Files & Setups. Global, Channel, A-scan, Report. | `[CUT]` "MCI/O #12 — Files & Setups". |

---

## Source Citations

| Script line | Manual section | Page |
|-------------|----------------|------|
| IO tab defines digital input/output logic scripts | §10 | 10-118 |
| Enable/Disable via Enab column toggle | §10.1 | 10-118 |
| Gates must exist before creating script | §10.2 Note | 10-119 |
| Add row + double-click Script + Enter | §10.2 (1-2) | 10-119 |
| 4 functions: ga(c,g,t), gt(c,g,t), diupr(n), diocc(n) | §10.2 (3) | 10-120 |
| AND/OR + brackets for compound | §10.2 (3) | 10-120 |
| 6 feedback types: OFF / Light / Light & Counter / Latch & Reset / Capture / BarHeight | §10.2 (4) | 10-121/122 |
| Optional Label | §10.2 (5) | 10-123 |
| Optional Buzzer ON/OFF | §10.2 (6) | 10-123 |
| Output port: UPR=2, OCC=8, 626=24 | §10.2 (7) | 10-123 |
| Optional Color (applies to Light/Counter/Latch) | §10.2 (8) | 10-124 |
| Logic Duration applies to Light + Light & Counter | §10.2 (9) | 10-124 |
| Inputs dialog: UPR / OCC / Gates sub-tabs | §10.2 (10) | 10-125 |
| Input fields: Count, Invert, Manual, State | §10.2 (10) | 10-125 |
| Outputs: Delay, Duration, Units, Invert, Manual, State | §10.2 (11) | 10-128 |
| Units not adjustable in this version | §10.2 (11) Units | 10-128 |
| Logic Setup save/load/delete | §10.4 | 10-131/132/133 |
| Delete logic script removes LAST row | §10.3 | 10-130 |

---

## Production notes

**Voice:** Adam. 150 WPM. "I-O" → "eye oh". "G-A" → "gee ay". "G-T" → "gee tee". "D-I-U-P-R" → spell letter-by-letter. "D-I-O-C-C" → spell letter-by-letter. "U-P-R", "O-C-C", "F-S-H" letter-by-letter. "ga(1,1,1)" → "gee ay of one comma one comma one".

**Word count:** ~825 (5:30 × 150 WPM).
