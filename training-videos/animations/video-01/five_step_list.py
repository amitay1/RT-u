"""
Video #1 — Scene: FiveStepList
Used at: 1:45-2:25 in script 01-what-is-ultrasonic-testing.md

The 5-step UT workflow list builds itself dramatically as the narrator
introduces each step.

Render:
    manim -qh five_step_list.py FiveStepList
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from manim import (
    Scene, Text, VGroup, Dot, RoundedRectangle,
    UP, DOWN, LEFT, RIGHT, ORIGIN,
    FadeIn, FadeOut, Indicate, Write,
    config,
)

import brand  # noqa: E402


config.background_color = brand.BG_DARK


STEPS = [
    ("1", "Timebase & Material",   "Tell the system what you're scanning"),
    ("2", "Pulser & Receiver",     "Pick frequency, voltage, filter"),
    ("3", "Gain & TCG",            "Tune amplitude — add TCG if thick"),
    ("4", "Gates",                 "Capture signals of interest"),
    ("5", "Scan & Review",         "Save · Run · Verify"),
]


def make_step_row(num: str, title_text: str, subtitle_text: str) -> VGroup:
    """One row in the five-step list."""
    number_circle = RoundedRectangle(
        width=0.7,
        height=0.7,
        corner_radius=0.35,
        color=brand.BRAND_CYAN,
        fill_color=brand.BRAND_CYAN,
        fill_opacity=0.15,
        stroke_width=2,
    )
    number = Text(
        num,
        font=brand.FONT_DISPLAY,
        color=brand.BRAND_CYAN,
        weight="BOLD",
    ).scale(brand.BODY_SIZE).move_to(number_circle.get_center())

    title = Text(
        title_text,
        font=brand.FONT_DISPLAY,
        color=brand.NEUTRAL_LIGHT,
        weight="BOLD",
    ).scale(brand.BODY_SIZE)

    subtitle = Text(
        subtitle_text,
        font=brand.FONT_BODY,
        color=brand.NEUTRAL_MUTED,
    ).scale(brand.CAPTION_SIZE)

    text_group = VGroup(title, subtitle).arrange(DOWN, aligned_edge=LEFT, buff=0.08)

    row = VGroup(VGroup(number_circle, number), text_group)
    row.arrange(RIGHT, buff=0.5, aligned_edge=DOWN)
    return row


class FiveStepList(Scene):
    """
    Timing locked to VO:
      1:52  title appears   ("follows the same five steps")    → @ 0s
      2:01  Step 1          ("Step one: timebase & material")  → @ 9s
      2:08  Step 2          ("Step two: pulser & receiver")    → @ 16s
      2:16  Step 3          ("Step three: tune the gain")      → @ 24s
      2:24  Step 4          ("Step four: place gates")         → @ 32s
      2:32  Step 5          ("Step five: save & run")          → @ 40s
      2:42  full pulse + closer caption                        → 50-55s
    Total runtime: ~55 seconds
    """
    def construct(self):
        # ─── Section title (animation start = VO 1:52) ───
        section_title = Text(
            "The 5-Step Workflow",
            font=brand.FONT_DISPLAY,
            color=brand.BRAND_CYAN,
            weight="BOLD",
        ).scale(brand.HEADING_SIZE).to_edge(UP, buff=0.8)

        self.play(Write(section_title), run_time=brand.TEXT_IN_DURATION)

        # ─── Pre-build all five rows but keep invisible ───
        rows = VGroup(*[make_step_row(*s) for s in STEPS])
        rows.arrange(DOWN, aligned_edge=LEFT, buff=0.5).next_to(section_title, DOWN, buff=0.8)
        for r in rows:
            r.set_opacity(0)
            r.shift(LEFT * 0.5)
        self.add(rows)

        # ─── Hold title before Step 1 lands (VO is intro-ing the list) ───
        self.wait(7.5)

        # Pace: each step lands at its VO timestamp. Reveal animation = 0.6s, then wait.
        reveal_time = 0.6
        waits_between = [6.4, 7.4, 7.4, 7.4]   # 7s + 8s + 8s + 8s ≈ steps 1→5
        for i, row in enumerate(rows):
            self.play(
                row.animate.shift(RIGHT * 0.5).set_opacity(1),
                run_time=reveal_time,
                rate_func=brand.EASE_OUT_QUINT,
            )
            if i < len(rows) - 1:
                self.wait(waits_between[i])

        self.wait(6.0)  # all-five shown for "save the setup, run the scan, review"

        # ─── All five highlighted together (matches "five steps, in order") ───
        self.play(
            *[Indicate(row, scale_factor=1.04, color=brand.BRAND_CYAN) for row in rows],
            run_time=brand.HIGHLIGHT_PULSE,
        )

        # ─── Closing caption ───
        closer = Text(
            "Always in this order.",
            font=brand.FONT_DISPLAY,
            color=brand.WARNING_AMBER,
            weight="BOLD",
        ).scale(brand.BODY_SIZE).to_edge(DOWN, buff=0.8)
        self.play(FadeIn(closer), run_time=brand.TEXT_IN_DURATION)
        self.wait(2.0)

        # ─── Clean exit ───
        self.play(
            FadeOut(VGroup(section_title, rows, closer)),
            run_time=brand.FADE_IN_DURATION,
        )
