# 🎨 ScanMaster Training Videos — Brand Kit

**Purpose:** A single source of truth so every video in the 28-piece series looks like it was made by the same studio on the same day.

Every AI tool (Descript, AE, HeyGen, Submagic, Midjourney) gets pointed to this file.

---

## 🎯 Visual Identity Summary

**Aesthetic in one sentence:** *"Modern aerospace lab meets Apple Keynote."*
Clean, confident, technical without being cold. Heavy use of dark backgrounds with neon accents to evoke an oscilloscope / A-scan screen.

---

## 🎨 Color Palette

### Primary
| Role | HEX | RGB | Use |
|------|-----|-----|-----|
| **Background Dark** | `#0B1220` | `11, 18, 32` | Main video background |
| **Surface Panel** | `#111A2E` | `17, 26, 46` | Cards, callout boxes |
| **Brand Cyan** | `#22D3EE` | `34, 211, 238` | UT signal accents, primary highlights, A-scan trace |
| **Brand Indigo** | `#6366F1` | `99, 102, 241` | Secondary accent, gates, callouts |

### Functional
| Role | HEX | Use |
|------|-----|-----|
| **Success Green** | `#22C55E` | Correct settings, OK signals |
| **Warning Amber** | `#F59E0B` | Cautions, "pro tip" boxes |
| **Error Red** | `#EF4444` | Mistakes, rejections, defects |
| **Neutral Light** | `#E2E8F0` | Main body text |
| **Neutral Muted** | `#94A3B8` | Secondary text, lower-thirds details |

### Gradient Pair (for backgrounds & thumbnails)
`linear-gradient(135deg, #0B1220 0%, #1E293B 60%, #312E81 100%)`

---

## 🔤 Typography

| Use | Font | Weight | Source |
|-----|------|--------|--------|
| **Titles / Hero** | **Inter Display** | 700 (Bold) | https://rsms.me/inter/ |
| **Body / Subtitles** | **Inter** | 500 (Medium) | (same family) |
| **Code / Data / Values** | **JetBrains Mono** | 500 | https://www.jetbrains.com/lp/mono/ |
| **Captions (Submagic)** | **Inter** | 700, uppercase, tracking +1 | (same) |

**Title size rules:**
- On-screen title cards: 96 px (4K) / 48 px (1080)
- Lower-thirds: 42 px / 21 px
- Captions: 72 px / 36 px

---

## 🎬 Motion Style

| Element | Specification |
|---------|--------------|
| **Default ease** | `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint) |
| **Text-in duration** | 350 ms |
| **Camera moves** | Slow zoom-in (Ken Burns) at 1% per second max |
| **Cuts** | Average shot length: 4-6 seconds. Never longer than 10s without motion. |
| **Sound on transitions** | Subtle whoosh, max -18 LUFS |
| **Cursor highlight** | Cyan glow `#22D3EE` at 40% opacity, 60 px radius, follows pointer |
| **Click feedback** | Cyan ring expanding from 20→80 px over 200 ms |

---

## 🎙 Voice & Tone

**The narrator's voice (ElevenLabs):**
- Voice: **"Rachel"** or **"Adam"** at moderate-pro stability (0.45) and similarity (0.75)
- Pace: 145-160 WPM (slightly slower than conversational — technical content)
- Style: Confident, friendly, never condescending. Like an experienced engineer mentoring a junior.

**Writing tone rules:**
1. **Active voice always.** "Place the gate on the backwall." NOT "The gate should be placed on the backwall."
2. **Second person.** "You'll see..." NOT "One can see..." or "The user sees..."
3. **Contractions OK.** "You'll" / "it's" / "we're".
4. **Numbers in words up to nine, digits 10+.** "Two gates", "12 channels".
5. **No filler.** Cut "basically", "obviously", "as you can see", "in this video we will".
6. **Open with a hook, not a recap.** Every video starts with a problem, not "In the last video...".
7. **End with action.** Every video closes with what to do next.

---

## 🎵 Audio

| Layer | Source | Level | Style |
|-------|--------|-------|-------|
| **Voiceover** | ElevenLabs | -14 LUFS | Centered, dry (Descript Studio Sound) |
| **Music bed** | Epidemic Sound | -28 LUFS | Tense / hopeful / corporate-modern. NO drums during demos. |
| **Sound design** | ElevenLabs SFX | -20 LUFS | UI clicks, beeps, subtle whooshes |
| **Stings** | Suno | -16 LUFS | Custom 3-second sting at logo reveal |

**Banned audio:** Stock royalty-free elevator music, lo-fi beats, anything that screams "YouTube tutorial 2018".

---

## 📐 Layout Templates

### Title Card (00:00 - 00:05)
```
┌──────────────────────────────────────────┐
│                                          │
│  SERIES 1 · VIDEO 1                      │  ← Inter 500, #22D3EE, 28px
│                                          │
│  What is Ultrasonic                      │  ← Inter Display 700, #E2E8F0, 96px
│  Testing?                                │
│                                          │
│  ────                                    │  ← 80px cyan rule
│                                          │
│  ScanMaster MCI/O Training               │  ← Inter 500, #94A3B8, 24px
│                                          │
└──────────────────────────────────────────┘
```

### Lower-Third (used during voiceover)
```
┌────────────────────────────┐
│ ┃ Pulse Repetition          │  ← cyan accent bar + Inter 700, 42px
│ ┃ Frequency (PRF)           │
│   How often we fire pulses  │  ← Inter 500, 24px, #94A3B8
└────────────────────────────┘
Anchored bottom-left, 80px inset
```

### Pro Tip Box
```
┌─────────────────────────────────────┐
│  💡 PRO TIP                          │  ← amber border 2px
│                                     │
│  Set the threshold to 30% FSH       │
│  for your first surface follower.   │
└─────────────────────────────────────┘
```

### Mistake Warning Box
```
┌─────────────────────────────────────┐
│  ⚠️ COMMON MISTAKE                   │  ← red border 2px
│                                     │
│  Don't set the threshold above the  │
│  unsaturated front-wall amplitude.  │
│  You'll lose the latch.             │
└─────────────────────────────────────┘
```

---

## 🖼 Thumbnail Style (YouTube/in-app)

- 1920 × 1080
- Dark gradient background (see palette)
- Big bold title (Inter Display 700, 96+ px), max 4 words
- Cyan accent shape: A-scan trace, sine wave, or signal envelope
- Optional: small "01" series-video badge in upper-left
- NO faces, NO arrows-pointing-at-things, NO red-circle clickbait

---

## 🏷 Logo & Watermark

- ScanMaster logo: bottom-right, 80 px height (4K), 60% opacity
- Always present, never animated except for intro reveal
- White-on-dark variant in `assets/logo-white.svg`

---

## ✅ Pre-Export Checklist

Before exporting any video, verify against this list:

- [ ] Title card uses Inter Display 700 at correct size
- [ ] Lower-thirds anchored bottom-left with cyan bar
- [ ] Voiceover at -14 LUFS, music at -28 LUFS
- [ ] Captions burned in OR provided as `.vtt` (decide per-platform)
- [ ] Cursor highlight visible during all clicks
- [ ] Logo watermark visible bottom-right
- [ ] Intro sting + outro sting present
- [ ] Color grading: shadows slightly cool, highlights slightly warm
- [ ] Export: H.264, 4K (3840×2160), 60 fps, 50 Mbps, AAC 320 kbps stereo
- [ ] Also export 1080p version for mobile streaming

---

## 📦 Asset Files (to be created)

In `training-videos/brand-kit/`:
- [ ] `logo-white.svg`, `logo-dark.svg`
- [ ] `title-card.aep` (After Effects template)
- [ ] `lower-third.aep`
- [ ] `pro-tip.aep`, `mistake.aep`
- [ ] `intro-sting.wav` (3 sec, generated via Suno)
- [ ] `outro-sting.wav`
- [ ] `cursor-click.wav` (200 ms, generated via ElevenLabs SFX)
- [ ] `submagic-style.json` (caption style preset export)
- [ ] `elevenlabs-voice-id.txt` (locked voice ID for consistency)
- [ ] `color-palette.ase` (Adobe Swatch Exchange)
- [ ] `fonts/Inter-Display.zip`, `fonts/JetBrains-Mono.zip`

---

**Next document:** [`MASTER_SCRIPT_TEMPLATE.md`](./MASTER_SCRIPT_TEMPLATE.md)
