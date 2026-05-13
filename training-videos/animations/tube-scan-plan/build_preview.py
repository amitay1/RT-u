"""
Tube Scan Plan Guide — placeholder Preview builder.
Generates per-section gTTS voiceover, aligns it to the matching Manim
animation (padding last frame if VO is longer), then concatenates everything
with brand bars + music.

Output: training-videos/assets/tube-scan-plan/PREVIEW.mp4
"""

import subprocess
import sys
from pathlib import Path

from gtts import gTTS

REPO = Path(__file__).resolve().parents[3]
ANIM_DIR = REPO / "training-videos" / "assets" / "tube-scan-plan" / "animations"
ASSETS = REPO / "training-videos" / "assets" / "tube-scan-plan"
TMP = ASSETS / "tmp_segments"
AUDIO_OUT = ASSETS / "audio"
TMP.mkdir(parents=True, exist_ok=True)
AUDIO_OUT.mkdir(parents=True, exist_ok=True)

MUSIC = REPO / "training-videos" / "assets" / "01-what-is-ut" / "audio" / "music-bed-anders-bothen.wav"


# ─────────────────────────────────────────────────────────────────
# Script — VO text per section + matching animation
# ─────────────────────────────────────────────────────────────────
# Each entry: (id, animation_mp4 or None, voiceover_text)
SCRIPT = [
    ("01-intro", "IntroTitle.mp4",
     "T-C-G Calibration for Normal Beam Inspection. In this video, you will learn how to create, verify, and save a T-C-G setup in ScanMaster."),

    ("02-equipment", "RequiredEquipment.mp4",
     "Before you start. Prepare six items. The ScanMaster system. A normal beam probe. A calibration block with at least three F-B-H reflectors, three sixty-fourths inch or as required. The correct material velocity for the material. A stable water path. And access to Teach In mode. Once everything is ready, open the ScanMaster Wizard."),

    ("03-fbh-labels", "FBHLabels.mp4",
     "On the calibration block, three F-B-H standards at different depths. We'll work from near to far. Standard one, near. Standard two, middle. Standard three, far."),

    ("04-teach-in", "OpenScanMasterTeachIn.mp4",
     "Open the ScanMaster Wizard. From the main menu, click Teach In. A new screen image appears. The INSTRUMENT window plus the Setup Toolbox dialog."),

    ("05-basic-params", "SetBasicParameters.mp4",
     "First, set the basic parameters. Four fields. One. Material velocity. From the material database, select the material you're inspecting. Two. Range. Set the range until you see the back wall. Three. Gain. Verify the response from the three sixty-fourths inch F-B-H. Four. Water path. Set seventy-six millimetres, or set the transducer-to-surface distance so the second front reflection does not appear between the first front and first back reflections."),

    ("06-water-warning", "WaterPathWarning.mp4",
     "Important. Keep the water path consistent, within plus or minus one quarter inch, during standardisation, initial scanning, and final evaluation. Deviation beyond plus or minus a quarter inch requires re-standardisation."),

    ("07-before-after", "BeforeAfterTCG.mp4",
     "Before we set anything else, understand what T-C-G is solving. Before T-C-G, three identical flat-bottom holes, three different signal heights. Closer means stronger. Farther means weaker. After T-C-G, all F-B-H responses adjusted to eighty per cent F-S-H. One reference level. One pass-fail criterion. Across depth. That is our goal. Let's build it."),

    ("08-active-visible-drag", "ActiveVisibleDrag.mp4",
     "Inside the Setup Toolbox, click the T-C-G tab. The T-C-G table appears. Before any other action, verify three checkboxes on the right side of the T-C-G tab. Active. Visible. Drag. All three must be checked. If Drag is off, you cannot drag the yellow dots in the next steps."),

    ("09-point-sequence", "PointSequence.mp4",
     "The same action, repeated three times. Set Point one, near F-B-H at eighty per cent F-S-H. Set Point two, middle F-B-H at eighty per cent F-S-H. Set Point three, far F-B-H at eighty per cent F-S-H. Drag yellow dot. Eighty per cent F-S-H. Save. Three times."),

    ("10-point1", "DragAnd80FSH.mp4",
     "Move the probe to the first F-B-H, the near standard. On the A-scan, drag the yellow dot onto the response peak. Adjust the Gain so the F-B-H amplitude reaches eighty per cent F-S-H. As you turn Gain up, the trace rises. Stop when the peak touches the cyan reference line. Save Point one. Click the save button on the toolbar setup. Node one, locked."),

    ("11-point2", "DragAnd80FSH.mp4",
     "Move the probe to the second F-B-H, the middle standard. Drag the second yellow dot onto the new response peak. Adjust Gain so this peak also reaches eighty per cent F-S-H. Save Point two. Node two, locked."),

    ("12-point3", "DragAnd80FSH.mp4",
     "Move the probe to the third F-B-H, the far standard. Drag the third yellow dot onto the response peak. Adjust Gain to eighty per cent F-S-H. Save Point three. Node three, locked. Three reference points set. One detail from the guide. With more than three segments, scroll boxes appear to the right of the segment list. The active segment is marked with an arrow next to its number."),

    ("13-backwall", "OptionalBackWallPoints.mp4",
     "An optional step thirteen, for inspections that extend to full part depth. Add a T-C-G point on the back-wall response. Click the toolbar button to set the first point before the back-wall pulse. Then the second point after the back-wall pulse. Create at least four points in total to define the T-C-G curve through the back-wall response. Optional. Skip this step if your inspection only covers the F-B-H depth range."),

    ("14-save", "SaveTCGSetup.mp4",
     "Now save the T-C-G setup. Four clicks. One, click the Files tab in the Setup Toolbox. Two, under T-C-G, click Save. Three, the U-P-R-D-B Navigator dialog opens. The default file path is displayed at the bottom. Four, name the file. We recommend a naming convention that includes the probe type, the F-B-H size, and the date. Click Save. T-C-G setup saved."),

    ("15-checklist", "FinalChecklist.mp4",
     "Quick checklist before you run the inspection. Teach In opened. Material velocity set. Range set. Water path kept within plus or minus a quarter inch. Three F-B-H responses set to eighty per cent F-S-H. Optional back-wall points added if needed. T-C-G setup saved. Your T-C-G is ready. Run the inspection."),

    ("16-outro", "FinalChecklist.mp4",  # reuse final-checklist tail as outro
     "If you need to recalibrate after a probe change, a material change, or any deviation in water path, return to step three. The full Scan Plan documentation is available in the Scan Plan tab."),
]


def probe_duration(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
    ], text=True)
    return float(out.strip())


def generate_tts():
    print("[1/3] Generating gTTS voiceover per section...")
    for sec_id, _, text in SCRIPT:
        out = AUDIO_OUT / f"vo-{sec_id}.mp3"
        if out.exists():
            print(f"  - vo-{sec_id}.mp3 exists, skipping")
            continue
        tts = gTTS(text=text, lang="en", tld="com", slow=False)
        tts.save(str(out))
        print(f"  [OK] vo-{sec_id}.mp3")


def build_segments():
    print("\n[2/3] Building per-section MP4s aligned to VO...")
    seg_paths = []
    for sec_id, anim_name, _ in SCRIPT:
        anim = ANIM_DIR / anim_name
        vo = AUDIO_OUT / f"vo-{sec_id}.mp3"
        out = TMP / f"seg-{sec_id}.mp4"

        v_dur = probe_duration(anim)
        a_dur = probe_duration(vo)
        target = max(v_dur, a_dur) + 0.2

        cmd = [
            "ffmpeg", "-y",
            "-i", str(anim),
            "-i", str(vo),
            "-filter_complex",
            (
                f"[0:v]tpad=stop_mode=clone:stop_duration={max(0, target - v_dur):.3f},setpts=PTS-STARTPTS,fps=60[v];"
                f"[1:a]apad=pad_dur={max(0, target - a_dur):.3f}[a]"
            ),
            "-map", "[v]", "-map", "[a]",
            "-t", f"{target:.3f}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            str(out),
        ]
        subprocess.check_output(cmd, stderr=subprocess.STDOUT)
        print(f"  [OK] seg-{sec_id}.mp4  (video={v_dur:.1f}s  vo={a_dur:.1f}s  target={target:.1f}s)")
        seg_paths.append(out)
    return seg_paths


def assemble_final(segments):
    print("\n[3/3] Final composite (concat + branding + music)...")

    # Concat list
    concat_list = TMP / "concat.txt"
    with open(concat_list, "w") as f:
        for seg in segments:
            f.write(f"file '{seg.as_posix()}'\n")

    combined = TMP / "combined.mp4"
    subprocess.check_output([
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
        "-c", "copy",
        str(combined),
    ], stderr=subprocess.STDOUT)
    total = probe_duration(combined)
    print(f"  Concatenated: {total:.1f}s")

    final = ASSETS / "PREVIEW.mp4"
    cmd = [
        "ffmpeg", "-y",
        "-i", str(combined),
        "-stream_loop", "-1", "-i", str(MUSIC),
        "-filter_complex",
        (
            # Top brand bar
            f"[0:v]drawbox=x=0:y=0:w=1920:h=80:color=0x111A2E@0.92:t=fill[v1];"
            f"[v1]drawtext=text='ScanMaster Training':fontfile='C\\:/Windows/Fonts/arialbd.ttf':fontsize=30:fontcolor=0x22D3EE:x=60:y=24[v2];"
            f"[v2]drawtext=text='Tube Scan Plan Guide  ·  Normal Beam TCG Calibration':fontfile='C\\:/Windows/Fonts/arial.ttf':fontsize=22:fontcolor=0xE2E8F0:x=60:y=58[v3];"
            # Bottom brand bar
            f"[v3]drawbox=x=0:y=1000:w=1920:h=80:color=0x111A2E@0.92:t=fill[v4];"
            f"[v4]drawbox=x=0:y=998:w=1920:h=2:color=0x22D3EE@0.7:t=fill[v5];"
            f"[v5]drawtext=text='ScanMaster Systems Ltd  ·  scanmaster-irt.com':fontfile='C\\:/Windows/Fonts/arial.ttf':fontsize=20:fontcolor=0x94A3B8:x=60:y=1027[v6];"
            f"[v6]drawtext=text='PLACEHOLDER VOICEOVER  ·  Replace with ElevenLabs export':fontfile='C\\:/Windows/Fonts/arial.ttf':fontsize=16:fontcolor=0xF59E0B:x=60:y=1053[vfinal];"
            # Audio mix
            f"[1:a]volume=0.08[music];"
            f"[0:a]loudnorm=I=-14:LRA=11:TP=-1.5[vo];"
            f"[vo][music]amix=inputs=2:duration=first:normalize=0[audio]"
        ),
        "-map", "[vfinal]", "-map", "[audio]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "256k",
        "-t", f"{total:.3f}",
        str(final),
    ]
    subprocess.check_output(cmd, stderr=subprocess.STDOUT)

    final_dur = probe_duration(final)
    print(f"\n[DONE] {final}")
    print(f"       Duration: {final_dur:.1f}s  ({final_dur/60:.1f} min)")
    print(f"       Size:     {final.stat().st_size / 1_000_000:.1f} MB")


def main():
    generate_tts()
    segments = build_segments()
    assemble_final(segments)


if __name__ == "__main__":
    main()
