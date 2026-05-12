"""
Video #1 — Scene: AScanBasics
Recurring asset — animated A-scan trace with front-wall, defect, backwall labels.

Render:
    manim -qh a_scan_basics.py AScanBasics
"""

import sys
from pathlib import Path

import numpy as np

sys.path.append(str(Path(__file__).resolve().parents[1]))

from manim import (
    Scene, Axes, Text, VGroup, DashedLine,
    UP, DOWN, LEFT, RIGHT, ORIGIN,
    FadeIn, FadeOut, Create, Write,
    config,
)

import brand  # noqa: E402


config.background_color = brand.BG_DARK


def a_scan_signal(t):
    """
    Synthesize a clean, readable A-scan: front-wall echo, defect echo, backwall echo.
    Higher carrier frequency hidden inside a wider gaussian envelope so each echo
    reads as a clear bump rather than a noisy oscillation at viewer distance.
    """
    def echo(center, amplitude, width=0.35):
        envelope = amplitude * np.exp(-((t - center) ** 2) / (2 * width**2))
        carrier = np.sin(2 * np.pi * 1.8 * (t - center))
        return envelope * carrier

    return (
        echo(center=1.5, amplitude=0.92, width=0.32)   # Front wall (near-saturation)
        + echo(center=5.0, amplitude=0.55, width=0.30) # Defect
        + echo(center=8.5, amplitude=0.78, width=0.32) # Backwall
    )


class AScanBasics(Scene):
    def construct(self):
        # ─── Axes (anchored toward the bottom half — leaves room for labels above) ───
        axes = Axes(
            x_range=[0, 10, 1],
            y_range=[-1, 1, 0.5],
            x_length=12,
            y_length=4.5,
            tips=False,
            axis_config={
                "color": brand.NEUTRAL_MUTED,
                "stroke_width": 1.5,
                "include_numbers": False,
            },
        ).shift(DOWN * 0.5)

        x_label = Text("Timebase →", font=brand.FONT_BODY, color=brand.NEUTRAL_MUTED)\
            .scale(brand.CAPTION_SIZE)\
            .next_to(axes.x_axis.get_right(), RIGHT, buff=0.2)

        y_label = Text("FSH (%)", font=brand.FONT_BODY, color=brand.NEUTRAL_MUTED)\
            .scale(brand.CAPTION_SIZE)\
            .next_to(axes.y_axis.get_top(), UP, buff=0.2)

        self.play(
            Create(axes, run_time=0.8),
            FadeIn(x_label),
            FadeIn(y_label),
        )

        # ─── The waveform draws itself left to right (thick cyan trace) ───
        signal = axes.plot(
            a_scan_signal,
            x_range=[0, 10, 0.01],
            color=brand.BRAND_CYAN,
            stroke_width=5,
        )
        self.play(Create(signal, run_time=2.2))
        self.wait(0.3)

        # ─── Annotations — labels placed ABOVE the top of the y-axis ───
        def vertical_marker(x_pos: float, color: str):
            return DashedLine(
                axes.c2p(x_pos, -1.05),
                axes.c2p(x_pos, 1.05),
                color=color,
                stroke_width=2,
                dash_length=0.12,
            )

        def floating_label(text: str, x_pos: float, color: str) -> Text:
            label = Text(text, font=brand.FONT_DISPLAY, color=color, weight="BOLD")\
                .scale(brand.CAPTION_SIZE)
            label.move_to(axes.c2p(x_pos, 1.0)).shift(UP * 0.4)
            return label

        v_front    = vertical_marker(1.5, brand.BRAND_CYAN)
        v_defect   = vertical_marker(5.0, brand.ERROR_RED)
        v_backwall = vertical_marker(8.5, brand.BRAND_INDIGO)

        front_label    = floating_label("Front wall", 1.5, brand.BRAND_CYAN)
        defect_label   = floating_label("Defect",     5.0, brand.ERROR_RED)
        backwall_label = floating_label("Backwall",   8.5, brand.BRAND_INDIGO)

        self.play(Create(v_front),    FadeIn(front_label),    run_time=0.55)
        self.wait(0.35)
        self.play(Create(v_defect),   FadeIn(defect_label),   run_time=0.55)
        self.wait(0.35)
        self.play(Create(v_backwall), FadeIn(backwall_label), run_time=0.55)
        self.wait(1.2)

        # ─── Closing label ───
        closer = Text(
            "This is an A-scan.",
            font=brand.FONT_DISPLAY,
            color=brand.NEUTRAL_LIGHT,
            weight="BOLD",
        ).scale(brand.HEADING_SIZE).to_edge(DOWN, buff=0.4)
        self.play(Write(closer), run_time=brand.TEXT_IN_DURATION)
        self.wait(1.5)

        # ─── Clean exit ───
        self.play(
            FadeOut(VGroup(
                axes, x_label, y_label, signal,
                v_front, v_defect, v_backwall,
                front_label, defect_label, backwall_label,
                closer,
            )),
            run_time=brand.FADE_IN_DURATION,
        )
