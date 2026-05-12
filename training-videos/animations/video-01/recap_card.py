"""
Video #1 — Scene: RecapCard
Closing recap with the 3 key takeaways and a "next video" call-to-action.

Render:
    manim -qh recap_card.py RecapCard
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from manim import (
    Scene, Text, VGroup, Line, Dot, RoundedRectangle,
    UP, DOWN, LEFT, RIGHT, ORIGIN,
    FadeIn, FadeOut, Indicate, Write,
    rate_functions, config,
)

import brand  # noqa: E402


config.background_color = brand.BG_DARK


RECAP_LINES = [
    ("UT", "Sonar for solids"),
    ("4 players", "Pulser · Transducer · Part · Receiver"),
    ("5 steps", "Always in order"),
]


def make_bullet(headline: str, detail: str) -> VGroup:
    dot = Dot(radius=0.16, color=brand.BRAND_CYAN)
    headline_t = Text(
        headline,
        font=brand.FONT_DISPLAY,
        color=brand.NEUTRAL_LIGHT,
        weight="BOLD",
    ).scale(0.7)
    detail_t = Text(
        detail,
        font=brand.FONT_BODY,
        color=brand.NEUTRAL_MUTED,
    ).scale(0.45)
    text_grp = VGroup(headline_t, detail_t).arrange(DOWN, aligned_edge=LEFT, buff=0.1)
    return VGroup(dot, text_grp).arrange(RIGHT, buff=0.5, aligned_edge=UP)


class RecapCard(Scene):
    def construct(self):
        # ─── Header ───
        header = Text(
            "Quick recap",
            font=brand.FONT_DISPLAY,
            color=brand.BRAND_CYAN,
            weight="BOLD",
        ).scale(0.8).to_edge(UP, buff=0.8)

        # ─── Three bullets ───
        bullets = VGroup(*[make_bullet(h, d) for h, d in RECAP_LINES])
        bullets.arrange(DOWN, aligned_edge=LEFT, buff=0.6).move_to(ORIGIN)

        # ─── Bottom CTA card ───
        cta_card = RoundedRectangle(
            width=10.0,
            height=1.3,
            corner_radius=0.15,
            color=brand.BRAND_CYAN,
            fill_color=brand.BRAND_CYAN,
            fill_opacity=0.08,
            stroke_width=1.5,
        ).to_edge(DOWN, buff=0.6)

        cta_label = Text(
            "NEXT  ·  VIDEO 2",
            font=brand.FONT_BODY,
            color=brand.BRAND_CYAN,
            weight="BOLD",
        ).scale(0.35).move_to(cta_card.get_center() + UP * 0.3)

        cta_title = Text(
            "Meet the ScanMaster System",
            font=brand.FONT_DISPLAY,
            color=brand.NEUTRAL_LIGHT,
            weight="BOLD",
        ).scale(0.55).move_to(cta_card.get_center() + DOWN * 0.18)

        # ─── Animate in ───
        self.play(FadeIn(header, shift=DOWN * 0.2), run_time=0.5)
        for b in bullets:
            self.play(FadeIn(b, shift=RIGHT * 0.2), run_time=0.35)
            self.wait(0.15)

        self.wait(0.6)

        # ─── Reveal the CTA ───
        self.play(FadeIn(cta_card, shift=UP * 0.2), run_time=0.5)
        self.play(FadeIn(cta_label), FadeIn(cta_title), run_time=0.5)
        self.wait(1.6)

        # ─── Exit ───
        self.play(
            FadeOut(VGroup(header, bullets, cta_card, cta_label, cta_title)),
            run_time=0.6,
        )
