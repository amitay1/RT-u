"""
MCI/O #1 — Getting Started: Your First Session
Full video builder. Uses extracted PDF figures + Manim animations + ffmpeg.

Output: training-videos/assets/mcio-01/mcio-01-FINAL.mp4

Run:
    python build_video.py

Phases:
    1. Generate placeholder TTS voiceover from script (gTTS)
    2. Render 9 Manim scenes (one per section)
    3. Mix audio (VO + music + stings)
    4. Concatenate scenes + add audio + add captions
"""

import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
ANIM_DIR = REPO / "training-videos" / "animations" / "mcio-01"
ASSETS = REPO / "training-videos" / "assets" / "mcio-01"
PDF_FIGS = REPO / "training-videos" / "assets" / "pdf-figures"
SCENES_OUT = ASSETS / "scenes"
AUDIO_OUT = ASSETS / "audio"
SCENES_OUT.mkdir(parents=True, exist_ok=True)
AUDIO_OUT.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────────────────────
# 1. SCRIPT (voiceover lines, ordered, with target durations)
# ─────────────────────────────────────────────────────────────────
SCRIPT = [
    # (scene_id, duration_seconds, voiceover_text)
    ("01-cold-open", 8.0, "You opened MCI/O. Two windows. No tutorial. Let's read them like the manual does."),
    ("02-title-goal", 17.0, "Welcome to MCI/O Training. In the next three and a half minutes you'll log in, name every element of the main window, tour the Setup Toolbox, and exit safely. Exactly as the manual prescribes."),
    ("03-what-mcio-is", 30.0, "The MCI O Instrument application sets all U T parameters. It is used both to calibrate the system, and to configure individual U T setups according to scanning specifications. It runs on Windows 2000 or higher. It works with a U P R 100 U T board and an R P P 3 pulser. Depending on your applications, it can drive one or more ultrasonic programmable receiver cards, and one or more Sensoray 826 cards."),
    ("04-launching", 27.0, "Open it like this. From the Windows desktop, double-click the MCI O icon. The Logon window appears, superimposed on the MCI O splash screen. Enter your user name and password, then click O K. Two windows appear. The INSTRUMENT window and the Setup Toolbox dialog box. The application is ready for use."),
    ("05-instrument", 43.0, "Eight elements. Memorise them. One: the Toolbar. One click shortcuts to selected actions and display modes. Two: the Status Display area. Shows selected parameters set by the Online Info Configuration function. Three: the Full Screen Height display. The amplitude axis. Units can be percentage, decibels, volts, or A D bits. Four: the A Scan Display area. The signals you receive during a scan. Five: the Gain slider. Drag the mouse pointer to adjust total or receiver gain. Six: the Timebase axis. Current range and delay. Drag the white arrows for zoom. Seven: the Status bar. Selected U T setup parameters. Eight: the Messages area. Error messages and software status."),
    ("06-setup-toolbox", 40.0, "Now the Setup Toolbox. This is where you configure ultrasonic parameters. Its toolbar has five buttons. The first opens this manual. The second opens the Channel dialog box to add another channel's A Scan window. The third hides the tabs. The fourth shows them. The fifth begins the closing process. Below the toolbar: twelve tabs. We'll dedicate a video to each. Quick scan: Timebase. Zoom Trig. Pulser. Gain. Receiver. Display. Gates. T C G. Files. Global. I O. Analog Input."),
    ("07-exiting", 25.0, "Exiting follows a specific sequence. One. From the top right corner of the Setup Toolbox dialog box, click the close button. An exit warning appears in the Messages area of the INSTRUMENT window. Two. To quit, click O K. An overwrite warning window appears. Three. To save the parameters from this session as the default Global Setup, click Yes. To keep the previous default, click No. The session ends."),
    ("08-hardware-status", 10.0, "One note. In the Global tab, the Hardware Status frame shows the hardware installed on the back plane. Those checkboxes are pre-programmed. You cannot change them. By design."),
    ("09-recap-cta", 10.0, "Quick recap. Two windows: INSTRUMENT and Setup Toolbox. Eight elements, five toolbar buttons, twelve tabs. Three-step exit. Next: your first Timebase."),
]

TOTAL_DURATION = sum(d for _, d, _ in SCRIPT)
assert abs(TOTAL_DURATION - 210) < 5, f"Total duration {TOTAL_DURATION} should be ~210s"


# ─────────────────────────────────────────────────────────────────
# 2. GENERATE TTS PLACEHOLDER VOICEOVER
# ─────────────────────────────────────────────────────────────────
def generate_tts():
    """Use gTTS to create a placeholder voiceover for each scene."""
    from gtts import gTTS

    for scene_id, _, text in SCRIPT:
        out = AUDIO_OUT / f"vo-{scene_id}.mp3"
        if out.exists():
            print(f"  - vo-{scene_id}.mp3 already exists, skipping")
            continue
        tts = gTTS(text=text, lang="en", tld="com", slow=False)
        tts.save(str(out))
        print(f"  [OK] Generated vo-{scene_id}.mp3")


# ─────────────────────────────────────────────────────────────────
# 3. MAIN
# ─────────────────────────────────────────────────────────────────
def main():
    print("\n[1/4] Generating TTS placeholder voiceover…")
    generate_tts()

    print("\n[2/4] Rendering Manim scenes…")
    # Renders are invoked by separate Manim files (run_scenes.py)
    print("  → run: python -m manim -qh scene_NN.py SceneName  (or run_scenes.py)")

    print("\n[3/4] Mixing audio…")
    print("  → run: bash assemble.sh  (TBD)")

    print("\n[4/4] Final composition…")
    print(f"  → Output: {ASSETS / 'mcio-01-FINAL.mp4'}")


if __name__ == "__main__":
    main()
