"""
Video #1 — Scene: SonarConcept
Visualizes the "sonar analogy" — concentric pulses spreading from a transducer
into the medium, hitting a target, returning. Plays during 0:27-0:35 of VO
("Think of it like sonar for a submarine...")

Render:
    manim -qh sonar_concept.py SonarConcept
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from manim import (
    Scene, Circle, Dot, Text, VGroup, RoundedRectangle,
    UP, DOWN, LEFT, RIGHT, ORIGIN,
    FadeIn, FadeOut, Create, Indicate, GrowFromCenter, AnimationGroup,
    rate_functions, config,
)

import brand  # noqa: E402


config.background_color = brand.BG_DARK


class SonarConcept(Scene):
    def construct(self):
        # ─── Label ───
        label = Text(
            "Sonar in solid metal",
            font=brand.FONT_DISPLAY,
            color=brand.NEUTRAL_LIGHT,
            weight="BOLD",
        ).scale(0.6).to_edge(UP, buff=1.0)

        # ─── The "source" (transducer dot) ───
        source = Dot(point=LEFT * 4.5, radius=0.18, color=brand.BRAND_CYAN)
        source_label = Text(
            "Source",
            font=brand.FONT_BODY,
            color=brand.BRAND_CYAN,
        ).scale(0.35).next_to(source, DOWN, buff=0.25)

        # ─── The "target" (defect) ───
        target = Dot(point=RIGHT * 4.0, radius=0.18, color=brand.ERROR_RED)
        target_label = Text(
            "Target",
            font=brand.FONT_BODY,
            color=brand.ERROR_RED,
        ).scale(0.35).next_to(target, DOWN, buff=0.25)

        self.play(
            FadeIn(label),
            FadeIn(source), FadeIn(source_label),
            FadeIn(target), FadeIn(target_label),
            run_time=0.5,
        )

        # ─── Multiple expanding rings from source (the "ping") ───
        def make_ring(center, color, max_r):
            ring = Circle(radius=0.08, color=color, stroke_width=3, stroke_opacity=1.0)
            ring.move_to(center)
            return ring, max_r

        # First ping - 3 overlapping cyan rings from source
        rings_out = []
        anims_out = []
        for _ in range(3):
            ring, max_r = make_ring(source.get_center(), brand.BRAND_CYAN, 5.0)
            rings_out.append(ring)
            anims_out.append(
                ring.animate.scale(max_r / 0.08).set_stroke(opacity=0)
            )
        self.add(*rings_out)
        self.play(
            AnimationGroup(*anims_out, lag_ratio=0.35),
            run_time=2.2,
            rate_func=rate_functions.ease_out_quad,
        )
        self.remove(*rings_out)

        self.wait(0.3)

        # ─── Target reacts ───
        self.play(Indicate(target, scale_factor=1.8, color=brand.ERROR_RED), run_time=0.6)

        # ─── Echo rings come back from target (3 overlapping red rings) ───
        rings_in = []
        anims_in = []
        for _ in range(3):
            ring, max_r = make_ring(target.get_center(), brand.ERROR_RED, 5.0)
            rings_in.append(ring)
            anims_in.append(
                ring.animate.scale(max_r / 0.08).set_stroke(opacity=0)
            )
        self.add(*rings_in)
        self.play(
            AnimationGroup(*anims_in, lag_ratio=0.35),
            run_time=2.2,
            rate_func=rate_functions.ease_out_quad,
        )
        self.remove(*rings_in)

        # ─── Source reacts to received echo ───
        self.play(Indicate(source, scale_factor=1.8, color=brand.ERROR_RED), run_time=0.5)

        # ─── Caption ───
        caption = Text(
            "Sound goes in.   Echoes come back.",
            font=brand.FONT_DISPLAY,
            color=brand.BRAND_CYAN,
            weight="BOLD",
        ).scale(0.55).to_edge(DOWN, buff=1.0)
        self.play(FadeIn(caption, shift=UP * 0.1), run_time=0.6)
        self.wait(1.2)

        # ─── Exit ───
        self.play(
            FadeOut(VGroup(label, source, source_label, target, target_label, caption)),
            run_time=0.5,
        )
