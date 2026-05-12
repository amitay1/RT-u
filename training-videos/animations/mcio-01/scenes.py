"""
All 9 scenes for MCI/O Video #1.

Render all:
    python -m manim -qh scenes.py Scene01 Scene02 Scene03 Scene04 Scene05 Scene06 Scene07 Scene08 Scene09

Each scene is named SceneNN and lives in its own class.
Brand colors / fonts come from training-videos/animations/brand.py
"""

import sys
from pathlib import Path

import numpy as np

# Allow `from brand import ...` while running from this folder
sys.path.append(str(Path(__file__).resolve().parents[1]))

from manim import (
    Scene, Text, VGroup, Group, Rectangle, RoundedRectangle, Line, Dot, ImageMobject,
    UP, DOWN, LEFT, RIGHT, ORIGIN, UL, UR, DL, DR,
    FadeIn, FadeOut, Create, Write, Indicate, AnimationGroup,
    rate_functions, config,
)

import brand  # noqa: E402

config.background_color = brand.BG_DARK
config.frame_rate = 60

PDF_FIGURES = Path(__file__).resolve().parents[2] / "assets" / "pdf-figures"


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────
def brand_title(text: str, scale: float = 1.0) -> Text:
    return Text(text, font=brand.FONT_DISPLAY, color=brand.NEUTRAL_LIGHT, weight="BOLD").scale(scale)


def brand_caption(text: str, scale: float = 0.5) -> Text:
    return Text(text, font=brand.FONT_BODY, color=brand.NEUTRAL_MUTED).scale(scale)


def cyan_accent(text: str, scale: float = 0.6) -> Text:
    return Text(text, font=brand.FONT_DISPLAY, color=brand.BRAND_CYAN, weight="BOLD").scale(scale)


def highlight_box(width: float, height: float) -> Rectangle:
    return Rectangle(
        width=width, height=height,
        color=brand.BRAND_CYAN,
        stroke_width=5,
        fill_opacity=0.0,
    )


def pdf_image(filename: str, height: float = 6.0) -> ImageMobject:
    path = PDF_FIGURES / filename
    return ImageMobject(str(path)).scale_to_fit_height(height)


# ─────────────────────────────────────────────────────────────────────
# Scene 01 — Cold Open (8s)
# ─────────────────────────────────────────────────────────────────────
class Scene01(Scene):
    def construct(self):
        # 0-4s: PDF figure of Logon window on splash
        try:
            splash = pdf_image("page_013_img_1.png", height=6.0)
        except Exception:
            splash = brand_title("MCI/O Splash + Logon", 0.8)
        self.add(splash)
        self.wait(0.3)
        self.play(FadeIn(splash, run_time=0.5))
        self.wait(3.2)

        # 4-7s: Cut to the "two windows appear" text overlay
        self.play(FadeOut(splash, run_time=0.3))
        line1 = brand_title("Two windows.", 1.2)
        line2 = brand_caption("No tutorial.", 0.7).next_to(line1, DOWN, buff=0.5)
        line2.set_color(brand.BRAND_CYAN)
        grp = VGroup(line1, line2).move_to(ORIGIN)
        self.play(FadeIn(grp, run_time=0.4))
        self.wait(2.3)

        # 7-8s: Fade to title card prep
        self.play(FadeOut(grp, run_time=0.5))


# ─────────────────────────────────────────────────────────────────────
# Scene 02 — Title + Goal (17s)
# ─────────────────────────────────────────────────────────────────────
class Scene02(Scene):
    def construct(self):
        # 0-5s: Title card
        series = cyan_accent("MCI/O TRAINING  |  VIDEO 1", 0.42).move_to(UP * 2.0)
        title1 = brand_title("Getting Started", 1.6).move_to(UP * 0.5)
        title2 = brand_title("Your First Session", 0.9).move_to(DOWN * 0.5)
        title2.set_color(brand.NEUTRAL_MUTED)
        rule = Line(LEFT * 0.6, RIGHT * 0.6, color=brand.BRAND_CYAN, stroke_width=4).move_to(DOWN * 1.3)
        sub = brand_caption("ScanMaster MCI/O Instrument", 0.4).next_to(rule, DOWN, buff=0.25)

        self.play(FadeIn(series, shift=UP * 0.2), run_time=0.4)
        self.play(Write(title1), run_time=0.7)
        self.play(Write(title2), run_time=0.5)
        self.play(Create(rule), run_time=0.3)
        self.play(FadeIn(sub), run_time=0.3)
        self.wait(2.5)

        # 5-17s: 4 bullets
        self.play(
            FadeOut(VGroup(title1, title2, rule, sub), shift=UP * 0.4),
            run_time=0.5,
        )
        # series stays at top
        bullets_text = [
            ("01", "Log in",                  "Two-step launch"),
            ("02", "Read the INSTRUMENT window", "8 named elements"),
            ("03", "Tour the Setup Toolbox",  "5 toolbar buttons + 12 tabs"),
            ("04", "Exit safely",              "3-step sequence + save Global Setup"),
        ]
        rows = []
        for num, title, sub_t in bullets_text:
            num_t = cyan_accent(num, 0.55)
            tit_t = brand_title(title, 0.6)
            sub_t = brand_caption(sub_t, 0.36).set_color(brand.NEUTRAL_MUTED)
            text_grp = VGroup(tit_t, sub_t).arrange(DOWN, aligned_edge=LEFT, buff=0.08)
            row = VGroup(num_t, text_grp).arrange(RIGHT, buff=0.5, aligned_edge=UP)
            rows.append(row)
        rows_grp = VGroup(*rows).arrange(DOWN, aligned_edge=LEFT, buff=0.55).move_to(DOWN * 0.5)

        for r in rows:
            self.play(FadeIn(r, shift=RIGHT * 0.3), run_time=0.5)
            self.wait(1.8)

        self.wait(2.0)
        self.play(FadeOut(VGroup(series, rows_grp)), run_time=0.4)


# ─────────────────────────────────────────────────────────────────────
# Scene 03 — What MCI/O Is (30s)
# ─────────────────────────────────────────────────────────────────────
class Scene03(Scene):
    def construct(self):
        header = cyan_accent("WHAT MCI/O IS", 0.6).to_edge(UP, buff=0.8)
        self.play(FadeIn(header), run_time=0.3)

        # Three tiles
        def make_tile(label, sub):
            box = RoundedRectangle(
                width=3.6, height=2.0, corner_radius=0.15,
                color=brand.NEUTRAL_MUTED, fill_color=brand.SURFACE_PANEL,
                fill_opacity=0.6, stroke_width=2,
            )
            t = brand_title(label, 0.55).move_to(box.get_center() + UP * 0.3)
            s = brand_caption(sub, 0.35).move_to(box.get_center() + DOWN * 0.35)
            return VGroup(box, t, s)

        tiles = [
            make_tile("Sets all UT", "parameters"),
            make_tile("Calibrate", "the system"),
            make_tile("Configure", "scan setups"),
        ]
        row = VGroup(*tiles).arrange(RIGHT, buff=0.4).move_to(UP * 0.3)
        self.play(FadeIn(row, shift=UP * 0.2), run_time=0.5)

        # Light up tiles in sequence
        for tile in tiles:
            box, t, s = tile
            self.play(
                box.animate.set_color(brand.BRAND_CYAN).set_fill(brand.BRAND_CYAN, opacity=0.15),
                t.animate.set_color(brand.NEUTRAL_LIGHT),
                s.animate.set_color(brand.BRAND_CYAN),
                run_time=0.4,
            )
            self.wait(2.5)

        self.wait(1.5)

        # OS callout
        os_callout = RoundedRectangle(
            width=6, height=1.1, corner_radius=0.1,
            color=brand.WARNING_AMBER, fill_color=brand.WARNING_AMBER,
            fill_opacity=0.08, stroke_width=2,
        ).move_to(DOWN * 2.4)
        os_text = brand_title("Runs on Windows 2000 or higher", 0.5).move_to(os_callout.get_center())
        self.play(FadeIn(os_callout), FadeIn(os_text), run_time=0.4)
        self.wait(3.0)

        # Two product cards
        self.play(FadeOut(VGroup(os_callout, os_text)), run_time=0.4)

        def product_card(name, sub, color):
            box = RoundedRectangle(
                width=4.5, height=1.6, corner_radius=0.15,
                color=color, fill_color=color, fill_opacity=0.15, stroke_width=2,
            )
            n = brand_title(name, 0.7).move_to(box.get_center() + UP * 0.25)
            s = brand_caption(sub, 0.35).move_to(box.get_center() + DOWN * 0.35).set_color(color)
            return VGroup(box, n, s)

        card_upr = product_card("UPR-100", "UT board", brand.BRAND_CYAN)
        card_rpp = product_card("RPP3", "Pulser", brand.BRAND_INDIGO)
        cards = VGroup(card_upr, card_rpp).arrange(RIGHT, buff=0.6).move_to(DOWN * 2.0)

        self.play(FadeIn(cards, shift=UP * 0.2), run_time=0.5)
        self.wait(4.0)

        # Sensoray 826 callout
        sensoray = brand_caption("+ one or more  Sensoray 826  cards", 0.45).move_to(DOWN * 3.4)
        sensoray.set_color(brand.NEUTRAL_LIGHT)
        self.play(FadeIn(sensoray), run_time=0.4)
        self.wait(3.5)

        self.play(FadeOut(VGroup(header, row, cards, sensoray)), run_time=0.4)


# ─────────────────────────────────────────────────────────────────────
# Scene 04 — Launching (27s)
# ─────────────────────────────────────────────────────────────────────
class Scene04(Scene):
    def construct(self):
        header = cyan_accent("LAUNCHING MCI/O", 0.55).to_edge(UP, buff=0.6)
        self.play(FadeIn(header), run_time=0.3)

        # 3 numbered steps
        steps_text = [
            "1. Double-click the MCI/O desktop icon",
            "2. Logon window appears on the splash screen",
            "3. Enter user name + password, click OK",
        ]
        steps = [brand_title(t, 0.55) for t in steps_text]
        steps_grp = VGroup(*steps).arrange(DOWN, aligned_edge=LEFT, buff=0.5).move_to(UP * 0.5)

        for s in steps:
            self.play(FadeIn(s, shift=RIGHT * 0.3), run_time=0.4)
            self.wait(0.5)

        # PDF figure of splash + Logon
        try:
            splash = pdf_image("page_013_img_1.png", height=4.0).move_to(DOWN * 0.5)
        except Exception:
            splash = Rectangle(width=8, height=4, color=brand.SURFACE_PANEL, fill_color=brand.SURFACE_PANEL, fill_opacity=0.7).move_to(DOWN * 0.5)
        self.play(FadeOut(steps_grp), FadeIn(splash, shift=UP * 0.2), run_time=0.6)

        # Highlight Logon window area
        ring = highlight_box(2.5, 1.5).move_to(splash.get_center())
        self.play(Create(ring), run_time=0.4)
        self.wait(8.0)
        self.play(FadeOut(ring), run_time=0.3)

        # Cursor click animation suggestion (just a cyan dot)
        click_dot = Dot(point=splash.get_center() + DOWN * 0.5, radius=0.15, color=brand.BRAND_CYAN)
        self.play(FadeIn(click_dot), Indicate(click_dot, scale_factor=2.0, color=brand.BRAND_CYAN), run_time=0.6)
        self.wait(1.0)
        self.play(FadeOut(click_dot), run_time=0.3)

        # Show "Both windows appear" text
        msg = cyan_accent("INSTRUMENT  +  Setup Toolbox", 0.7).move_to(DOWN * 3.2)
        self.play(FadeIn(msg), run_time=0.4)
        self.wait(10.5)
        self.play(FadeOut(Group(header, splash, msg)), run_time=0.4)


# ─────────────────────────────────────────────────────────────────────
# Scene 05 — INSTRUMENT Window 8 Elements (43s)
# ─────────────────────────────────────────────────────────────────────
class Scene05(Scene):
    def construct(self):
        header = cyan_accent("THE INSTRUMENT WINDOW", 0.55).to_edge(UP, buff=0.4)
        sub = brand_caption("8 named elements", 0.4).next_to(header, DOWN, buff=0.1)
        self.play(FadeIn(header), FadeIn(sub), run_time=0.3)

        # PDF figure of labeled INSTRUMENT window (page 015)
        try:
            instr = pdf_image("page_015.png", height=5.5).move_to(DOWN * 0.2)
        except Exception:
            instr = Rectangle(width=10, height=5.5, color=brand.SURFACE_PANEL, fill_color=brand.SURFACE_PANEL, fill_opacity=0.7).move_to(DOWN * 0.2)
        self.play(FadeIn(instr), run_time=0.5)
        self.wait(2.0)

        # 8 element callouts - shown sequentially in lower-third
        elements = [
            "1.  Toolbar",
            "2.  Status Display area",
            "3.  Full Screen Height (FSH) display",
            "4.  A-Scan Display area",
            "5.  Gain slider",
            "6.  Timebase axis",
            "7.  Status bar",
            "8.  Messages area",
        ]
        lt = None
        for elem in elements:
            new_lt = RoundedRectangle(
                width=8, height=0.9, corner_radius=0.12,
                color=brand.BRAND_CYAN, fill_color=brand.SURFACE_PANEL,
                fill_opacity=0.92, stroke_width=2,
            ).to_edge(DOWN, buff=0.4)
            new_text = brand_title(elem, 0.55).move_to(new_lt.get_center())
            new_grp = VGroup(new_lt, new_text)
            if lt is None:
                self.play(FadeIn(new_grp, shift=UP * 0.2), run_time=0.4)
            else:
                self.play(FadeOut(lt, shift=DOWN * 0.2), FadeIn(new_grp, shift=UP * 0.2), run_time=0.4)
            lt = new_grp
            self.wait(4.5)

        self.wait(1.5)
        self.play(FadeOut(Group(header, sub, instr, lt)), run_time=0.4)


# ─────────────────────────────────────────────────────────────────────
# Scene 06 — Setup Toolbox + 12 Tabs (40s)
# ─────────────────────────────────────────────────────────────────────
class Scene06(Scene):
    def construct(self):
        header = cyan_accent("THE SETUP TOOLBOX", 0.55).to_edge(UP, buff=0.4)
        sub = brand_caption("Toolbar (5 buttons)  +  Tabs (12)", 0.4).next_to(header, DOWN, buff=0.1)
        self.play(FadeIn(header), FadeIn(sub), run_time=0.3)

        # 5 toolbar buttons
        toolbar_labels = ["Manual", "Channel", "Hide Tabs", "Show Tabs", "Exit"]
        toolbar_tiles = []
        for label in toolbar_labels:
            box = RoundedRectangle(
                width=2.2, height=1.0, corner_radius=0.1,
                color=brand.NEUTRAL_MUTED, fill_color=brand.SURFACE_PANEL,
                fill_opacity=0.6, stroke_width=2,
            )
            t = brand_caption(label, 0.45).move_to(box.get_center()).set_color(brand.NEUTRAL_LIGHT)
            toolbar_tiles.append(VGroup(box, t))
        toolbar_row = VGroup(*toolbar_tiles).arrange(RIGHT, buff=0.25).move_to(UP * 1.5)
        self.play(FadeIn(toolbar_row, shift=UP * 0.2), run_time=0.4)

        # Light each toolbar button
        for tile in toolbar_tiles:
            box, t = tile
            self.play(
                box.animate.set_color(brand.BRAND_CYAN).set_fill(brand.BRAND_CYAN, opacity=0.18),
                t.animate.set_color(brand.NEUTRAL_LIGHT),
                run_time=0.35,
            )
            self.wait(1.6)

        self.wait(1.0)

        # 12 tabs grid (4 cols × 3 rows)
        tab_names = [
            "Timebase", "Zoom/Trig", "Pulser", "Gain",
            "Receiver", "Display", "Gates", "TCG",
            "Files", "Global", "IO", "Analog Input",
        ]
        tab_tiles = []
        for name in tab_names:
            box = RoundedRectangle(
                width=2.4, height=0.9, corner_radius=0.08,
                color=brand.NEUTRAL_MUTED, fill_color=brand.SURFACE_PANEL,
                fill_opacity=0.55, stroke_width=1.5,
            )
            t = brand_caption(name, 0.42).move_to(box.get_center()).set_color(brand.NEUTRAL_LIGHT)
            tab_tiles.append(VGroup(box, t))
        tab_grid = VGroup(*tab_tiles).arrange_in_grid(rows=3, cols=4, buff=0.2).move_to(DOWN * 1.5)
        self.play(FadeIn(tab_grid, shift=UP * 0.2), run_time=0.5)

        # Light up each tab fast
        for tile in tab_tiles:
            box, t = tile
            self.play(
                box.animate.set_color(brand.BRAND_CYAN).set_fill(brand.BRAND_CYAN, opacity=0.18),
                t.animate.set_color(brand.BRAND_CYAN),
                run_time=0.18,
            )
            self.wait(0.42)

        self.wait(2.0)
        self.play(FadeOut(VGroup(header, sub, toolbar_row, tab_grid)), run_time=0.4)


# ─────────────────────────────────────────────────────────────────────
# Scene 07 — Exit Sequence (25s)
# ─────────────────────────────────────────────────────────────────────
class Scene07(Scene):
    def construct(self):
        header = cyan_accent("EXIT  ·  3 STEPS", 0.6).to_edge(UP, buff=0.6)
        self.play(FadeIn(header), run_time=0.3)

        steps_data = [
            ("STEP 1", "Click the close button on the Setup Toolbox", "Exit warning appears in the Messages area"),
            ("STEP 2", "Click OK to quit", "Overwrite warning window appears"),
            ("STEP 3", "Click Yes to save as default Global Setup", "Click No to keep the previous default"),
        ]
        steps_groups = []
        for num, action, result in steps_data:
            num_t = cyan_accent(num, 0.45)
            act_t = brand_title(action, 0.55)
            res_t = brand_caption(result, 0.36).set_color(brand.NEUTRAL_MUTED)
            text_grp = VGroup(act_t, res_t).arrange(DOWN, aligned_edge=LEFT, buff=0.08)
            row = VGroup(num_t, text_grp).arrange(RIGHT, buff=0.6, aligned_edge=UP)
            steps_groups.append(row)
        steps_layout = VGroup(*steps_groups).arrange(DOWN, aligned_edge=LEFT, buff=0.8).move_to(DOWN * 0.3)

        for row in steps_groups:
            self.play(FadeIn(row, shift=RIGHT * 0.3), run_time=0.5)
            self.wait(6.5)

        # Session ends stamp
        end = cyan_accent("Session ended", 0.7).move_to(DOWN * 3.3)
        end.set_color(brand.NEUTRAL_MUTED)
        self.play(FadeIn(end), run_time=0.4)
        self.wait(2.0)
        self.play(FadeOut(VGroup(header, steps_layout, end)), run_time=0.4)


# ─────────────────────────────────────────────────────────────────────
# Scene 08 — Hardware Status Note (10s)
# ─────────────────────────────────────────────────────────────────────
class Scene08(Scene):
    def construct(self):
        # Pro-tip layout
        tip_label = cyan_accent("PRO TIP  ·  FROM THE MANUAL", 0.4).move_to(UP * 2.0)
        self.play(FadeIn(tip_label), run_time=0.3)

        box = RoundedRectangle(
            width=11, height=4, corner_radius=0.2,
            color=brand.WARNING_AMBER, fill_color=brand.SURFACE_PANEL,
            fill_opacity=0.85, stroke_width=3,
        ).move_to(ORIGIN)

        line1 = brand_title("Global tab  →  Hardware Status frame", 0.6).move_to(box.get_center() + UP * 0.9)
        line2 = brand_caption("Shows the hardware installed on the back plane.", 0.42).move_to(box.get_center() + UP * 0.2)
        line2.set_color(brand.NEUTRAL_LIGHT)
        line3 = brand_title("Checkboxes are pre-programmed.", 0.55).move_to(box.get_center() + DOWN * 0.5)
        line3.set_color(brand.WARNING_AMBER)
        line4 = brand_caption("You cannot change them. By design.   (Manual §4)", 0.4).move_to(box.get_center() + DOWN * 1.2)
        line4.set_color(brand.NEUTRAL_MUTED)

        self.play(FadeIn(box), run_time=0.4)
        self.play(
            AnimationGroup(
                FadeIn(line1, shift=UP * 0.1),
                FadeIn(line2),
                FadeIn(line3, shift=UP * 0.1),
                FadeIn(line4),
                lag_ratio=0.3,
            ),
            run_time=2.0,
        )
        self.wait(6.0)
        self.play(FadeOut(VGroup(tip_label, box, line1, line2, line3, line4)), run_time=0.4)


# ─────────────────────────────────────────────────────────────────────
# Scene 09 — Recap + CTA (10s)
# ─────────────────────────────────────────────────────────────────────
class Scene09(Scene):
    def construct(self):
        header = cyan_accent("QUICK RECAP", 0.7).to_edge(UP, buff=0.7)
        self.play(FadeIn(header), run_time=0.3)

        bullets_data = [
            ("01", "Two windows",   "INSTRUMENT + Setup Toolbox"),
            ("02", "8 + 5 + 12",    "elements / buttons / tabs"),
            ("03", "3-step exit",   "with Global Setup save decision"),
        ]
        rows = []
        for num, head, sub in bullets_data:
            n = cyan_accent(num, 0.6)
            h = brand_title(head, 0.7)
            s = brand_caption(sub, 0.42).set_color(brand.NEUTRAL_MUTED)
            tg = VGroup(h, s).arrange(DOWN, aligned_edge=LEFT, buff=0.1)
            row = VGroup(n, tg).arrange(RIGHT, buff=0.5, aligned_edge=UP)
            rows.append(row)
        bullets_grp = VGroup(*rows).arrange(DOWN, aligned_edge=LEFT, buff=0.5).move_to(UP * 0.2)

        for r in rows:
            self.play(FadeIn(r, shift=RIGHT * 0.2), run_time=0.4)
            self.wait(0.4)

        # CTA card
        cta_box = RoundedRectangle(
            width=10, height=1.4, corner_radius=0.15,
            color=brand.BRAND_CYAN, fill_color=brand.BRAND_CYAN,
            fill_opacity=0.1, stroke_width=2,
        ).to_edge(DOWN, buff=0.6)
        cta_top = brand_caption("NEXT  ·  MCI/O VIDEO 2", 0.4).set_color(brand.BRAND_CYAN).move_to(cta_box.get_center() + UP * 0.32)
        cta_main = brand_title("Setting Your First Timebase", 0.6).move_to(cta_box.get_center() + DOWN * 0.18)

        self.play(FadeIn(cta_box, shift=UP * 0.2), run_time=0.4)
        self.play(FadeIn(cta_top), FadeIn(cta_main), run_time=0.5)
        self.wait(3.5)

        self.play(FadeOut(VGroup(header, bullets_grp, cta_box, cta_top, cta_main)), run_time=0.4)
