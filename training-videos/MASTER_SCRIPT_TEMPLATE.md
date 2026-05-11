# 📝 Master Script Template

Every video in the series follows this exact 6-section structure. This consistency is what makes a 28-video library feel like one product instead of 28 random uploads.

A finished script is a **two-column document**:
- **Left:** Voiceover (what ElevenLabs speaks)
- **Right:** Visuals (what After Effects / Descript shows)

Use this template as a copy-paste starting point for every new script.

---

## File header (always present)

```
TITLE:        [exact title from CURRICULUM.md]
ID:           [01-28]
SERIES:       [1-6]
DURATION:     [target seconds, e.g. 180]
PREREQUISITE: [video IDs the viewer should watch first, or "none"]
TABS LINKED:  [Scan-Master tabs that trigger this video as contextual help]
LAST UPDATED: [YYYY-MM-DD]
```

---

## Section structure

### 1. COLD OPEN (0:00 - 0:05)
A 5-second hook **before** the title card. No music yet, just dramatic moment.

**Rules:**
- Show a problem, not the solution.
- One sentence max for VO.
- End on a freeze-frame or signal "ping" that crashes into the title card.

**Examples that work:**
- "An inspector approves a turbine blade. Six months later, a crack appears mid-flight."
- "Your A-scan is full of noise. You can't tell a defect from a backwall."
- "Wrong material velocity. Every measurement you took today is wrong."

---

### 2. TITLE CARD + INTRO (0:05 - 0:20)
- Title card animates in for 3 seconds
- Music bed fades up at -28 LUFS
- VO introduces: what you'll learn + why it matters + what video this assumes

**Template VO:**
> "Welcome to ScanMaster Training. In this video, you'll learn [WHAT].
> By the end, you'll be able to [SPECIFIC OUTCOME].
> If you haven't watched [PREREQUISITE VIDEO], pause and do that first."

---

### 3. CONCEPT EXPLAINER (0:20 - 1:30)
**This is where motion graphics live.** No software screens yet — pure animated explanation of the *idea*.

**Structure:**
1. Define the term in plain English (one sentence).
2. The analogy ("it's like ___").
3. The visual: an animated diagram showing the concept.
4. Why it matters in practice (one sentence).

**Output:** Viewer can now explain the concept to a colleague without seeing the software.

---

### 4. DEMO (1:30 - 3:30)
**The follow-along section.** Synthetic screen recording of MCI/O with cursor moves and click feedback.

**Rules:**
- One action per sentence. "Open the Timebase tab." (beat) "Click 'Edit' under Material."
- Show every click with the cyan ring feedback (BRAND_KIT.md).
- Zoom in to the part of the screen that matters. Don't make viewers hunt.
- Pause for 1 second after each meaningful state change.
- Highlight values with cyan underline as they're set.

**Output:** Viewer can pause the video and reproduce the steps in their own MCI/O.

---

### 5. COMMON MISTAKES (3:30 - 4:00)
"Mistake Warning Box" overlay (red border, see BRAND_KIT.md).

**Pattern:**
1. State the mistake. "Setting the SF threshold above the front-wall amplitude."
2. Show what goes wrong. (animation)
3. The fix. "Start at 30% FSH and adjust from there."

**Rule:** Two mistakes max per video. Three feels preachy.

---

### 6. RECAP + CTA (4:00 - 4:30)
The "you got this" closer.

**Pattern:**
1. Three-bullet recap on screen (Inter Display 500, 32px, cyan dots).
2. VO summarizes in one sentence.
3. CTA: "Next, watch [NEXT VIDEO TITLE] to learn [NEXT TOPIC]."
4. Outro sting + logo reveal.

---

## Script formatting

Use this exact table format for every script (Markdown renders cleanly in Descript imports):

```markdown
## 1. COLD OPEN (0:00 - 0:05)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:00 | (silence — let the visual breathe) | Black frame. White text fades in: "100,000 flights. One missed defect." |
| 0:03 | (sound effect: low "thump") | Title card crashes in, cyan A-scan trace ripples across. |

## 2. TITLE CARD + INTRO (0:05 - 0:20)

| Time | VOICEOVER | VISUAL |
|------|-----------|--------|
| 0:05 | Welcome to ScanMaster Training. | Title card: "What is Ultrasonic Testing?" |
| 0:10 | In the next three minutes, you'll learn the four pieces of every UT inspection — and why they matter. | Three-icon row fades in: pulser, transducer, part, A-scan. |

...continued for each section
```

---

## Voiceover-specific instructions for ElevenLabs

Add **directional tags** in square brackets where intonation matters:

```
[confident] You'll use this every single day.
[curious] What if the part has variable thickness?
[reassuring] Don't worry — we'll cover this in the next video.
[serious] Get this wrong, and the entire scan is invalid.
```

ElevenLabs v3 reads these tags as emotional direction. Use sparingly — one tag per 30 seconds max.

**Punctuation rules for natural pacing:**
- Comma = 200 ms pause
- Period = 400 ms pause
- Em-dash (—) = 600 ms pause (use for dramatic emphasis)
- Triple-dot (…) = 900 ms pause (use rarely)

---

## Visual instructions for After Effects / Descript

Use bracket-prefixed directives in the VISUAL column:

| Directive | Example | Meaning |
|-----------|---------|---------|
| `[CUT]` | `[CUT] to wide shot of A-scan` | Hard cut |
| `[FADE]` | `[FADE] in title card over 1.2s` | Crossfade |
| `[ZOOM]` | `[ZOOM] to 200% on Material dropdown over 800ms` | Animated zoom |
| `[HIGHLIGHT]` | `[HIGHLIGHT] cyan ring around "Edit" button` | Cyan glow overlay |
| `[CALLOUT]` | `[CALLOUT] Lower-third: "MSPS = mega samples per second"` | Lower-third anim |
| `[TIP]` | `[TIP] Pro tip box: "Pulse width = 25% of frequency"` | Yellow tip overlay |
| `[MISTAKE]` | `[MISTAKE] Warning box: "Threshold too high → latch fails"` | Red warning overlay |
| `[BROLL]` | `[BROLL] Sora: jet engine inspection close-up, 4s` | Runway/Sora B-roll |
| `[ANIM]` | `[ANIM] AE template "wave-propagation.aep"` | After Effects template |
| `[SCREEN]` | `[SCREEN] Synthetic MCI/O: Timebase tab, cursor at Material > Edit` | Synthetic screen recording |

This vocabulary is what AI assembly tools parse, so it must be consistent across all 28 scripts.

---

## Length budget per series

| Series | Target VO length | Notes |
|--------|------------------|-------|
| 1 (Foundations) | 2:30-3:30 | Concept-heavy, faster pace |
| 2 (First-Time Setup) | 3:30-4:30 | Includes software demo, slow pace |
| 3 (Gates) | 3:30-4:30 | Demo-heavy |
| 4 (TCG/DAC) | 4:30-5:30 | Hardest content, allow breathing room |
| 5 (Real Inspections) | 5:30-6:30 | Full walkthroughs |
| 6 (Advanced) | 4:30-5:30 | Expects familiarity, fewer recaps |

---

## QA checklist (before sending to production)

Before submitting any script for voiceover generation:

- [ ] All 6 sections present in order
- [ ] Two-column table format with time stamps
- [ ] Voiceover word count = (duration_seconds / 60) × 150  (±10%)
- [ ] No banned words: "basically", "obviously", "as you can see", "in this video we will"
- [ ] No passive voice
- [ ] All visual directives use the bracket vocabulary
- [ ] Prerequisite & next-video links match CURRICULUM.md
- [ ] Glossary terms italicized on first use
- [ ] Read aloud to a non-expert — they understand it without pausing

---

**Next document:** [`scripts/01-what-is-ultrasonic-testing.md`](./scripts/01-what-is-ultrasonic-testing.md) — the first full script as the working example of everything above.
