"""
Video #1 — Scene: WavePropagation
Used at: 0:35-0:40 in script 01-what-is-ultrasonic-testing.md

An ultrasonic wave pulse travels from a transducer into a metal block,
hits an internal defect, and reflects back as an echo.

Render:
    manim -qh wave_propagation.py WavePropagation
    manim -qk wave_propagation.py WavePropagation       # 4K
    manim -qh --transparent wave_propagation.py WavePropagation   # alpha for Descript
"""

import sys
from pathlib import Path

# Allow `from brand import ...` while running from this folder
sys.path.append(str(Path(__file__).resolve().parents[1]))

from manim import (
    Scene, Rectangle, Line, Dot, Text, VGroup,
    UP, DOWN, LEFT, RIGHT, ORIGIN,
    FadeIn, FadeOut, Create, Indicate, MoveAlongPath, Wait,
    rate_functions, config,
)

import brand  # noqa: E402


config.background_color = brand.BG_DARK


class WavePropagation(Scene):
    def construct(self):
        # ─── Setup the metal block (the part under test) ───
        block = Rectangle(
            width=8.0,
            height=3.0,
            color=brand.NEUTRAL_MUTED,
            fill_color=brand.SURFACE_PANEL,
            fill_opacity=0.8,
            stroke_width=2,
        ).shift(RIGHT * 1.0)

        block_label = Text(
            "Steel plate",
            font=brand.FONT_BODY,
            color=brand.NEUTRAL_MUTED,
        ).scale(brand.CAPTION_SIZE).next_to(block, DOWN, buff=0.3)

        # ─── Transducer (on the left edge of the block) ───
        transducer = Rectangle(
            width=0.5,
            height=0.8,
            color=brand.BRAND_CYAN,
            fill_color=brand.BRAND_CYAN,
            fill_opacity=0.9,
        ).next_to(block, LEFT, buff=0.0)

        transducer_label = Text(
            "Transducer",
            font=brand.FONT_BODY,
            color=brand.BRAND_CYAN,
        ).scale(brand.CAPTION_SIZE).next_to(transducer, UP, buff=0.3)

        # ─── The internal defect (a small red dot inside the block) ───
        defect = Dot(
            point=block.get_center() + RIGHT * 2.0,
            radius=0.12,
            color=brand.ERROR_RED,
        )
        defect_label = Text(
            "Defect",
            font=brand.FONT_BODY,
            color=brand.ERROR_RED,
        ).scale(brand.CAPTION_SIZE).next_to(defect, UP, buff=0.2)

        # ─── Establishing shot ───
        self.play(
            FadeIn(block, run_time=brand.FADE_IN_DURATION),
            FadeIn(block_label, run_time=brand.FADE_IN_DURATION),
        )
        self.play(
            FadeIn(transducer),
            FadeIn(transducer_label),
            run_time=brand.FADE_IN_DURATION,
        )
        self.wait(0.4)

        # ─── Pulse fires from transducer ───
        pulse_outgoing = Dot(
            point=transducer.get_right(),
            radius=0.18,
            color=brand.BRAND_CYAN,
        )
        self.play(Indicate(transducer, scale_factor=1.15, color=brand.BRAND_CYAN), run_time=0.25)
        self.play(FadeIn(pulse_outgoing), run_time=0.15)

        outgoing_path = Line(transducer.get_right(), defect.get_center())
        self.play(
            MoveAlongPath(pulse_outgoing, outgoing_path),
            run_time=1.4,
            rate_func=brand.EASE_LINEAR,
        )

        # ─── Pulse hits defect ───
        self.play(FadeOut(pulse_outgoing), run_time=0.05)
        self.play(
            FadeIn(defect),
            FadeIn(defect_label),
            Indicate(defect, scale_factor=1.8, color=brand.ERROR_RED),
            run_time=0.5,
        )

        # ─── Echo travels back ───
        pulse_echo = Dot(
            point=defect.get_center(),
            radius=0.18,
            color=brand.ERROR_RED,
        )
        self.play(FadeIn(pulse_echo), run_time=0.1)

        return_path = Line(defect.get_center(), transducer.get_right())
        self.play(
            MoveAlongPath(pulse_echo, return_path),
            run_time=1.4,
            rate_func=brand.EASE_LINEAR,
        )

        # ─── Transducer receives echo ───
        self.play(
            FadeOut(pulse_echo),
            Indicate(transducer, scale_factor=1.25, color=brand.ERROR_RED),
            run_time=0.4,
        )

        # ─── Caption: "Echo received" ───
        echo_caption = Text(
            "Echo received → defect detected",
            font=brand.FONT_DISPLAY,
            color=brand.NEUTRAL_LIGHT,
        ).scale(brand.BODY_SIZE).to_edge(DOWN, buff=0.8)

        self.play(FadeIn(echo_caption), run_time=brand.TEXT_IN_DURATION)
        self.wait(1.0)

        # ─── Fade everything out for clean cut ───
        self.play(
            FadeOut(VGroup(
                block, block_label, transducer, transducer_label,
                defect, defect_label, echo_caption,
            )),
            run_time=brand.FADE_IN_DURATION,
        )
