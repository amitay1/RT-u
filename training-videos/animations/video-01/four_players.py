"""
Video #1 — Scene: FourPlayers
Used at: 0:40-1:25 in script 01-what-is-ultrasonic-testing.md

Four icons (Pulser, Transducer, Part, A-scan) appear dim in a row,
then light up one by one in sync with the voiceover.

Render:
    manim -qh four_players.py FourPlayers
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from manim import (
    Scene, Rectangle, RoundedRectangle, Text, VGroup, Line,
    UP, DOWN, LEFT, RIGHT, ORIGIN,
    FadeIn, FadeOut, Indicate, Wait,
    config,
)

import brand  # noqa: E402


config.background_color = brand.BG_DARK


def make_player_card(label: str, sublabel: str) -> VGroup:
    """A single 'player' tile — rounded card with a label."""
    card = RoundedRectangle(
        width=2.6,
        height=2.6,
        corner_radius=0.2,
        color=brand.NEUTRAL_MUTED,
        fill_color=brand.SURFACE_PANEL,
        fill_opacity=0.6,
        stroke_width=2,
    )

    title = Text(
        label,
        font=brand.FONT_DISPLAY,
        color=brand.NEUTRAL_MUTED,
        weight="BOLD",
    ).scale(brand.BODY_SIZE).move_to(card.get_center() + UP * 0.3)

    sub = Text(
        sublabel,
        font=brand.FONT_BODY,
        color=brand.NEUTRAL_MUTED,
    ).scale(brand.CAPTION_SIZE).move_to(card.get_center() + DOWN * 0.5)

    return VGroup(card, title, sub)


def highlight(card_group: VGroup, scene: Scene):
    """Light up one card with cyan accents."""
    card, title, sub = card_group
    scene.play(
        card.animate.set_color(brand.BRAND_CYAN).set_fill(brand.BRAND_CYAN, opacity=0.15),
        title.animate.set_color(brand.NEUTRAL_LIGHT),
        sub.animate.set_color(brand.BRAND_CYAN),
        run_time=brand.HIGHLIGHT_PULSE,
    )
    scene.play(Indicate(card, scale_factor=1.05, color=brand.BRAND_CYAN), run_time=0.4)


class FourPlayers(Scene):
    """
    Timing locked to VO:
      0:43-0:48  row fades in     ("Every UT inspection has 4 players")
      0:48       Pulser lights    ("One: the pulser")          → @ 5s
      0:55       Transducer       ("Two: the transducer")      → @ 12s
      1:02       Part             ("Three: the part")          → @ 19s
      1:10       Receiver         ("Four: the receiver")       → @ 27s
      1:18-1:25  connect + outro                               → 35-42s
    Total runtime: ~42 seconds
    """
    def construct(self):
        pulser     = make_player_card("Pulser",     "RPP3")
        transducer = make_player_card("Transducer", "Probe")
        part       = make_player_card("Part",       "Under test")
        receiver   = make_player_card("Receiver",   "UPR-100 + MCI/O")

        row = VGroup(pulser, transducer, part, receiver).arrange(RIGHT, buff=0.5)
        row.move_to(ORIGIN)

        # ─── Row appears (0:43 in VO) ───
        self.play(FadeIn(row, run_time=brand.FADE_IN_DURATION))
        self.wait(5.65)  # row visible while VO intros "exactly four players. Let's meet them."

        # ─── Pulser at 6s into animation = VO 0:49 "The Pulsar" ───
        highlight(pulser, self)
        self.wait(8.8)  # VO describes pulser fully ("RPP3 ... high voltage pulses")

        # ─── Transducer at 16s = VO 0:59 "The probe converts pulses to sound" ───
        highlight(transducer, self)
        self.wait(6.8)

        # ─── Part at 24s = VO 1:07 "Three. The part under test" ───
        highlight(part, self)
        self.wait(6.8)

        # ─── Receiver at 32s = VO 1:15 "And four. The receiver and display" ───
        highlight(receiver, self)
        self.wait(2.5)

        # ─── Final state — connect with cyan lines (matches "These four players together give the A-scan") ───
        connections = VGroup(
            Line(pulser.get_right(),     transducer.get_left(),  color=brand.BRAND_CYAN, stroke_width=2),
            Line(transducer.get_right(), part.get_left(),        color=brand.BRAND_CYAN, stroke_width=2),
            Line(part.get_right(),       receiver.get_left(),    color=brand.BRAND_CYAN, stroke_width=2),
        )
        self.play(FadeIn(connections), run_time=0.8)
        self.wait(2.0)

        # ─── Caption ───
        caption = Text(
            "Four players · One A-scan",
            font=brand.FONT_DISPLAY,
            color=brand.BRAND_CYAN,
            weight="BOLD",
        ).scale(brand.BODY_SIZE).to_edge(DOWN, buff=0.8)
        self.play(FadeIn(caption), run_time=brand.TEXT_IN_DURATION)
        self.wait(1.5)

        # ─── Clean exit ───
        self.play(FadeOut(VGroup(row, connections, caption)), run_time=brand.FADE_IN_DURATION)
