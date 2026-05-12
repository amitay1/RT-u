# Tube Scan Plan Guide — Image Index

All visual assets for the Tube Scan Plan Guide training video, extracted from the original DOCX (`standards/pdfs/Tube Scan Plan Guide.docx`).

> **Why DOCX over PDF?** The DOCX is the source. Images are at native resolution before any PDF compression. We use these for the video; the PDF was just a convenience read.

---

## 📁 Folder layout

```
training-videos/assets/tube-scan-plan/
├── docx-images/          ← raw extraction (image1.png, image2.png, etc.)
├── pdf-figures/          ← PDF page rasters at 300 DPI (for fallback)
├── step-XX-*.png         ← descriptively-named copies (PRIMARY for video)
└── IMAGE_INDEX.md        ← this file
```

---

## 📋 Step-by-step image mapping

Use these files in the video editor. Filename tells you where to drop them.

| Script Step | Image File | What It Shows |
|-------------|------------|---------------|
| Step 3 — "Open ScanMaster wizard and press Teach In" | `step-03-scanmaster-wizard-menu.png` | ScanMaster wizard main menu with 6 buttons: Scan, Teach In, Process, Scanner, Scan results, Exit, Log Out, Shutdown |
| Step 4 — "Screen image will appear" | `step-04-setup-toolbox-instrument.png` | Full INSTRUMENT window + Setup Toolbox (Timebase tab) overlaid |
| Step 7 — "Move to the Hagit calibration block" | `step-07-hagit-block-photo.png` | Real-world photo: probe + cabling + Hagit block on bench |
| Step 8 — "Set all parameters · Range · Gain · Water path" | `step-08-setup-toolbox-highlighted.png` | Setup Toolbox close-up with **magenta highlights** on Delay, Range, MSPS, Material |
| Step 10a — "Drag yellow dot on first FBH peak · 80% FSH" | `step-10-ascan-first-fbh-peak.png` | A-scan with first FBH echo + yellow TCG marker dragged onto its peak |
| Step 10b — "Save first point" | `step-10-tcg-list-one-node.png` | TCG segment list showing entry `-->1` (one node, magenta highlight) |
| Step 11a — "Drag second yellow dot · 80% FSH" | `step-11-ascan-second-fbh-peak.png` | A-scan with two yellow dots, second one on second FBH peak |
| Step 11b — "Save second point" | `step-11-tcg-list-two-nodes.png` | TCG segment list (2 nodes) |
| Step 12a — "Drag third yellow dot · 80% FSH" | `step-12-ascan-third-fbh-peak.png` | A-scan with three yellow dots across three FBH peaks |
| Step 12 note — "Scroll boxes appear when >3 segments" | `step-12-tcg-list-three-nodes-scroll.png` | TCG segment list with 3 entries, scroll arrow visible, `-->3` indicator |
| Step 13.1 — "Save via Files tab → TCG → UPRDB Navigator" | `step-13-save-tcg-uprdb-navigator.png` | Files tab Save options + UPRDB Navigator dialog with folder tree |

### Toolbar icons (used multiple times)

| Used in | Image File | What It Is |
|---------|------------|------------|
| Steps 10b, 11b, 12b | `toolbar-save-point-button.png` | "Save current TCG point" button (tiny floppy-disk icon) |
| Step 5, step 10 | `toolbar-add-tcg-button.png` | "Add TCG segment" button |
| Step 13a | `toolbar-backwall-points-button.png` | "Set back-wall points" button |

---

## 🎬 Production tip

When the user (you) builds the video in ElevenLabs Studio or Descript:

1. Drop each image in at the timestamp written in [`tube-scan-plan-guide.md`](../../scripts/tube-scan-plan-guide.md).
2. Hold each on screen for the full duration of the relevant VO line(s) — 4-8 seconds typical.
3. Where multiple images relate to one step (e.g. step 10 has an A-scan and a TCG list), show the A-scan first while VO talks about "drag the dot", then cut to the TCG list when VO says "save the point".
4. For toolbar buttons that ELevenLabs already shows in its B-roll, you don't need to re-show — only use the toolbar PNGs as zoom-in inserts when you need extra clarity.

---

## 🔍 Raw images (for reference)

Original filenames inside `docx-images/`:

| Renamed | DOCX name | Bytes |
|---------|-----------|-------|
| step-03-scanmaster-wizard-menu.png | image3.png | 96,903 |
| step-04-setup-toolbox-instrument.png | image4.png | 58,015 |
| step-07-hagit-block-photo.png | image2.png | 509,396 |
| step-08-setup-toolbox-highlighted.png | image5.png | 192,823 |
| step-10-ascan-first-fbh-peak.png | image7.png | 314,064 |
| step-10-tcg-list-one-node.png | image8.png | 133,788 |
| step-11-ascan-second-fbh-peak.png | image9.png | 339,166 |
| step-11-tcg-list-two-nodes.png | image10.png | 48,004 |
| step-12-ascan-third-fbh-peak.png | image11.png | 210,523 |
| step-12-tcg-list-three-nodes-scroll.png | image13.png | 144,470 |
| step-13-save-tcg-uprdb-navigator.png | image15.png | 243,720 |
| toolbar-save-point-button.png | image6.png | 2,406 |
| toolbar-add-tcg-button.png | image12.png | 26,391 |
| toolbar-backwall-points-button.png | image14.png | 61,226 |

Two `.emf` files (image1.emf, image10.emf) are Microsoft Enhanced Metafile decorative borders — not used.
