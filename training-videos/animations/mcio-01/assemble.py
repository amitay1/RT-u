"""
Final assembly for MCI/O Video #1.
Stitches all 9 scenes with their voiceovers + music + branding bars + captions.
"""

import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
SCENE_DIR = Path(__file__).parent / "media" / "videos" / "scenes" / "1080p60"
AUDIO_DIR = REPO / "training-videos" / "assets" / "mcio-01" / "audio"
ASSETS = REPO / "training-videos" / "assets" / "mcio-01"
MUSIC = REPO / "training-videos" / "assets" / "01-what-is-ut" / "audio" / "music-bed-anders-bothen.wav"

SCENES = [
    ("Scene01", "vo-01-cold-open.mp3"),
    ("Scene02", "vo-02-title-goal.mp3"),
    ("Scene03", "vo-03-what-mcio-is.mp3"),
    ("Scene04", "vo-04-launching.mp3"),
    ("Scene05", "vo-05-instrument.mp3"),
    ("Scene06", "vo-06-setup-toolbox.mp3"),
    ("Scene07", "vo-07-exiting.mp3"),
    ("Scene08", "vo-08-hardware-status.mp3"),
    ("Scene09", "vo-09-recap-cta.mp3"),
]

TMP = ASSETS / "tmp_segments"
TMP.mkdir(parents=True, exist_ok=True)


def probe_duration(file: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(file),
    ], text=True)
    return float(out.strip())


def build_segment(scene_name: str, vo_name: str, idx: int) -> Path:
    scene_mp4 = SCENE_DIR / f"{scene_name}.mp4"
    vo_mp3 = AUDIO_DIR / vo_name
    out = TMP / f"seg_{idx:02d}.mp4"

    if not scene_mp4.exists():
        print(f"[ERROR] Missing scene: {scene_mp4}")
        sys.exit(1)
    if not vo_mp3.exists():
        print(f"[ERROR] Missing VO: {vo_mp3}")
        sys.exit(1)

    v_dur = probe_duration(scene_mp4)
    a_dur = probe_duration(vo_mp3)
    target = max(v_dur, a_dur) + 0.2  # tiny tail

    print(f"  Segment {idx}: video={v_dur:.1f}s  vo={a_dur:.1f}s  target={target:.1f}s")

    # If video is shorter than audio: freeze last frame
    # If video is longer than audio: pad audio with silence
    cmd = [
        "ffmpeg", "-y",
        "-i", str(scene_mp4),
        "-i", str(vo_mp3),
        "-filter_complex",
        (
            f"[0:v]tpad=stop_mode=clone:stop_duration={max(0, target - v_dur):.3f},setpts=PTS-STARTPTS[v];"
            f"[1:a]apad=pad_dur={max(0, target - a_dur):.3f}[a]"
        ),
        "-map", "[v]", "-map", "[a]",
        "-t", f"{target:.3f}",
        "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        str(out),
    ]
    subprocess.check_output(cmd, stderr=subprocess.STDOUT)
    return out


def main():
    print("[1/3] Building per-segment videos (video + VO aligned)...")
    segments = []
    for i, (scene, vo) in enumerate(SCENES, 1):
        seg = build_segment(scene, vo, i)
        segments.append(seg)

    # Build concat list
    print("\n[2/3] Concatenating segments...")
    concat_list = TMP / "concat.txt"
    with open(concat_list, "w") as f:
        for seg in segments:
            f.write(f"file '{seg.as_posix()}'\n")

    combined = ASSETS / "mcio-01-segments.mp4"
    subprocess.check_output([
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
        "-c", "copy",
        str(combined),
    ], stderr=subprocess.STDOUT)
    print(f"  Built: {combined}")

    # Now overlay branding bars + add music bed + final encode
    print("\n[3/3] Final composite (branding + music + captions)...")
    total = probe_duration(combined)
    print(f"  Total length: {total:.1f}s")

    final = ASSETS / "mcio-01-FINAL.mp4"
    cmd = [
        "ffmpeg", "-y",
        "-i", str(combined),
        "-stream_loop", "-1", "-i", str(MUSIC),
        "-filter_complex",
        (
            # Branding top bar
            f"[0:v]drawbox=x=0:y=0:w=1920:h=80:color=0x111A2E@0.92:t=fill[v1];"
            f"[v1]drawtext=text='ScanMaster Training':fontfile='C\\:/Windows/Fonts/arialbd.ttf':fontsize=30:fontcolor=0x22D3EE:x=60:y=24[v2];"
            f"[v2]drawtext=text='MCI/O Video 1 of 16  ·  Getting Started':fontfile='C\\:/Windows/Fonts/arial.ttf':fontsize=24:fontcolor=0xE2E8F0:x=60:y=58[v3];"
            # Branding bottom bar
            f"[v3]drawbox=x=0:y=1000:w=1920:h=80:color=0x111A2E@0.92:t=fill[v4];"
            f"[v4]drawtext=text='ScanMaster Systems Ltd  ·  scanmaster-irt.com':fontfile='C\\:/Windows/Fonts/arial.ttf':fontsize=18:fontcolor=0x94A3B8:x=60:y=1027[v5];"
            f"[v5]drawtext=text='PLACEHOLDER VOICEOVER  ·  Replace with ElevenLabs export':fontfile='C\\:/Windows/Fonts/arial.ttf':fontsize=16:fontcolor=0xF59E0B:x=60:y=1053[v6];"
            # Audio: voiceover + ducked music
            f"[1:a]volume=0.10[music];"
            f"[0:a][music]amix=inputs=2:duration=first:normalize=0[audio]"
        ),
        "-map", "[v6]", "-map", "[audio]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "22",
        "-c:a", "aac", "-b:a", "192k",
        "-t", f"{total:.3f}",
        str(final),
    ]
    subprocess.check_output(cmd, stderr=subprocess.STDOUT)

    print(f"\n[DONE] Final video: {final}")
    print(f"       Duration: {probe_duration(final):.1f}s")
    print(f"       Size:     {final.stat().st_size / 1_000_000:.1f} MB")


if __name__ == "__main__":
    main()
