"""
Video #1 — Scene: IndustriesGrid
3×2 grid of industry tiles that light up sequentially, then a cyan border
pulses around them all. Plays during 1:30-1:45 ("Every aerospace primary
structure, every nuclear pressure vessel, every offshore weld...").

Render:
    manim -qh industries_grid.py IndustriesGrid
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from manim import (
    Scene, RoundedRectangle, Text, VGroup,
    UP, DOWN, LEFT, RIGHT, ORIGIN,
    FadeIn, FadeOut, Indicate, AnimationGroup,
    rate_functions, config,
)

import brand  # noqa: E402


config.background_color = brand.BG_DARK


INDUSTRIES = [
    ("Aerospace",        "Boeing · Airbus · GE"),
    ("Oil & Gas",        "Pipelines · Refineries"),
    ("Nuclear",          "Pressure vessels"),
    ("Power Generation", "Turbines · Boilers"),
    ("Maritime",         "Welds · Hulls"),
    ("Defense",          "Armor · Munitions"),
]


def make_tile(title: str, subtitle: str) -> VGroup:
    card = RoundedRectangle(
        width=3.8,
        height=1.6,
        corner_radius=0.12,
        color=brand.NEUTRAL_MUTED,
        fill_color=brand.SURFACE_PANEL,
        fill_opacity=0.55,
        stroke_width=1.5,
    )
    title_t = Text(
        title,
        font=brand.FONT_DISPLAY,
        color=brand.NEUTRAL_MUTED,
        weight="BOLD",
    ).scale(0.55).move_to(card.get_center() + UP * 0.25)
    sub_t = Text(
        subtitle,
        font=brand.FONT_BODY,
        color=brand.NEUTRAL_MUTED,
    ).scale(0.32).move_to(card.get_center() + DOWN * 0.35)
    return VGroup(card, title_t, sub_t)


def light_tile(tile: VGroup, scene: Scene):
    card, title_t, sub_t = tile
    scene.play(
        card.animate.set_color(brand.BRAND_CYAN).set_fill(brand.BRAND_CYAN, opacity=0.18),
        title_t.animate.set_color(brand.NEUTRAL_LIGHT),
        sub_t.animate.set_color(brand.BRAND_CYAN),
        run_time=0.4,
    )


class IndustriesGrid(Scene):
    def construct(self):
        # ─── Header ───
        header = Text(
            "Where UT is used",
            font=brand.FONT_DISPLAY,
            color=brand.BRAND_CYAN,
            weight="BOLD",
        ).scale(0.7).to_edge(UP, buff=0.6)

        # ─── 3 × 2 grid ───
        tiles = [make_tile(t, s) for t, s in INDUSTRIES]
        grid = VGroup(*tiles).arrange_in_grid(
            rows=2, cols=3,
            buff=0.4,
        ).move_to(DOWN * 0.2)

        self.play(FadeIn(header), run_time=0.5)
        self.play(FadeIn(grid, shift=UP * 0.2), run_time=0.6)

        # ─── Light them up one by one ───
        for tile in tiles:
            light_tile(tile, self)
            self.wait(0.18)

        self.wait(0.8)

        # ─── Final pulse (everything in unison) ───
        self.play(
            *[Indicate(tile[0], scale_factor=1.03, color=brand.BRAND_CYAN) for tile in tiles],
            run_time=0.7,
        )
        self.wait(0.6)

        # ─── Caption ───
        caption = Text(
            "Non-destructive.  Every flight.  Every weld.",
            font=brand.FONT_DISPLAY,
            color=brand.WARNING_AMBER,
            weight="BOLD",
        ).scale(0.45).to_edge(DOWN, buff=0.6)
        self.play(FadeIn(caption), run_time=0.5)
        self.wait(1.0)

        # ─── Exit ───
        self.play(FadeOut(VGroup(header, grid, caption)), run_time=0.5)
