# 🎬 Manim Animations — AI-Generated Technical Graphics

This folder contains Python scripts that render the technical animations for every video. They replace After Effects entirely for:

- Wave propagation animations
- A-scan signal animations
- TCG curve visualizations
- The 5-step list builder
- Beam spread diagrams
- Any animation that needs to be mathematically accurate

**Why Manim instead of AE?**

| AE | Manim |
|----|-------|
| Manual keyframing | Math-driven, exact |
| $60/mo | Free |
| Artistic approximation of physics | Real physics |
| Hard to iterate | Edit code → re-render |
| Steep learning curve for non-animators | Just Python |

---

## Setup (one-time)

```powershell
pip install manim
# Manim also requires LaTeX + FFmpeg, which are usually already installed.
# If not: https://docs.manim.community/en/stable/installation.html
```

---

## How to render

Each video's animations live in `video-NN/`. To render all animations for Video #1:

```powershell
cd training-videos/animations/video-01
manim -qh wave_propagation.py WavePropagation
manim -qh four_players.py FourPlayers
manim -qh five_step_list.py FiveStepList
manim -qh a_scan_basics.py AScanBasics
```

Flags:
- `-qh` = High quality (1080p 60fps). Use `-qk` for 4K.
- `-p` = Auto-play after render.
- `--transparent` = Render with alpha channel (useful for overlaying in Descript).

Output lands in `media/videos/<scene>/<quality>/<SceneName>.mp4`.

---

## Brand-locked rendering

Every scene imports `brand.py` to inherit colors, fonts, and animation easing from the locked BRAND_KIT. Never hardcode colors in scenes — always reference `brand.BRAND_CYAN`, etc.

---

## What's in each scene

### Video #1 — What is Ultrasonic Testing?

| File | Renders | Used at |
|------|---------|---------|
| `wave_propagation.py` | Wave entering metal block, hitting defect, echoing back | 0:35-0:40 |
| `four_players.py` | Four icons lighting up in sequence | 0:40-1:25 |
| `five_step_list.py` | Numbered list builds dramatically | 1:45-2:25 |
| `a_scan_basics.py` | Live A-scan with annotations | recurring |

Each renders as a transparent-background MP4 that drops directly into Descript on the corresponding sentence.
