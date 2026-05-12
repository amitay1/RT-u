"""
Video #1 — Scene: AmbientBackground
A subtle, always-on motion graphic that lives behind every other layer.
60-second seamless loop. Renders once, gets tiled to cover the whole video.

Visual: faint A-scan trace slowly scrolling left, plus a slow gradient pulse
at the corners. Cyan accent. Never grabs attention — just makes the screen
feel alive when no animation is "speaking".

Render:
    manim -qh ambient_background.py AmbientBackground
"""

import sys
from pathlib import Path

import numpy as np

sys.path.append(str(Path(__file__).resolve().parents[1]))

from manim import (
    Scene, Dot, FunctionGraph, VGroup, Line, Rectangle,
    UP, DOWN, LEFT, RIGHT, ORIGIN, UL, UR, DL, DR,
    FadeIn, FadeOut, MoveAlongPath,
    rate_functions, config, ValueTracker, always_redraw, Mobject,
)

import brand  # noqa: E402


config.background_color = brand.BG_DARK
LOOP_SECONDS = 60.0


class AmbientBackground(Scene):
    def construct(self):
        # ─── Slow scrolling A-scan trace at the very bottom (very faint) ───
        scroll = ValueTracker(0.0)

        def trace_func_factory(phase: float):
            def f(t):
                pulses = (
                    0.18 * np.exp(-((t - 2 + phase) ** 2) / 1.8) * np.sin(2 * np.pi * 0.8 * (t - 2 + phase))
                    + 0.12 * np.exp(-((t - 5 + phase) ** 2) / 2.5) * np.sin(2 * np.pi * 0.7 * (t - 5 + phase))
                    + 0.10 * np.exp(-((t - 9 + phase) ** 2) / 2.0) * np.sin(2 * np.pi * 0.9 * (t - 9 + phase))
                )
                return pulses
            return f

        def get_trace():
            graph = FunctionGraph(
                trace_func_factory(scroll.get_value()),
                x_range=[-7, 7, 0.04],
                color=brand.BRAND_CYAN,
                stroke_width=1.4,
                stroke_opacity=0.35,
            ).move_to(DOWN * 3.3)
            return graph

        ambient_trace = always_redraw(get_trace)
        self.add(ambient_trace)

        # ─── Corner glow rectangles (very subtle) ───
        corner_glow_tl = Rectangle(
            width=4, height=4,
            stroke_width=0,
            fill_color=brand.BRAND_INDIGO,
            fill_opacity=0.05,
        ).move_to(UL * 3)

        corner_glow_br = Rectangle(
            width=4, height=4,
            stroke_width=0,
            fill_color=brand.BRAND_CYAN,
            fill_opacity=0.04,
        ).move_to(DR * 3)

        self.add(corner_glow_tl, corner_glow_br)

        # ─── Subtle moving dots (particle field) ───
        rng = np.random.default_rng(42)
        n_dots = 14
        dots = []
        paths = []
        for _ in range(n_dots):
            start_x = rng.uniform(-7, 7)
            start_y = rng.uniform(-3.5, 3.5)
            end_x = start_x + rng.uniform(-1.5, 1.5)
            end_y = start_y + rng.uniform(-0.8, 0.8)
            d = Dot(
                point=[start_x, start_y, 0],
                radius=rng.uniform(0.015, 0.04),
                color=brand.BRAND_CYAN,
                fill_opacity=rng.uniform(0.15, 0.35),
            )
            dots.append(d)
            paths.append(([start_x, start_y, 0], [end_x, end_y, 0]))

        for d in dots:
            self.add(d)

        # ─── Animate everything for the full loop duration ───
        # The trace scrolls via the scroll ValueTracker
        # The dots drift slowly between their start and end positions
        self.play(
            scroll.animate.set_value(8.0),  # 8 units of horizontal drift
            *[
                d.animate.move_to(paths[i][1])
                for i, d in enumerate(dots)
            ],
            run_time=LOOP_SECONDS,
            rate_func=rate_functions.linear,
        )
