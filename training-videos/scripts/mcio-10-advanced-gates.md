# MCI/O Video #10 — Advanced Gates: Tracking + AGC

```
TITLE:        MCI/O #10 — Advanced Gates (Tracking + Dynamic Attenuation + AGC)
ID:           mcio-10
SERIES:       MCI/O Software Training
DURATION:     300 seconds (5:00)
PREREQUISITE: mcio-09
TABS LINKED:  ScanParametersTab
SOURCE:       MCI/O Manual, GB50010130, v3.11
              · Chapter 9.7    (Advanced Gate Functions)
              · Chapter 9.7.1  (Dynamic Backwall Echo Tracking)
              · Chapter 9.7.2  (Dynamic Attenuation)
              · Chapter 9.7.3  (Automatic Gain Correction)
LAST UPDATED: 2026-05-12
```

---

## 1. COLD OPEN (0:00 - 0:08)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:00 | (silence) | `[SCREEN]` Part with visibly variable wall thickness. |
| 0:04 | [matter-of-fact] Variable thickness. Attenuative material. Lost backwall. Three real problems. Three advanced gate functions. | `[ANIM]` "3 problems · 3 fixes". |

---

## 2. TITLE + GOAL (0:08 - 0:22)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:08 | (sting) | `[ANIM]` "MCI/O Training · Video 10 · Advanced Gates" |
| 0:13 | Dynamic backwall echo tracking. Dynamic attenuation. Automatic gain correction. All from the Tracking sub-tab. | `[ANIM]` Three bullets. |

---

## 3. WHEN TO USE EACH (0:22 - 0:45)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:22 | The manual is clear on when. | `[ANIM]` Decision tree. |
| 0:27 | Variable-thickness parts. Use tracking. | `[CALLOUT]` "Variable thickness → Tracking". |
| 0:33 | Highly attenuative materials. Use dynamic attenuation. | `[CALLOUT]` "Attenuative → Dynamic Attenuation". |
| 0:39 | Inconsistent backwall amplitude. Use automatic gain correction. | `[CALLOUT]` "Inconsistent backwall → AGC". |

---

## 4. DYNAMIC BACKWALL ECHO TRACKING (0:45 - 2:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:45 | First — tracking. Prevents falsely high logical outputs when the backwall position moves due to variable wall thickness. | `[ANIM]` Figure 12 from manual. |
| 0:56 | The backwall gate — the tracking gate — follows the backwall signal. The material gate — the dynamic gate — adjusts with it to maintain a constant distance. | `[CALLOUT]` "Tracking gate + Dynamic gate · move together". |
| 1:08 | Five steps to set it up. | `[ANIM]` "5 STEPS". |
| 1:12 | One. From the Gates tab, click Setup. | `[SCREEN]` Click Setup sub-tab. |
| 1:17 | Two. In the row of your tracking gate, double-click the Type column. Pick Tracking from the dropdown. The row above automatically becomes Dynamic. | `[SCREEN]` Select Tracking in Type column. |
| 1:29 | Three. Switch to the Tracking sub-tab. | `[SCREEN]` Click Tracking sub-tab. |
| 1:34 | Four. In the Tracking frame, check the On-Off checkbox. | `[SCREEN]` Click ON/OFF checkbox. |
| 1:40 | Five. Set three values in the Tracking frame. | `[ANIM]` Three sub-fields. |
| 1:45 | Offset — the distance between the end of the dynamic gate and the centre of the backwall signal. | `[CALLOUT]` "Offset". |
| 1:51 | Dead Band — how far the backwall can move without adjustment. The manual recommends setting Dead Band to half the offset. | `[CALLOUT]` "Dead Band = ½ × Offset (Manual §9.7.1)". |
| 1:58 | Timeout — after a loss of signal, when to reset to the original gate position. Zero means no reset. | `[CALLOUT]` "Timeout · 0 = never reset". |

---

## 5. DYNAMIC ATTENUATION (2:00 - 3:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 2:00 | Second — dynamic attenuation. Used in conjunction with T-C-G settings. Especially useful when loss of backwall is expected. | `[ANIM]` "ATTENUATION · loss-of-backwall fix". |
| 2:13 | Six steps. | `[ANIM]` "6 STEPS". |
| 2:16 | One. T-C-G tab. Verify all desired T-C-G segments are set and Active. | `[SCREEN]` Check TCG tab segments. |
| 2:24 | Two. A-Scan window. Verify your attenuation gate is positioned before the last T-C-G node. | `[SCREEN]` Gate before last TCG node. |
| 2:33 | Three. Gates tab, Setup sub-tab. Double-click the Type column for your gate. Pick Attenuation. | `[SCREEN]` Select Attenuation in Type. |
| 2:43 | Four. Gates tab, Tracking sub-tab. In the Dynamic Attenuation frame, check the On-Off checkbox. | `[SCREEN]` Check ON/OFF in Dynamic Attenuation. |
| 2:53 | Five. Select the Gain radio button. | `[SCREEN]` Select Gain radio. |
| 2:57 | Six. Set the Track gate attenuation gain — in decibels — using combo boxes or by typing. | `[SCREEN]` Type 6 in attenuation gain. |

---

## 6. AUTOMATIC GAIN CORRECTION (3:00 - 4:05)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 3:00 | Third — automatic gain correction. The system measures the peak amplitude in the backwall gate and continuously maintains the desired backwall amplitude level. | `[ANIM]` "AGC · auto-maintains backwall level". |
| 3:14 | Seven steps. Same setup as dynamic attenuation, then switch one toggle. | `[ANIM]` "7 STEPS". |
| 3:21 | One. T-C-G segments set and Active. | `[SCREEN]` TCG ready. |
| 3:25 | Two. Attenuation gate before the last T-C-G node. | `[SCREEN]` Gate positioning. |
| 3:30 | Three. Gates tab, Setup. Type column → Attenuation. | `[SCREEN]` Type = Attenuation. |
| 3:36 | Four. Gates tab, Tracking. Dynamic Attenuation On-Off — checked. | `[SCREEN]` ON/OFF. |
| 3:42 | Five. Select the Amplitude radio button. Not Gain. | `[SCREEN]` Select Amplitude radio. |
| 3:48 | Six. Set three values. | `[ANIM]` "3 PARAMETERS". |
| 3:52 | Track gate attenuation amplitude — the backwall signal level to maintain, in per cent. | `[CALLOUT]` "Target amplitude %". |
| 3:58 | Amplitude tolerance — the region of interest beyond which A-G-C will not fire. | `[CALLOUT]` "Tolerance ROI %". |
| 4:00 | Amplitude average factor — number of P-R-F cycles to average before correcting. | `[CALLOUT]` "Average factor (PRF cycles)". |
| 4:02 | Seven. Click Save. | `[SCREEN]` Click Save. |

---

## 7. ONE NOTE FROM THE MANUAL (4:05 - 4:20)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 4:05 | One important combination. | `[TIP]` Pro-tip. |
| 4:09 | Dynamic attenuation can be used together with dynamic backwall echo tracking. In that case, the tracking gate IS the attenuation gate. One gate plays both roles. | `[CALLOUT]` "Tracking gate = Attenuation gate when both enabled. (Manual §9.7.2 Note)". |

---

## 8. RECAP + CTA (4:20 - 5:00)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 4:20 | Recap. | `[ANIM]` Four bullets. |
| 4:22 | Tracking — for variable thickness. Tracking gate + dynamic gate move together. Offset, Dead Band, Timeout. | Bullet 1 |
| 4:34 | Dynamic attenuation — for attenuative materials. Gain mode. | Bullet 2 |
| 4:41 | A-G-C — for inconsistent backwall. Amplitude mode. Three control parameters. | Bullet 3 |
| 4:50 | Tracking and attenuation gates can share one physical gate when both functions are needed. | Bullet 4 |
| 4:56 | Next — Logic Scripts. How to turn gates into pass-fail decisions. | `[CUT]` "MCI/O #11 — Logic Scripts". |

---

## Source Citations

| Script line | Manual section | Page |
|-------------|----------------|------|
| 3 advanced gate functions: tracking, attenuation, AGC | §9.7 | 9-104 |
| Tracking prevents falsely high outputs from variable thickness | §9.7.1 | 9-104 |
| Figure 12 sample variable wall thickness | §9.7.1 | 9-104 |
| Tracking gate + dynamic gate maintain constant distance | §9.7.1 | 9-104 |
| Setup: Type column → Tracking, row above becomes Dynamic | §9.7.1 (2) | 9-105 |
| Offset / Dead Band / Timeout in Tracking frame | §9.7.1 (5) | 9-106 |
| "Set Dead Band to half the value of the offset" | §9.7.1 Dead Band | 9-106 |
| Timeout 0 = no reset | §9.7.1 Timeout | 9-106 |
| Dynamic attenuation used with TCG, for loss-of-backwall | §9.7.2 | 9-106 |
| Type column → Attenuation | §9.7.2 (4) | 9-107 |
| Dynamic Attenuation frame ON/OFF + Gain radio | §9.7.2 (6-7) | 9-107 |
| Tracking gate also = attenuation gate when both enabled | §9.7.2 Note | 9-107 |
| AGC: peak amplitude maintained continuously | §9.7.3 | 9-107 |
| AGC uses Amplitude radio, 3 params: target amp, tolerance, average factor | §9.7.3 (7) | 9-109 |

---

## Production notes

**Voice:** Adam. 150 WPM. "T-C-G", "A-G-C" letter-by-letter. "On-Off" → "on off".

**Word count:** ~750.
