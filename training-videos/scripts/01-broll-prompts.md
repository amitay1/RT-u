# 🎥 Video #1 — B-roll Generation Prompts

Copy-paste these prompts directly into **Sora**, **Runway Gen-4**, or **Veo 3**. Each prompt is engineered for our brand visual style (dark, cinematic, cool-grade).

**Tool to use:** Try Sora first (highest fidelity in 2026). Fall back to Runway if a prompt fails.

---

## Shot 1 — Turbine blade rotating (0:00-0:04)

**Prompt:**
> Cinematic close-up of a single jet turbine blade rotating slowly on a polished metal stand, single overhead spotlight casting harsh shadows, dark industrial workshop background out of focus, cool blue color grade, shallow depth of field, anamorphic lens, 4K, 24 fps, slow push-in over 4 seconds, no people, no text

**Aspect ratio:** 16:9
**Duration:** 4 seconds
**Negative prompt:** people, faces, text, logos, warm colors, daylight

---

## Shot 2 — Hairline crack reveal (0:04-0:06)

**Prompt:**
> Extreme macro shot of a hairline crack inside polished aerospace alloy, lit by a single red LED accent, crack subtly glowing, surface texture visible, no movement except gentle camera drift, 4K, 24 fps, ultra-shallow depth of field

**Aspect ratio:** 16:9
**Duration:** 2 seconds
**Negative prompt:** clean surface, scratches, dirt, rust, text

---

## Shot 3 — Submarine sonar (0:27, brief)

**Prompt:**
> Animated underwater view from inside a submarine cockpit, sonar display screen in foreground showing a green sweep, dark ocean visible through viewport, cyan light from sonar reflecting on console, technical drama mood, 4K, 24 fps

**Aspect ratio:** 16:9
**Duration:** 2 seconds
**Negative prompt:** marine life, people, text overlays

---

## Shot 4 — Engineer installing turbine blade (1:30)

**Prompt:**
> Wide shot of an aerospace engineer wearing white gloves installing a turbine blade into a partially assembled jet engine, clean assembly hangar, soft daylight from large windows, no faces visible, hands in focus, slow dolly-out, 4K, 24 fps

**Aspect ratio:** 16:9
**Duration:** 3 seconds
**Negative prompt:** dirt, oil, fast motion, multiple people, text

---

## Shot 5 — Pipeline pressurization (1:33)

**Prompt:**
> Wide outdoor shot of a large industrial oil pipeline, valve being slowly opened by an unseen operator, very slight steam venting from a relief, sunset golden hour light, no people visible, slow camera push toward valve, 4K, 24 fps

**Aspect ratio:** 16:9
**Duration:** 3 seconds
**Negative prompt:** explosion, fire, people, vehicles, text

---

## Shot 6 — Bridge inspection (1:35)

**Prompt:**
> Drone reveal shot starting tight on an inspector's hand holding a small ultrasonic device against a steel bridge truss, then dolly-out to reveal the massive scale of the bridge, late afternoon golden light, blue sky, no faces visible, 4K, 24 fps

**Aspect ratio:** 16:9
**Duration:** 4 seconds
**Negative prompt:** cars, traffic, faces, water below

---

## Shot 7 — Map of global inspections (1:38)

**Prompt:**
> 3D animated dark globe with subtle continent outlines in indigo, glowing cyan pin-drops appearing one by one at major locations (Seattle, Toulouse, Tokyo, Dubai, Houston), each pin pulsing softly, deep space black background with subtle stars, 4K, 24 fps

**Aspect ratio:** 16:9
**Duration:** 4 seconds
**Negative prompt:** text labels, country names, weather effects

---

## Production Notes

**Generation strategy:**
1. Generate each shot 3 times with the same prompt. Pick the best take.
2. If Sora doesn't deliver, try Runway with the same prompt (slightly different keywords).
3. Always download in highest resolution available (4K if offered).
4. Save to `training-videos/assets/01-what-is-ut/broll/` with descriptive filenames:
   - `01-turbine-blade.mp4`
   - `02-crack-reveal.mp4`
   - etc.

**Color grading consistency:**
After generation, drop each clip into Descript and apply a uniform color preset:
- Lift: -5
- Gamma: -3
- Gain: cyan tint
- Saturation: -10

This unifies clips that came from different AI models.

**If a shot doesn't generate well:**
Alternative fallback sources (no cost):
- Pexels.com (royalty-free stock video)
- Pixabay.com
- Mixkit.co

Search those for keywords like "turbine blade", "pipeline", "industrial inspection".

---

## Budget tracking for this video

| Service | Cost per generation | Generations needed | Total |
|---------|---------------------|--------------------|-------|
| Sora (ChatGPT Plus $20/mo, ~100 gens/mo) | included | 21 (7 shots × 3 takes) | $0 incremental |
| Runway (Standard $15/mo, ~125 gens/mo) | included | fallback | $0 incremental |

Total cost for B-roll of Video #1: **$0 incremental** assuming monthly sub already active.
