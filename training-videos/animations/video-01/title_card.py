"""
Video #1 — Scene: TitleCard
Cold-open title sequence with dramatic cyan A-scan trace ripple and brand title.

Render:
    manim -qh title_card.py TitleCard
"""

import sys
from pathlib import Path

import numpy as np

sys.path.append(str(Path(__file__).resolve().parents[1]))

from manim import (
    Scene, Text, VGroup, Line, FunctionGraph,
    UP, DOWN, LEFT, RIGHT, ORIGIN,
    FadeIn, FadeOut, Write, Create,
    rate_functions, config,
)

import brand  # noqa: E402


config.background_color = brand.BG_DARK


class TitleCard(Scene):
    def construct(self):
        # ─── Series tag (small, top of title group) ───
        series_tag = Text(
            "SERIES 1  ·  VIDEO 1",
            font=brand.FONT_BODY,
            color=brand.BRAND_CYAN,
            weight="BOLD",
        ).scale(0.45).move_to(UP * 1.6)

        # ─── Main title ───
        title_line_1 = Text(
            "What is Ultrasonic",
            font=brand.FONT_DISPLAY,
            color=brand.NEUTRAL_LIGHT,
            weight="BOLD",
        ).scale(1.6).move_to(UP * 0.6)

        title_line_2 = Text(
            "Testing?",
            font=brand.FONT_DISPLAY,
            color=brand.NEUTRAL_LIGHT,
            weight="BOLD",
        ).scale(1.6).move_to(DOWN * 0.6)

        # ─── Cyan rule (decorative) ───
        rule = Line(
            LEFT * 0.7, RIGHT * 0.7,
            color=brand.BRAND_CYAN,
            stroke_width=4,
        ).move_to(DOWN * 1.5)

        # ─── Subtitle ───
        subtitle = Text(
            "ScanMaster MCI/O Training",
            font=brand.FONT_BODY,
            color=brand.NEUTRAL_MUTED,
        ).scale(0.45).move_to(DOWN * 2.0)

        # ─── Ambient A-scan trace at the bottom (cinematic) ───
        def trace_func(t):
            return 0.15 * np.sin(2 * np.pi * 0.6 * t) * np.exp(-((t - 5) ** 2) / 60)

        trace = FunctionGraph(
            trace_func,
            x_range=[-7, 7, 0.05],
            color=brand.BRAND_CYAN,
            stroke_width=2.5,
        ).move_to(DOWN * 3.0)

        # ─── Animate entrance ───
        self.add(trace)
        self.play(Create(trace, run_time=1.5, rate_func=rate_functions.ease_out_quint))

        self.play(FadeIn(series_tag, shift=UP * 0.2), run_time=0.5)
        self.wait(0.2)
        self.play(Write(title_line_1), run_time=0.7)
        self.play(Write(title_line_2), run_time=0.7)
        self.play(Create(rule), run_time=0.4)
        self.play(FadeIn(subtitle, shift=UP * 0.1), run_time=0.4)

        # ─── Hold ───
        self.wait(2.0)

        # ─── Gentle exit ───
        all_objects = VGroup(series_tag, title_line_1, title_line_2, rule, subtitle, trace)
        self.play(FadeOut(all_objects, shift=UP * 0.3), run_time=0.6)
