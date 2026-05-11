# 🎓 ScanMaster MCI/O — Training Video Curriculum

**Audience:** Complete beginners to UT inspection and to the ScanMaster MCI/O system.
**Language:** English (with auto-generated captions in EN/HE/FR/DE).
**Total:** 28 videos, ~125 minutes of content, 6 series.
**Delivery:** Embedded inside the Scan-Master application via contextual help panels.

---

## Learning Path Overview

```
SERIES 1   SERIES 2          SERIES 3      SERIES 4   SERIES 5            SERIES 6
Foundations First-Time Setup  Gates         TCG/DAC    Real Inspections    Advanced
(no software) (touch software) (mastery)    (the hard) (follow-along)      (power user)
    ↓             ↓                ↓            ↓           ↓                   ↓
 5 videos     6 videos         5 videos     4 videos    4 videos            4 videos
```

A user who watches the full path in order will go from "I've never heard of UT" to "I can configure a multi-gate TCG inspection of a forged plate."

---

## SERIES 1 — Foundations (5 videos × ~3 min)
> *Goal: Understand the field before touching the software.*

### #1 — What is Ultrasonic Testing?
- The "X-ray for the inside" analogy
- How sound waves reveal internal defects
- Where UT is used (aerospace, oil & gas, manufacturing)
- The four basic players: pulser, transducer, part, receiver
- **Visual style:** Heavy motion graphics, AI-generated B-roll of aircraft / pipelines.

### #2 — Meet the ScanMaster System
- Hardware tour: UPR-100 board, RPP3 pulser, the PC
- Software tour: INSTRUMENT window + Setup Toolbox dialog
- The 12 tabs you'll get to know
- What's a "channel" and why we have multiple
- **Visual style:** Animated UI walkthroughs of MCI/O screens.

### #3 — Your First Inspection — The 5-Step Workflow
The mental model every video reinforces:
1. Setup the timebase & material
2. Configure pulser/receiver
3. Calibrate gain (and TCG if needed)
4. Place gates over signals of interest
5. Save the setup → run the scan → review

### #4 — Reading an A-Scan Display
- The vertical axis (FSH — Full Screen Height)
- The horizontal axis (timebase / depth)
- The pulse, the front wall, the backwall, the defect echo
- What "80% FSH" actually means and why we calibrate to it
- **Most-rewatched video — make it exceptional.**

### #5 — Glossary in Motion
Each term gets 10 seconds of explanation + animation:
PRF · Gain · Gate · TCG / DAC · Backwall · FSH · TOF · Pulse Echo · Through-Transmission · Dual · Pretrigger · Surface Follower · Beam Angle · Snell's Law (preview)

---

## SERIES 2 — First-Time Setup (6 videos × ~4 min)
> *Goal: Open MCI/O for the first time and configure a clean inspection.*

### #6 — Logging In and the Setup Toolbox
- Splash screen → Logon window
- Tour of the Setup Toolbox: Timebase, Zoom/Trig, Pulser, Gain, Receiver, Display, Gates, TCG, Files, Global, IO, Analog Input
- "What is a Global Setup file?" preview
- Exiting safely + the overwrite warning

### #7 — Materials & Velocity (Timebase tab)
- Why material matters for UT
- The Material Database (Add / Edit / Delete)
- Velocity in mm/μs vs inch/μs
- Calculating velocity from a known thickness (calibration trick)
- **Live demo:** add "Titanium Ti-6Al-4V" with velocity 6100 m/s.

### #8 — Configuring the Timebase
- Units: Samples / Time / Depth / Vertical Depth / Horizontal Depth
- Setting Range, Delay, Offset
- Absolute vs Relative mode
- The MSPS rule: ≥ 4× probe frequency

### #9 — Pulser & Receiver Basics
- Selecting inspection mode (PE / TT / Dual)
- Choosing the filter closest to transducer center frequency
- Pulser amplitude (1-8) and damping resistance
- The 25% pulse width rule
- Sub-pulses for attenuative materials

### #10 — Mastering Gain
- Total Gain = Pulser Gain + Receiver Gain
- Prescale Auto vs Manual
- The Baseline offset (the ±127 limit)
- The +6 dB / -6 dB toolbar buttons
- "Why we tune the front wall to 80% FSH"

### #11 — Surface Follower (Immersion Inspections)
- What is a Surface Follower and when to enable it
- The 30% FSH threshold rule of thumb
- The Pretrigger option for viewing the front-surface shape
- Time Out for multi-channel safety
- **Bonus:** Linked Surface Follower with RPP3XD on channels 1+9

---

## SERIES 3 — Gates (5 videos × ~4 min)
> *Goal: The single most-used feature — must be airtight.*

### #12 — What Are Gates? (Concept)
- The gate as "a window that captures peak amplitude in a time range"
- Why we have 1, 2, 3+ gates per channel
- Where gates live: Setup, Thresholds, Events, Tracking, Data tabs
- A real example: front wall gate + backwall gate

### #13 — Adding & Positioning Your First Gate
- Click → drag → name the gate
- Adjusting Delay (left edge)
- Adjusting Range (right edge)
- The "60 nanosecond" minimum range
- Polarity: Absolute / Negative / Positive

### #14 — Amplitude vs Time Thresholds
- Amplitude thresholds (up to 2 per gate): positive-going / negative-going
- Time thresholds (up to 2): inside-going / outside-going
- The "logical high" condition explained
- **Visual:** thresholds animated as horizontal lines moving across signals

### #15 — Signal Events (TOF Made Clear)
The 7 events explained one by one with waveform animations:
- Tth — threshold crossing
- Tthzc — zero-crossing after threshold
- Tp+ / Tp- — peak positive / negative
- Tzcp+ / Tzcp- — zero-crossing after peak
- Tabs — absolute peak
**Practical:** "Use Tzcp+ for the most accurate thickness measurements."

### #16 — Gate Linking & Setup Files
- Normal / Contiguous / Equal / Equaland Contiguous explained
- The "Master gate" concept
- Saving a Gate Setup file
- Setting a default Gate Setup
- Deleting old Gate Setups

---

## SERIES 4 — TCG / DAC (4 videos × ~5 min)
> *Goal: Demystify Time Corrected Gain — beginners' #1 confusion.*

### #17 — Why TCG Exists
- The physics: signal amplitude decays with depth
- DAC = Distance Amplitude Correction = TCG
- The reference reflector concept (SDH, FBH)
- How TCG "flattens" the response across depth
- **Killer visual:** raw signal vs TCG-corrected signal side by side

### #18 — Building Your First TCG Segment
- Adding a TCG segment via the TCG tab
- Drag-to-position (coarse) vs typed values (fine)
- The TCG line color codes: blue (active) vs green (other)
- Visible vs Active checkboxes
- Fine Delay for the entire line

### #19 — The Side-Drilled-Holes Block Example (Longwave)
Live walkthrough of Appendix B from the MCI/O manual:
- A 5 MHz transducer + SDH calibration block (25, 30, 35, 40, 45, 47 mm)
- Adjusting gain to 80% FSH on shallowest hole
- Adding 6 TCG segments — one per hole depth
- Saving as a reusable TCG Setup file
**This is the "follow-along master class" video.**

### #20 — Material Attenuation Slope + TCG Files
- The MA column: dB per timebase unit
- When to use material attenuation vs discrete TCG segments
- TCG Mode: Nodes vs Graph
- Reset / Delete TCG operations
- Designating a default TCG Setup

---

## SERIES 5 — Real Inspections (4 videos × ~6 min)
> *Goal: End-to-end walkthroughs the user can copy.*

### #21 — Plate Thickness Calibration (Appendix A.1)
The full procedure from the manual:
- Dual transducer, depth units, Relative mode
- Two gates on two backwalls @ 20% FSH each
- Gain to 80% FSH on first backwall
- One TCG segment on the second backwall
- Save the Global Setup

### #22 — Flaw Detection in Plates (Appendix A.2)
- Same start as #21
- Single gate across the search area @ 40% FSH
- Locate the defect, tune gain to 40% FSH
- Add 6 dB safety margin
- "Why +6 dB? It's not arbitrary."

### #23 — Multi-Channel Setup & Copy Channel
- Active vs Visible channels
- Copy Channels dialog (Source → Targets)
- Naming channels for clarity
- The Channel Setup file (subset of Global)
- Cascade vs Vertical window arrangements

### #24 — Generating Inspection Reports
- The UPR Report window
- Basic / Gates / TCG / Logic report types
- Print All vs Print Page
- Saving reports as text files
- **Bridge to Scan-Master:** how this report feeds into our app's Documentation tab

---

## SERIES 6 — Advanced (4 videos × ~5 min)
> *Goal: Power-user features for repeat customers.*

### #25 — Dynamic Backwall Echo Tracking
- The "variable thickness" problem
- Setting up tracking gate + dynamic gate
- Offset, Dead Band, Timeout parameters
- The "half-of-offset" rule for Dead Band

### #26 — Dynamic Attenuation & Automatic Gain Correction
- When to use Gain mode vs Amplitude mode
- Track gate attenuation gain
- Amplitude tolerance / average factor
- Saving the AGC configuration

### #27 — Logic Scripts (IO tab)
- The `ga(c,g,t)` / `gt(c,g,t)` / `diupr(n)` / `diocc(n)` functions
- Combining with `and` / `or` / `[...]`
- Feedback types: Light, Light & Counter, Latch & Reset, Capture, BarHeight, BarColor
- Hardware output ports & buzzer
- A real example: "Flash red + buzz if defect peaks above 80% in either gate."

### #28 — FFT Analysis & Locators
- The FFT viewer — peak frequency, -6 dB bandwidth, center frequency
- When to FFT (transducer characterization)
- The two-locator measurement workflow
- Time / amplitude / delta readouts
- **Closing:** "You're now ready for any standard ScanMaster inspection. 🎉"

---

## Per-Video Metadata (filled during production)

Every video gets a row in `video-catalog.json`:

```json
{
  "id": 1,
  "slug": "what-is-ultrasonic-testing",
  "series": 1,
  "title": "What is Ultrasonic Testing?",
  "duration_seconds": 180,
  "tabs_relevant": ["InspectionSetupTab"],
  "concepts": ["ultrasonic-basics", "pulser", "transducer"],
  "prerequisites": [],
  "next_video": 2,
  "transcript_url": "/transcripts/01.json",
  "video_url_4k": "https://cdn.scanmaster.com/videos/01-4k.mp4",
  "video_url_1080": "https://cdn.scanmaster.com/videos/01-1080.mp4",
  "thumbnail_url": "https://cdn.scanmaster.com/thumbs/01.webp",
  "captions": {
    "en": "/captions/01-en.vtt",
    "he": "/captions/01-he.vtt"
  }
}
```

This makes contextual help trivial: every tab in Scan-Master maps to a list of `tabs_relevant` videos.

---

## Production Order Recommendation

We do NOT produce in numerical order. We produce in **template-discovery order**:

| Phase | Videos | Why this order |
|-------|--------|----------------|
| **POC** | #1 | Test the entire pipeline on a Foundations video (heavy graphics, no software screens) |
| **Software demo POC** | #6 | First video that requires MCI/O screen mimicry — proves Synthetic Screen Recording works |
| **Lock the templates** | #4, #12, #17 | Three "concept-heavy" videos that lock down the explainer template |
| **Batch 1 (15 videos)** | Rest of Series 1-3 | Now that templates are solid, batch-produce |
| **Batch 2 (13 videos)** | Series 4-6 | Final batch including the SDH master class (#19) |

---

**Next document:** [`MASTER_SCRIPT_TEMPLATE.md`](./MASTER_SCRIPT_TEMPLATE.md)
