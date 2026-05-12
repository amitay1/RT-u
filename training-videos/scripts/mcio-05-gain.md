# MCI/O Video #5 — Mastering Gain

```
TITLE:        MCI/O #5 — Mastering Gain
ID:           mcio-05
SERIES:       MCI/O Software Training
DURATION:     270 seconds (4:30)
PREREQUISITE: mcio-04
TABS LINKED:  ScanParametersTab
SOURCE:       MCI/O Manual, GB50010130, v3.11
              · Chapter 7   (Controlling Gain — overview)
              · Chapter 7.1 (Choosing Increment Size)
              · Chapter 7.2 (Adjusting Total Gain)
              · Chapter 7.3 (Selecting Pulser and Receiver Gain)
              · Chapter 7.4 (Changing Receiver Offset)
LAST UPDATED: 2026-05-12
```

> **Accuracy:** Every value, range, formula sourced from the manual. Citations at bottom.

---

## 1. COLD OPEN (0:00 - 0:08)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:00 | (silence) | `[SCREEN]` Gain tab with all controls visible. |
| 0:04 | [matter-of-fact] Total gain is the most-touched knob in U-T. Master it now. | `[ANIM]` Cursor hovers Gain knob, pulses cyan. |

---

## 2. TITLE + GOAL (0:08 - 0:22)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:08 | (sting) | `[ANIM]` "MCI/O Training · Video 5 · Mastering Gain" |
| 0:13 | In four and a half minutes — increment size, total gain, pulser plus receiver gain, baseline offset. From the Gain tab. | `[ANIM]` Four bullets fade in. |

---

## 3. ZOOM PRECHECK (0:22 - 0:35)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:22 | Before adjusting anything in the Gain tab, the manual says it once more. | `[ANIM]` Manual quote. |
| 0:28 | Zoom delay and zoom range must be at their minimum values. | `[SCREEN]` Zoom/Trig tab, both at minimum. |

---

## 4. INCREMENT SIZE (0:35 - 0:55)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:35 | The increment value sets how much gain changes per click of a combo box. | `[HIGHLIGHT]` Increment field on Gain tab. |
| 0:42 | Lower-middle of the Gain tab, under Increment, pick from the dropdown. | `[SCREEN]` Cursor selects 0.1, 0.5, 1.0, 6.0. |
| 0:49 | Small increments for fine tuning. Six dB for safety margin shifts. | `[TIP]` Pro-tip: "6 dB = standard safety step". |

---

## 5. ADJUSTING TOTAL GAIN (0:55 - 1:50)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:55 | Total gain. The sum of pulser gain and receiver gain. | `[CALLOUT]` "Total Gain = Pulser Gain + Receiver Gain". |
| 1:03 | In automatic mode, you adjust total gain. The pulser gain — the prescale — is automatically calculated. | `[SCREEN]` Prescale frame, Auto checkbox checked. |
| 1:13 | From the middle of the Gain tab, in the Prescale frame, check the Auto checkbox. The Prescale field becomes disabled. | `[HIGHLIGHT]` Prescale checkbox + disabled field. |
| 1:23 | Five ways to adjust total gain. | `[ANIM]` "5 WAYS" title. |
| 1:27 | One. Combo boxes in the Gain field on the left side of the tab. | `[SCREEN]` Combo boxes. |
| 1:32 | Two. Click the Gain field, type a value, press Enter. Stay between the displayed minimum and maximum. | `[SCREEN]` Type 28, Enter. |
| 1:39 | Three. Drag the gray knob under the field. | `[SCREEN]` Drag knob. |
| 1:43 | Four. From the A-Scan window toolbar, click the minus or plus six dB buttons. | `[SCREEN]` Toolbar -6dB and +6dB icons. |
| 1:48 | Five. Drag the gain slider on the right edge of the A-Scan window. | `[SCREEN]` Drag slider. |

---

## 6. PULSER + RECEIVER GAIN (1:50 - 2:35)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 1:50 | When you need finer control, switch off automatic mode and set both gains independently. | `[ANIM]` "MANUAL MODE" title. |
| 2:00 | Clear the Auto checkbox in the Prescale frame. The Prescale field activates. | `[SCREEN]` Cursor clears Auto. |
| 2:08 | Select a prescale value from the Prescale dropdown. That sets the pulser gain. | `[SCREEN]` Cursor picks 6, 12, 18, 24. |
| 2:16 | Now the Gain field shows receiver gain, not total. | `[HIGHLIGHT]` Gain field label changes. |
| 2:22 | Adjust receiver gain using any of the five methods. The total gain — pulser plus receiver — appears under the gain slider in the A-Scan window. | `[SCREEN]` Total Gain readout updates. |

---

## 7. RECEIVER OFFSET / BASELINE (2:35 - 3:25)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:35 | The offset function adjusts the position of the baseline of the A-scan on the F-S-H display. | `[HIGHLIGHT]` Baseline area on Gain tab. |
| 2:44 | The zero offset of the chip can be monopolar — addressing only the positive or only the negative half of the spectrum — or bipolar — addressing both. | `[ANIM]` Diagram of monopolar vs bipolar. |
| 2:56 | Generally, the offset should remain at zero. | `[TIP]` Pro-tip: "Default offset = 0. Adjust only if needed." |
| 3:01 | The minimum and maximum offset values are plus or minus one hundred and twenty-seven. That's the decimal equivalent of seven binary bits. | `[CALLOUT]` "Offset range: -127 to +127". |
| 3:11 | Three ways to adjust offset. Combo boxes under Baseline. Or click the Baseline field and type a value. Or drag the gray knob. | `[SCREEN]` Cursor demos all three. |
| 3:21 | To reset to zero, click Zero Offset. | `[SCREEN]` Click Zero Offset button. |

---

## 8. ONE NOTE FROM THE MANUAL (3:25 - 3:40)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:25 | The zero offset function operates in conjunction with hardware adjustment. | `[TIP]` Pro-tip. |
| 3:32 | Due to those adjustments, the calculated zero offset value may not be exactly equal to zero. By design. | `[CALLOUT]` "Zero offset ≠ literally 0 due to hardware. (Manual §7.4 Note)" |

---

## 9. RECAP + CTA (3:40 - 4:30)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:40 | Recap. | `[ANIM]` Five bullets. |
| 3:42 | Set increment first. Small for fine tuning, six dB for safety steps. | Bullet 1 |
| 3:50 | Auto mode: adjust total gain, prescale is automatic. | Bullet 2 |
| 3:57 | Manual mode: pick prescale, then adjust receiver gain. | Bullet 3 |
| 4:05 | Offset stays at zero unless you have a reason. Range plus or minus one hundred and twenty-seven. | Bullet 4 |
| 4:15 | Total gain = pulser plus receiver. Always check the A-Scan window readout. | Bullet 5 |
| 4:25 | Next — T-C-G. Distance Amplitude Correction. The most powerful gain tool you'll use. | `[CUT]` "MCI/O #6 — TCG / DAC Explained". |

---

## Source Citations

| Script line | Manual section | Page |
|-------------|----------------|------|
| Zoom precheck before any timebase/gain change | §7 Note | 7-64 |
| Increment value sets gain change per click | §7.1 | 7-64 |
| "Total gain = pulser gain + receiver gain" | §7.2 | 7-65 |
| Automatic mode: total gain adjusted manually, prescale auto | §7.2 | 7-65 |
| Five ways to adjust total gain | §7.2 (3) | 7-65 |
| -6 dB / +6 dB toolbar buttons | §7.2 | 7-65 |
| Gain slider on A-Scan window right edge | §7.2 | 7-65 |
| Manual mode: clear Auto, set prescale, then receiver gain | §7.3 | 7-66 |
| Receiver offset = monopolar vs bipolar | §7.4 | 7-68 |
| Offset range ±127 = 2^7 - 1 | §7.4 | 7-68 |
| Three ways to adjust offset | §7.4 (2) | 7-69 |
| Zero Offset button to reset | §7.4 (2) | 7-69 |
| "Calculated zero offset may not equal zero due to hardware" | §7.4 Note | 7-69 |

---

## Production notes

**Voice:** Adam locked. 155 WPM. Pronunciations: "F-S-H" → "eff ess aitch"; "dB" → "decibels"; "monopolar/bipolar" as written.

**Word count:** ~700.

**Required PDF figures:** Gain tab full, Prescale frame, Baseline area, Figure 7 (offset 0), Figure 8 (offset 16), A-Scan window gain slider.

**Captions:** Hand-correct "FSH", "dB", "monopolar", "bipolar", "Prescale".
