# 🎬 ScanMaster Training Video System

End-to-end production system for the 28-video MCI/O training curriculum, designed to live inside the Scan-Master app as contextual in-product help.

**Pipeline:** 100% AI-driven. No on-camera talent. No human voiceover. Scripts → ElevenLabs → After Effects → Descript → CDN.

---

## 📂 Read in this order

| # | Document | What it covers |
|---|----------|---------------|
| 1 | [`PAID_SOFTWARE.md`](./PAID_SOFTWARE.md) | **💳 Shopping list.** Every tool to subscribe to, with three budget tiers. |
| 2 | [`CURRICULUM.md`](./CURRICULUM.md) | All 28 video outlines, organized into 6 series. |
| 3 | [`BRAND_KIT.md`](./BRAND_KIT.md) | Visual identity, typography, motion specs, voice direction. |
| 4 | [`MASTER_SCRIPT_TEMPLATE.md`](./MASTER_SCRIPT_TEMPLATE.md) | The reusable 6-section structure every script follows. |
| 5 | [`scripts/01-what-is-ultrasonic-testing.md`](./scripts/01-what-is-ultrasonic-testing.md) | First complete script — POC + reference for the rest. |
| 6 | [`PRODUCTION_PIPELINE.md`](./PRODUCTION_PIPELINE.md) | Stage-by-stage workflow from Markdown to CDN. |

---

## 📁 Directory map

```
training-videos/
├── README.md                       ← you are here
├── PAID_SOFTWARE.md
├── CURRICULUM.md
├── BRAND_KIT.md
├── MASTER_SCRIPT_TEMPLATE.md
├── PRODUCTION_PIPELINE.md
├── scripts/
│   ├── 01-what-is-ultrasonic-testing.md   ← complete working script
│   └── extract-pdf-figures.py             ← run once to harvest MCI/O screens
├── assets/                                ← generated per-video assets land here
│   └── pdf-figures/                       ← output of the extraction script
├── brand-kit/                             ← reusable AE templates + audio stings
└── storyboards/
```

---

## 🚀 Quick start

1. **Buy software** — open `PAID_SOFTWARE.md`. Sign up for Tier 2 (~$250/month). Start with Descript + ElevenLabs + Adobe CC.
2. **Extract MCI/O screens:**
   ```powershell
   pip install pymupdf pillow
   python training-videos/scripts/extract-pdf-figures.py
   ```
3. **Produce Video #1** end-to-end using `scripts/01-what-is-ultrasonic-testing.md` as input and `PRODUCTION_PIPELINE.md` as the recipe. Treat this as a POC — it locks down templates.
4. **Lock the AE template** based on what Video #1 needed.
5. **Produce Video #6 next** (first software-demo video) to prove synthetic screen recording works.
6. **Scale** to the remaining 26 videos in batches.

---

## 🧩 In-app integration (already built)

The Scan-Master app already has the wiring in place:

| File | Role |
|------|------|
| [`src/data/videoCatalog.ts`](../src/data/videoCatalog.ts) | All 28 video entries with tab → video mapping |
| [`src/hooks/useVideoProgress.ts`](../src/hooks/useVideoProgress.ts) | localStorage-backed watch progress |
| [`src/components/training/VideoPlayer.tsx`](../src/components/training/VideoPlayer.tsx) | HTML5 player with captions, resume, "watch next" |
| [`src/components/training/HelpPanel.tsx`](../src/components/training/HelpPanel.tsx) | Slide-out `?` panel — contextual per-tab video list |

**To enable contextual help on any tab, add a single line:**

```tsx
import { HelpPanel } from "@/components/training";

<HelpPanel tabId="CalibrationTab" />
```

The `HelpPanel` automatically filters videos via `tabsRelevant` from the catalog, and shows "Coming soon" placeholders until each video's URL is filled in.

**Wiring a new video into the catalog (post-production):**

1. Upload final MP4s + `.vtt` files to the CDN.
2. Edit the relevant entry in `src/data/videoCatalog.ts`:
   ```ts
   {
     id: 1,
     // ...existing fields...
     videoUrl4k: "https://cdn.scanmaster.com/videos/01-4k.mp4",
     videoUrl1080: "https://cdn.scanmaster.com/videos/01-1080.mp4",
     thumbnailUrl: "https://cdn.scanmaster.com/thumbs/01.webp",
     captions: { en: "https://cdn.scanmaster.com/captions/01-en.vtt" },
     published: true,
   }
   ```
3. Commit. The placeholder disappears automatically.

---

## ✅ Status today

**Foundation work complete:**
- ✅ 6 master documents written (curriculum, brand kit, templates, pipeline)
- ✅ First full video script complete and ready to produce
- ✅ PDF figure extraction script ready
- ✅ Full in-app integration code (catalog + hook + 2 components)
- ✅ TypeScript compiles, lint passes

**Next, in order:**
1. Run the extraction script once
2. Subscribe to Tier 2 tools
3. Produce Video #1 as POC (~5-8 hours of focused work)
4. Lock the AE templates
5. Batch-produce the remaining 27 videos (~140 hours / ~6 weeks)
