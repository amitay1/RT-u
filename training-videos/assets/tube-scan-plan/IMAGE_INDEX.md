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
| Step 12 note — "Scroll boxes appear when >3 segments" — TCG list | `step-12-tcg-list-three-nodes-scroll.png` | TCG segment list with 3 entries, scroll arrow visible, `-->3` indicator |
| Step 12 note (text from manual about scroll boxes) | `step-12-note-scroll-boxes-text.png` | The exact note: "When more than three TCG segments are on the TCG segment list, scroll boxes appear to the right of the list..." — useful as a typographic overlay |
| Step 13 — "Back-wall TCG points (≥4)" | `step-13-ascan-backwall-tcg-points.png` | **Full A-scan** with back-wall echo at 100% + first echo at 73%, showing TCG points placed before and after the back-wall pulse |
| Step 13.1 — "Save via Files tab → TCG → UPRDB Navigator" | `step-13-save-tcg-uprdb-navigator.png` | Files tab Save options + UPRDB Navigator dialog with folder tree |

### Toolbar icons

| Used in | Image File | What It Is |
|---------|------------|------------|
| Steps 10b, 11b, 12b | `toolbar-save-point-button.png` | "Save current TCG point" button (tiny floppy-disk icon, ~2 KB) |

**Note about other toolbar buttons:** The "Add TCG segment" button and "Set back-wall points" button are NOT extracted as separate images in the DOCX — they only appear *inside* the larger Setup Toolbox screenshots (`step-08-*`, `step-10-tcg-list-*`, `step-11-tcg-list-*`, `step-12-tcg-list-*`, etc.). For the video, zoom into those screenshots when narrating the click — don't try to use cropped icons.

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
| step-12-note-scroll-boxes-text.png | image12.png | 26,391 |
| step-13-ascan-backwall-tcg-points.png | image14.png | 61,226 |

Two `.emf` files (image1.emf, image10.emf) are Microsoft Enhanced Metafile decorative borders — not used.

---

## 🎬 [v3] Pedagogical Manim animations — 11 total

Built in response to two rounds of user feedback. Source: `training-videos/animations/tube-scan-plan/scenes.py`.

### Used in the order they appear in the video (`tube-scan-plan-guide.md` v3)

| # | Animation | Timestamp | Script Section | What it shows |
|---|-----------|-----------|----------------|---------------|
| 1 | `IntroTitle.mp4` | 0:00 - 0:08 | §1 Intro | Title card: "TCG Calibration for Normal Beam Inspection" |
| 2 | `RequiredEquipment.mp4` | 0:08 - 0:32 | §2 Equipment | 6-item prep checklist |
| 3 | `FBHLabels.mp4` | 0:32 - 0:48 | §3 FBH Standards | Hagit-block photo + Near / Middle / Far badges |
| 4 | `OpenScanMasterTeachIn.mp4` | 0:48 - 1:05 | §4 Teach In | Wizard menu + zoom + arrow on Teach In tile |
| 5 | `SetBasicParameters.mp4` | 1:05 - 1:35 | §5 Basic Params | Setup-Toolbox + 4 parameter cards |
| 6 | `WaterPathWarning.mp4` | 1:35 - 1:55 | §6 Warning | Amber warning: "Deviation requires re-standardization" |
| 7 | `BeforeAfterTCG.mp4` | 1:55 - 2:30 | §7 Before/After | Concept comparison: varied amplitudes → all 80% FSH |
| 8 | `ActiveVisibleDrag.mp4` | 2:30 - 2:50 | §8 Checkboxes | Verify Active · Visible · Drag |
| 9 | `DragAnd80FSH.mp4` | 2:50 - 3:22 | §9 Point #1 | Yellow dot drag arrow + 80% FSH cyan line |
| — | `DragAnd80FSH.mp4` (reused) | 3:48 - 4:09 | §10 Point #2 | same |
| — | `DragAnd80FSH.mp4` (reused) | 4:28 - 4:48 | §11 Point #3 | same |
| 10 | `SaveTCGSetup.mp4` | 5:50 - 6:50 | §14 Save | 4-step save sequence + filename convention + success stamp |
| 11 | `FinalChecklist.mp4` | 6:50 - 7:30 | §15 Checklist | 7-item checklist filling in green |

**Total animation runtime:** ~140 seconds (2:20). Every screen is covered.

### Suggested editor workflow

In Descript or ElevenLabs Studio, **drop the `.mp4` files directly onto the timeline** at the timestamps marked above. They are 1920×1080 @ 60 fps H.264, ready to use.

### v3 changes from v2

| Change | Why |
|---|---|
| Added 5 new animations: Intro, Equipment, TeachIn, BasicParams, SaveTCG | Round-2 feedback (5 missing clips) |
| Re-ordered scenes (Before/After moved to after Equipment) | Round-2 feedback (new logical order) |
| Updated BeforeAfter text: "All FBH responses adjusted to 80% FSH" | Round-2 feedback (FBH-specific) |
| Updated WaterPath text: "Deviation requires re-standardization" | Round-2 feedback (professional tone) |
| Updated Checklist text: "Water path kept within ±¼ inch" | Round-2 feedback (consistency over confirmation) |
