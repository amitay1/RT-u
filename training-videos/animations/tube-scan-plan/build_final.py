"""
Tube Scan Plan Guide ג€” FINAL production builder.
Takes the real ElevenLabs Adam voiceover, transcribes it with Whisper,
finds the section boundaries by matching anchor phrases, slices the VO
into 16 segments, aligns each segment to its Manim animation (freezing
the last frame if VO is longer), and concatenates with brand bars,
music bed, and a burned-in caption SRT.

Output:
  training-videos/assets/tube-scan-plan/FINAL.mp4
"""

import json
import re
import subprocess
import sys
from pathlib import Path

import whisper

REPO = Path(__file__).resolve().parents[3]
ANIM_DIR = REPO / "training-videos" / "assets" / "tube-scan-plan" / "animations"
ASSETS = REPO / "training-videos" / "assets" / "tube-scan-plan"
AUDIO = ASSETS / "audio"
TMP = ASSETS / "tmp_final"
TMP.mkdir(parents=True, exist_ok=True)

VO_CANDIDATES = [
    AUDIO / "ElevenLabs_2026-05-13T02_34_04_Mark - Natural Conversations_pvc_sp86_s39_sb75_v3.mp3",
    AUDIO / "voiceover-tube-scan-plan-v5.wav",
    AUDIO / "ElevenLabs_Untitled_project.wav",
]
VO_SRC = next((path for path in VO_CANDIDATES if path.exists()), VO_CANDIDATES[-1])
MUSIC = REPO / "training-videos" / "assets" / "01-what-is-ut" / "audio" / "music-bed-anders-bothen.wav"


# (id, animation_mp4, anchor_phrase used to locate section start in transcript, lower_third_title)
SECTIONS = [
    ("01-intro",              "IntroTitle.mp4",              "tcg calibration for normal beam",                "Introduction"),
    ("02-equipment",          "RequiredEquipment.mp4",       "before you start",                               "Step 1  /  Required Equipment"),
    ("03-fbh-labels",         "FBHLabels.mp4",               "on the calibration block",                       "Step 2  /  FBH Standards"),
    ("04-teach-in",           "OpenScanMasterTeachIn.mp4",   "open the scanmaster wizard. from the main menu", "Step 3  /  Open Teach In"),
    ("05-basic-params",       "SetBasicParameters.mp4",      "first set the basic parameters",                 "Step 4  /  Basic Parameters"),
    ("06-water-warning",      "WaterPathWarning.mp4",        "important. keep the water path",                 "Important  /  Water Path"),
    ("07-before-after",       "BeforeAfterTCG.mp4",          "before we set anything else",                    "Concept  /  What TCG Solves"),
    ("08-active-visible-drag","ActiveVisibleDrag.mp4",       "inside the setup toolbox",                       "Step 5  /  Active . Visible . Drag"),
    ("09-point-sequence",     "PointSequence.mp4",           "the same action repeated three times",           "Step 6  /  Three Points Overview"),
    ("10-point1",             "DragAnd80FSH.mp4",            "move the probe to the first",                    "Step 7  /  Point 1  -  Near FBH"),
    ("11-point2",             "DragAnd80FSHShort.mp4",       "move the probe to the second",                   "Step 8  /  Point 2  -  Middle FBH"),
    ("12-point3",             "DragAnd80FSH.mp4",            "move the probe to the third",                    "Step 9  /  Point 3  -  Far FBH"),
    ("13-backwall",           "OptionalBackWallPoints.mp4",  "if your inspection extends to full part depth",  "Optional  /  Back-wall Points"),
    ("14-save",               "SaveTCGSetup.mp4",            "now save the tcg setup",                         "Step 10  /  Save TCG Setup"),
    ("15-checklist",          "FinalChecklist.mp4",          "quick checklist before you run",                 "Final Checklist"),
    ("16-outro",              "OutroSummary.mp4",            "if you need to recalibrate",                     "Wrap-up"),
]


def normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[-ג€“ג€”]+", " ", text)
    replacements = [
        (r"\btee\s+see\s+gee\b", "tcg"),
        (r"\bt\s+c\s+g\b", "tcg"),
        (r"\beff\s+bee\s+aitch\b", "fbh"),
        (r"\bf\s+b\s+h\b", "fbh"),
        (r"\beff\s+ess\s+aitch\b", "fsh"),
        (r"\bf\s+s\s+h\b", "fsh"),
        (r"\byou\s+pee\s+arr\s+dee\s+bee\b", "uprdb"),
        (r"\bu\s+p\s+r\s+d\s+b\b", "uprdb"),
    ]
    for pattern, replacement in replacements:
        text = re.sub(pattern, replacement, text)
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def probe_duration(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
    ], text=True)
    return float(out.strip())


def transcribe():
    cache = AUDIO / f"whisper-{VO_SRC.stem}.json"
    if cache.exists():
        print("[1/5] Using cached Whisper transcription")
        return json.loads(cache.read_text(encoding="utf-8"))

    print("[1/5] Transcribing ElevenLabs VO with Whisper (small.en)...")
    model = whisper.load_model("small.en")
    result = model.transcribe(
        str(VO_SRC),
        word_timestamps=True,
        verbose=False,
        condition_on_previous_text=False,
        initial_prompt="TCG calibration FBH FSH ScanMaster UPRDB Navigator Teach In Setup Toolbox normal beam probe water path back wall",
    )
    cache.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"  [OK] {len(result['segments'])} segments, {result.get('duration', '?')}s total")
    return result


def find_section_starts(result):
    print("\n[2/5] Locating section boundaries...")
    full_words = []
    for seg in result["segments"]:
        for w in seg.get("words", []):
            full_words.append((normalize(w["word"]), w["start"]))

    flat_text = " ".join(w for w, _ in full_words)
    starts = []
    cursor_word_idx = 0

    for sec_id, _, anchor, _ in SECTIONS:
        anchor_norm = normalize(anchor)
        anchor_tokens = anchor_norm.split()
        first_token = anchor_tokens[0]

        found_idx = None
        for i in range(cursor_word_idx, len(full_words) - len(anchor_tokens) + 1):
            if full_words[i][0] != first_token:
                continue
            candidate = " ".join(full_words[j][0] for j in range(i, i + len(anchor_tokens)))
            if candidate == anchor_norm:
                found_idx = i
                break

        if found_idx is None:
            print(f"  [WARN] anchor not found for {sec_id} ('{anchor}') ג€” falling back to first-token match")
            for i in range(cursor_word_idx, len(full_words)):
                if full_words[i][0] == first_token:
                    found_idx = i
                    break

        if found_idx is None:
            raise RuntimeError(f"Cannot locate section {sec_id}")

        start_time = full_words[found_idx][1]
        starts.append((sec_id, start_time))
        cursor_word_idx = found_idx + 1
        print(f"  {sec_id:30s} starts @ {start_time:7.2f}s  (word#{found_idx})")

    return starts


def slice_voiceover(starts, total_duration):
    print("\n[3/5] Slicing voiceover...")
    slices = []
    for i, (sec_id, start) in enumerate(starts):
        end = starts[i + 1][1] if i + 1 < len(starts) else total_duration
        eff_start = start
        out = TMP / f"vo-{sec_id}.m4a"
        if out.exists():
            slices.append((sec_id, out, end - eff_start))
            continue
        subprocess.check_output([
            "ffmpeg", "-y",
            "-i", str(VO_SRC),
            "-ss", f"{eff_start:.3f}",
            "-to", f"{end:.3f}",
            "-vn", "-c:a", "aac", "-b:a", "192k",
            str(out),
        ], stderr=subprocess.STDOUT)
        slices.append((sec_id, out, end - eff_start))
        print(f"  [OK] vo-{sec_id}.m4a  ({end-eff_start:.2f}s)")
    return slices


def build_segments(slices):
    print("\n[4/5] Building per-section MP4s...")
    seg_paths = []
    for (sec_id, vo_path, vo_dur), (_, anim_name, _, lower_third) in zip(slices, SECTIONS):
        # For outro (no dedicated animation), reuse FinalChecklist
        anim_file = anim_name if anim_name else "FinalChecklist.mp4"
        anim = ANIM_DIR / anim_file
        out = TMP / f"seg-{sec_id}.mp4"

        v_dur_full = probe_duration(anim)
        a_dur = probe_duration(vo_path)
        # Trim ~1.5s off the end of each Manim animation to skip its FadeOut,
        # so the freeze frame shows actual content instead of black.
        FADEOUT_TRIM = 1.5
        v_dur = max(0.5, v_dur_full - FADEOUT_TRIM)
        target = max(v_dur, a_dur) + 0.15
        freeze_dur = max(0, target - v_dur)

        # Lower-third alpha curve: 0 -> 1 over 0.5-0.8s, hold 0.8-3.7s, 1 -> 0 over 3.7-4.0s
        lt_alpha = "if(lt(t,0.5),0,if(lt(t,0.8),(t-0.5)/0.3,if(lt(t,3.7),1,if(lt(t,4.0),(4.0-t)/0.3,0))))"

        cmd = [
            "ffmpeg", "-y",
            "-i", str(anim),
            "-i", str(vo_path),
            "-filter_complex",
            (
                # Trim FadeOut, freeze last good content frame
                f"[0:v]trim=duration={v_dur:.3f},setpts=PTS-STARTPTS,"
                f"tpad=stop_mode=clone:stop_duration={freeze_dur:.3f},"
                # Scale Manim down so brand bars (80px each) don't clip content
                f"scale=1920:920:flags=lanczos,"
                f"pad=1920:1080:0:80:color=0x0B1220,"
                # Lower-third chapter title (top-left, inside top safe-zone)
                f"drawbox=x=60:y=98:w=720:h=48:color=0x111A2E@0.85:t=fill:enable='between(t,0.6,3.9)',"
                f"drawtext=text='{lower_third}':fontfile='C\\:/Windows/Fonts/arialbd.ttf':"
                f"fontsize=24:fontcolor=0x22D3EE:x=80:y=110:alpha='{lt_alpha}',"
                # Smooth in/out at segment boundaries
                f"fade=t=in:st=0:d=0.4,"
                f"fade=t=out:st={target - 0.5:.3f}:d=0.5,"
                f"fps=60[v];"
                f"[1:a]apad=pad_dur={max(0, target - a_dur):.3f}[a]"
            ),
            "-map", "[v]", "-map", "[a]",
            "-t", f"{target:.3f}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            str(out),
        ]
        subprocess.check_output(cmd, stderr=subprocess.STDOUT)
        print(f"  [OK] seg-{sec_id}.mp4  (video={v_dur:.1f}s  vo={a_dur:.1f}s  target={target:.1f}s)  [{lower_third}]")
        seg_paths.append(out)
    return seg_paths


def write_srt(starts, total_duration, result):
    """Generate SRT from Whisper segments, clipped to total duration."""
    srt_path = TMP / "captions.srt"
    lines = []
    idx = 1
    for seg in result["segments"]:
        start = seg["start"]
        end = min(seg["end"], total_duration)
        if end <= start:
            continue
        text = seg["text"].strip()
        if not text:
            continue
        def fmt(t):
            h = int(t // 3600)
            m = int((t % 3600) // 60)
            s = int(t % 60)
            ms = int((t - int(t)) * 1000)
            return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
        lines.append(f"{idx}")
        lines.append(f"{fmt(start)} --> {fmt(end)}")
        lines.append(text)
        lines.append("")
        idx += 1
    srt_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"  [OK] captions.srt ({idx-1} cues)")
    return srt_path


def assemble_final(segments, srt_path):
    print("\n[5/5] Final composite (concat + branding + music + captions)...")

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

    final = ASSETS / "FINAL.mp4"
    srt_escaped = str(srt_path).replace("\\", "/").replace(":", "\\:")

    cmd = [
        "ffmpeg", "-y",
        "-i", str(combined),
        "-stream_loop", "-1", "-i", str(MUSIC),
        "-filter_complex",
        (
            # Top brand bar
            f"[0:v]drawbox=x=0:y=0:w=1920:h=80:color=0x111A2E@0.92:t=fill[v1];"
            f"[v1]drawtext=text='ScanMaster Training':fontfile='C\\:/Windows/Fonts/arialbd.ttf':fontsize=30:fontcolor=0x22D3EE:x=60:y=24[v2];"
            f"[v2]drawtext=text='Tube Scan Plan Guide  ֲ·  Normal Beam TCG Calibration':fontfile='C\\:/Windows/Fonts/arial.ttf':fontsize=22:fontcolor=0xE2E8F0:x=60:y=58[v3];"
            # Bottom brand bar
            f"[v3]drawbox=x=0:y=1000:w=1920:h=80:color=0x111A2E@0.92:t=fill[v4];"
            f"[v4]drawbox=x=0:y=998:w=1920:h=2:color=0x22D3EE@0.7:t=fill[v5];"
            f"[v5]drawtext=text='ScanMaster Systems Ltd  ֲ·  scanmaster-irt.com':fontfile='C\\:/Windows/Fonts/arial.ttf':fontsize=20:fontcolor=0x94A3B8:x=60:y=1027[v6];"
            # Captions disabled in this build ג€” they were overlapping Manim's bottom-positioned text
            # (e.g. "Peak at 80% FSH ג“" in ֲ§10-12, "One reference level" in ֲ§07). Lower-thirds + VO
            # carry the narrative. Re-enable later in Descript or with a wider safe-zone layout.
            f"[v6]null[vfinal];"
            # Audio mix with sidechain ducking:
            # Music sits at 0.18 base, ducked to ~0.05 when VO is active (auto-balances).
            f"[1:a]volume=0.18[music];"
            f"[0:a]loudnorm=I=-14:LRA=11:TP=-1.5,asplit=2[vo_main][vo_key];"
            f"[music][vo_key]sidechaincompress=threshold=0.04:ratio=10:attack=8:release=400:makeup=1[music_ducked];"
            f"[vo_main][music_ducked]amix=inputs=2:duration=first:normalize=0[audio]"
        ),
        "-map", "[vfinal]", "-map", "[audio]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
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
    result = transcribe()
    total_duration = probe_duration(VO_SRC)
    starts = find_section_starts(result)
    slices = slice_voiceover(starts, total_duration)
    segments = build_segments(slices)
    srt = write_srt([s for s in starts], total_duration, result)
    assemble_final(segments, srt)


if __name__ == "__main__":
    main()
