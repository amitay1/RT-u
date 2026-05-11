# 🏭 Production Pipeline

The end-to-end workflow for turning a Markdown script into a published 4K video, with one human operator and no on-camera talent.

**Target throughput:** 1 finished video every 4-6 hours of focused work, once templates are locked.

---

## The Pipeline at a Glance

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 1.SCRIPT │ → │ 2.ASSETS │ → │ 3.VOICE  │ → │ 4.VISUAL │ → │ 5.ASSEM. │ → │ 6.DELIVER│
│ Claude   │   │ Sora/    │   │Eleven    │   │After     │   │Descript  │   │ CDN +    │
│ + Notion │   │Midjourney│   │Labs      │   │Effects   │   │+ Submagic│   │ Scan-Mst │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
   ~1 hour       ~45 min        ~15 min         ~2 hours      ~45 min        ~15 min
```

---

## Stage 1 — Script (Claude + Notion)

**Input:** Curriculum entry + master template.
**Output:** Approved Markdown script in `training-videos/scripts/NN-slug.md`.

1. Open `MASTER_SCRIPT_TEMPLATE.md` and `CURRICULUM.md`.
2. Have Claude draft the full script following the template.
3. Read aloud at 160 WPM — does it fit the duration budget?
4. Run the QA checklist at the bottom of each script.
5. Mirror the script into Notion (production tracker) and mark "Ready for assets".

**Deliverable file:** `training-videos/scripts/NN-slug.md`

---

## Stage 2 — Assets (Sora / Runway / Midjourney / Suno / Epidemic Sound)

**Input:** The "Production notes" section at the bottom of each script.
**Output:** All visual + audio raw materials staged in `assets/NN-slug/`.

For each B-roll prompt in the script:
1. Generate in Sora or Runway. Iterate prompt 2-3 times.
2. Pick the best take, download 4K.
3. Place in `assets/NN-slug/broll/`.

For music + stings:
1. Search Epidemic Sound with the suggested family.
2. Pick a track that survives ducking under voiceover.
3. Generate 2-3 candidate intro/outro stings in Suno.
4. Place in `assets/NN-slug/audio/`.

For MCI/O screen content:
1. If the script needs a software shot, check `assets/pdf-figures/` for the relevant figure (extracted via `scripts/extract-pdf-figures.py`).
2. If a needed screen is missing, generate a Figma mockup matching the MCI/O UI and export as PNG.
3. Place in `assets/NN-slug/screens/`.

For custom illustrations / icons:
1. Generate with Midjourney using the brand color palette.
2. Always specify "flat vector illustration, cyan accent #22D3EE, dark background #0B1220".

---

## Stage 3 — Voiceover (ElevenLabs)

**Input:** The VOICEOVER column of the script.
**Output:** `assets/NN-slug/audio/voiceover.wav` — broadcast-ready VO.

1. Open ElevenLabs.
2. Select the locked brand voice (ID stored in `brand-kit/elevenlabs-voice-id.txt`).
3. Paste the entire VO column as one continuous prompt. The `[directional]` tags steer intonation.
4. Set stability 0.45 / similarity 0.75 / style 0.30.
5. Generate. Listen end-to-end. Regenerate any sentence that's off.
6. Export WAV at 48 kHz 24-bit mono.

**Pro tip — the "regenerate one sentence" trick:**
ElevenLabs allows partial re-generation. Don't redo a 3-minute file because of one word.

---

## Stage 4 — Visuals (After Effects)

**Input:** The VISUAL column of the script + all generated assets.
**Output:** Per-shot AE comps rendered as ProRes 422 HQ files in `assets/NN-slug/comps/`.

For every `[ANIM]` / `[SCREEN]` / `[CALLOUT]` directive in the script:

1. Open the relevant brand-kit AE template (or build the custom comp once and reuse).
2. Drop in the static asset.
3. Animate cursor movement, click rings, zoom-ins per the BRAND_KIT motion spec.
4. Render as ProRes 422 HQ — 4K 60fps — into `comps/`.

**For synthetic screen recordings of MCI/O:**
1. Layer the extracted PDF figure (or Figma mockup) as the static screen.
2. Add a fake cursor (`brand-kit/cursor-pointer.psd`) on its own layer.
3. Animate cursor position with `wiggle()` expressions OR keyframe by hand for precision.
4. Add the cyan click-ring overlay (`brand-kit/click-ring.aep`) at each click moment.
5. Match VO timing using markers imported from Descript.

**Time saver:** Build the cursor + click rig once as a reusable comp. Import it into every new project.

---

## Stage 5 — Assembly (Descript + Submagic)

**Input:** VO file + B-roll + AE comps + music + sting.
**Output:** Final video + captions in 4K and 1080p.

1. Open Descript. New project named `NN-slug`.
2. Import voiceover.wav. Descript auto-transcribes — gives you a text-editable timeline.
3. Paste the script text alongside the transcript. Align via Descript's "match script" tool.
4. Drag B-roll + AE comps onto their corresponding sentences. Descript snaps them.
5. Add music bed track. Auto-duck under VO (-14 LUFS VO, -28 LUFS music).
6. Add intro sting at 0:00, outro sting at end.
7. Run **Studio Sound** on the VO (one click, transforms quality).
8. Apply burned-in lower-thirds, pro-tip boxes, mistake warnings per script directives.
9. Export 4K master @ 60 fps.
10. Open in Submagic, apply the locked "Modern Cyan" caption preset.
11. Submagic exports both burned-caption MP4 and a separate `.vtt` file.

---

## Stage 6 — Delivery (CDN + Scan-Master)

**Input:** Final 4K MP4 + 1080p MP4 + `.vtt` captions + thumbnail.
**Output:** Live video accessible from inside Scan-Master.

1. Generate a thumbnail in Figma using the brand-kit thumbnail template.
2. Upload to chosen CDN (Cloudflare R2 + Stream, or Bunny.net Stream).
3. Get the hosted URLs.
4. Update `src/data/video-catalog.json` in the Scan-Master repo with:
   - title, duration, slug
   - 4K and 1080p URLs
   - thumbnail URL
   - caption URLs (per language)
   - prerequisite + next-video IDs
   - tabs_relevant array (which Scan-Master tabs this video helps with)
5. Commit + push. The `VideoPlayer` component picks up the new entry automatically.
6. QA in app: open Scan-Master, navigate to a tab listed in `tabs_relevant`, click the help icon, watch the video starts and captions sync.

---

## File / Folder Conventions

```
training-videos/
├── PAID_SOFTWARE.md
├── CURRICULUM.md
├── BRAND_KIT.md
├── MASTER_SCRIPT_TEMPLATE.md
├── PRODUCTION_PIPELINE.md       ← you are here
├── brand-kit/
│   ├── logo-white.svg
│   ├── elevenlabs-voice-id.txt
│   ├── title-card.aep
│   └── ...
├── scripts/
│   ├── 01-what-is-ultrasonic-testing.md   ← the working example
│   ├── 02-meet-the-scanmaster-system.md
│   └── extract-pdf-figures.py
├── storyboards/
│   └── 01-storyboard.pdf
├── assets/
│   ├── pdf-figures/             ← raw images from MCI/O manual
│   ├── 01-what-is-ut/
│   │   ├── broll/
│   │   ├── audio/voiceover.wav
│   │   ├── comps/
│   │   └── final/
│   └── 02-meet-scanmaster/
│       └── ...
└── exports/
    ├── 01-what-is-ut-4k.mp4
    ├── 01-what-is-ut-1080p.mp4
    └── 01-what-is-ut-en.vtt
```

---

## Timing Estimate per Video (after templates are locked)

| Stage | Duration | Who/What |
|-------|----------|----------|
| 1. Script | 1 h | Claude generates + human reviews |
| 2. Assets | 45 min | Sora/Runway/Suno generations |
| 3. Voice | 15 min | ElevenLabs + listen-back |
| 4. Visuals | 2 h | After Effects |
| 5. Assembly | 45 min | Descript + Submagic |
| 6. Delivery | 15 min | CDN upload + catalog update |
| **Total** | **5 h** | per video |

**28 videos × 5 h = 140 hours of focused production.** At 25 h/week, that's ~6 weeks of work.

---

## What Could Go Wrong (and the prevention)

| Risk | Mitigation |
|------|-----------|
| VO sounds robotic | Use directional tags `[confident]` / `[curious]`. Stick to one voice across all 28. |
| Inconsistent visual style across videos | Lock all AE templates after Video #1. Never edit a template — clone-and-modify if needed. |
| MCI/O screens look fake | Use the extracted PDF figures as a base — they ARE the real screens. The motion is what we add. |
| Captions out of sync | Always export `.vtt` from Submagic + verify against the Descript timeline. |
| Videos go stale when MCI/O updates | Each video has `LAST UPDATED` in its header. Set a quarterly review. |
| One file edit breaks everything | Each script + assets folder is self-contained. No cross-video dependencies. |
| Storage costs spiral | Final 4K masters → cold storage (Backblaze B2). Only 1080p versions on the CDN for streaming. |

---

## What's Already Set Up

✅ `PAID_SOFTWARE.md` — shopping list with tier recommendations
✅ `CURRICULUM.md` — all 28 video outlines
✅ `BRAND_KIT.md` — visual + audio + voice identity
✅ `MASTER_SCRIPT_TEMPLATE.md` — reusable script structure
✅ `scripts/01-what-is-ultrasonic-testing.md` — first full working script
✅ `scripts/extract-pdf-figures.py` — extraction script for source assets

## What's Next

1. Run the PDF extraction script (one-time):
   ```powershell
   pip install pymupdf pillow
   python training-videos/scripts/extract-pdf-figures.py
   ```
2. Sign up for **Tier 2** software (see `PAID_SOFTWARE.md`)
3. Build Video #1 end-to-end as the POC — this proves the entire pipeline
4. Lock the AE templates based on what Video #1 needed
5. Move to Video #6 (first software-demo video) to prove synthetic screen recording works
6. Scale to remaining 26 videos in batches
