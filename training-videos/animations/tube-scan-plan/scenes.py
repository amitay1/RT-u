"""
Manim scenes for the Tube Scan Plan Guide training video.
Builds the pedagogical visuals identified by the user as missing:
  - BeforeAfterTCG     (sections 1-2): Before/After comparison
  - ActiveVisibleDrag  (section 7):    Active/Visible/Drag callout
  - FBHLabels          (section 9):    Near / Middle / Far badges
  - WaterPathWarning   (section 11):   Amber warning card
  - FinalChecklist     (section 18):   Animated 7-item checklist

Render all:
    cd training-videos/animations/tube-scan-plan
    python -m manim -qh scenes.py BeforeAfterTCG ActiveVisibleDrag FBHLabels WaterPathWarning FinalChecklist
"""

import sys
from pathlib import Path

import numpy as np

sys.path.append(str(Path(__file__).resolve().parents[1]))

from manim import (
    Scene, Text, VGroup, Group, Rectangle, RoundedRectangle, Line, DashedLine, Dot, Arrow,
    Axes, ImageMobject,
    UP, DOWN, LEFT, RIGHT, ORIGIN, UL, UR, DL, DR,
    FadeIn, FadeOut, Create, Write, Indicate, AnimationGroup, MoveAlongPath, Transform,
    rate_functions, config,
)

import brand  # noqa: E402

config.background_color = brand.BG_DARK
config.frame_rate = 60


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────
def title(text: str, scale: float = 0.8) -> Text:
    return Text(text, font=brand.FONT_DISPLAY, color=brand.BRAND_CYAN, weight="BOLD").scale(scale)


def body_text(text: str, scale: float = 0.5, color=None) -> Text:
    return Text(text, font=brand.FONT_BODY, color=color or brand.NEUTRAL_LIGHT).scale(scale)


def make_ascan_axes(x_length=5.5, y_length=2.8) -> Axes:
    return Axes(
        x_range=[0, 10, 1],
        y_range=[0, 100, 20],
        x_length=x_length,
        y_length=y_length,
        tips=False,
        axis_config={
            "color": brand.NEUTRAL_MUTED,
            "stroke_width": 1.5,
            "include_numbers": False,
        },
    )


def echo_signal(t, peaks):
    """peaks = [(center, amplitude, width), ...]"""
    total = 0.0
    for center, amp, w in peaks:
        envelope = amp * np.exp(-((t - center) ** 2) / (2 * w**2))
        carrier = np.sin(2 * np.pi * 2.0 * (t - center))
        total += envelope * carrier
    return max(total, 0)  # show positive envelope only


# ═════════════════════════════════════════════════════════════════
# Scene 1 — BEFORE / AFTER TCG
# ═════════════════════════════════════════════════════════════════
class BeforeAfterTCG(Scene):
    """Two A-scans side-by-side. BEFORE: peaks at 90/50/25. AFTER: all at 80%."""
    def construct(self):
        # ─── Title ───
        section_title = title("What TCG actually does", 0.6).to_edge(UP, buff=0.5)
        self.play(FadeIn(section_title), run_time=0.4)

        # ─── BEFORE side ───
        before_label = title("BEFORE", 0.55).set_color(brand.ERROR_RED)
        before_label.move_to(LEFT * 3.3 + UP * 1.9)

        before_axes = make_ascan_axes(x_length=5.5, y_length=2.4).next_to(before_label, DOWN, buff=0.3)
        before_signal = before_axes.plot(
            lambda t: echo_signal(t, [(2, 90, 0.5), (5, 50, 0.5), (8, 25, 0.5)]),
            x_range=[0, 10, 0.02],
            color=brand.BRAND_CYAN,
            stroke_width=3,
        )
        before_subtitle = body_text("Same FBH · Different amplitude", 0.32, brand.NEUTRAL_MUTED)
        before_subtitle.next_to(before_axes, DOWN, buff=0.2)

        # ─── AFTER side ───
        after_label = title("AFTER", 0.55).set_color(brand.SUCCESS_GREEN)
        after_label.move_to(RIGHT * 3.3 + UP * 1.9)

        after_axes = make_ascan_axes(x_length=5.5, y_length=2.4).next_to(after_label, DOWN, buff=0.3)
        # All three peaks at 80%
        after_signal = after_axes.plot(
            lambda t: echo_signal(t, [(2, 80, 0.5), (5, 80, 0.5), (8, 80, 0.5)]),
            x_range=[0, 10, 0.02],
            color=brand.BRAND_CYAN,
            stroke_width=3,
        )
        # 80% reference line on AFTER chart
        after_ref_line = DashedLine(
            after_axes.c2p(0, 80), after_axes.c2p(10, 80),
            color=brand.WARNING_AMBER,
            stroke_width=2,
            dash_length=0.1,
        )
        after_ref_label = body_text("80% FSH reference", 0.32, brand.WARNING_AMBER)
        after_ref_label.next_to(after_ref_line, UP, buff=0.05).align_to(after_axes, RIGHT)

        after_subtitle = body_text("All FBH responses adjusted to 80% FSH", 0.32, brand.SUCCESS_GREEN)
        after_subtitle.next_to(after_axes, DOWN, buff=0.2)

        # ─── Divider line ───
        divider = Line(UP * 1.8, DOWN * 2.4, color=brand.NEUTRAL_MUTED, stroke_width=1)

        # ─── Reveal BEFORE first ───
        self.play(FadeIn(before_label, shift=DOWN * 0.1), run_time=0.4)
        self.play(Create(before_axes, run_time=0.4))
        self.play(Create(before_signal, run_time=1.2))
        self.play(FadeIn(before_subtitle), run_time=0.3)
        self.wait(1.6)

        # ─── Divider ───
        self.play(Create(divider), run_time=0.3)

        # ─── Reveal AFTER ───
        self.play(FadeIn(after_label, shift=DOWN * 0.1), run_time=0.4)
        self.play(Create(after_axes, run_time=0.4))
        self.play(Create(after_ref_line, run_time=0.5))
        self.play(FadeIn(after_ref_label), run_time=0.3)
        self.play(Create(after_signal, run_time=1.4))
        self.play(FadeIn(after_subtitle), run_time=0.3)
        self.wait(2.5)

        # ─── Punchline ───
        punch = title("One reference level · across depth", 0.5).set_color(brand.NEUTRAL_LIGHT)
        punch.to_edge(DOWN, buff=0.4)
        self.play(FadeIn(punch, shift=UP * 0.2), run_time=0.5)
        self.wait(2.0)

        # ─── Clean exit ───
        all_objs = VGroup(
            section_title, before_label, before_axes, before_signal, before_subtitle,
            divider, after_label, after_axes, after_signal, after_ref_line, after_ref_label,
            after_subtitle, punch,
        )
        self.play(FadeOut(all_objs), run_time=0.4)


# ═════════════════════════════════════════════════════════════════
# Scene 2 — ACTIVE / VISIBLE / DRAG CALLOUT
# ═════════════════════════════════════════════════════════════════
class ActiveVisibleDrag(Scene):
    """Pro-tip card emphasising the 3 checkboxes that must be checked."""
    def construct(self):
        section_label = title("VERIFY · 3 CHECKBOXES", 0.45).to_edge(UP, buff=0.7)
        self.play(FadeIn(section_label), run_time=0.3)

        # Card frame
        card = RoundedRectangle(
            width=11, height=4.5,
            corner_radius=0.2,
            color=brand.BRAND_CYAN,
            fill_color=brand.SURFACE_PANEL,
            fill_opacity=0.9,
            stroke_width=3,
        ).move_to(ORIGIN)
        self.play(FadeIn(card), run_time=0.4)

        # Three checkboxes
        def make_checkbox_row(label_text, sub_text):
            box = RoundedRectangle(
                width=0.5, height=0.5,
                corner_radius=0.05,
                color=brand.BRAND_CYAN,
                fill_color=brand.BRAND_CYAN,
                fill_opacity=0.85,
                stroke_width=2,
            )
            check = Text("✓", font=brand.FONT_DISPLAY, color=brand.BG_DARK, weight="BOLD").scale(0.5)
            check.move_to(box.get_center())
            label = Text(label_text, font=brand.FONT_DISPLAY, color=brand.NEUTRAL_LIGHT, weight="BOLD").scale(0.6)
            sub = Text(sub_text, font=brand.FONT_BODY, color=brand.NEUTRAL_MUTED).scale(0.35)
            text_grp = VGroup(label, sub).arrange(DOWN, aligned_edge=LEFT, buff=0.05)
            row = VGroup(VGroup(box, check), text_grp).arrange(RIGHT, buff=0.4, aligned_edge=UP)
            return row

        rows_data = [
            ("Active",  "Enables the TCG line · required to edit segments"),
            ("Visible", "Makes the TCG line appear on the A-scan"),
            ("Drag",    "Allows you to drag points on the A-scan · CRITICAL"),
        ]
        rows = VGroup(*[make_checkbox_row(t, s) for t, s in rows_data])
        rows.arrange(DOWN, aligned_edge=LEFT, buff=0.4).move_to(card.get_center())

        for r in rows:
            self.play(FadeIn(r, shift=RIGHT * 0.3), run_time=0.35)
            self.wait(0.4)

        # Warning footer
        warning = body_text(
            "If Drag is OFF → you cannot move yellow dots in step 10.",
            0.4, brand.WARNING_AMBER,
        ).to_edge(DOWN, buff=0.7)
        self.play(FadeIn(warning, shift=UP * 0.2), run_time=0.5)
        self.wait(2.5)

        all_objs = Group(section_label, card, rows, warning)
        self.play(FadeOut(all_objs), run_time=0.4)


# ═════════════════════════════════════════════════════════════════
# Scene 3 — FBH BLOCK LABELS  (Near · Middle · Far)
# ═════════════════════════════════════════════════════════════════
class FBHLabels(Scene):
    """Overlays Near/Middle/Far badges on the Hagit-block photo."""
    def construct(self):
        # Background — the block photo
        photo_path = (Path(__file__).resolve().parents[2]
                      / "assets" / "tube-scan-plan" / "step-07-hagit-block-photo.png")
        try:
            photo = ImageMobject(str(photo_path)).scale_to_fit_height(6.0).move_to(ORIGIN)
        except Exception:
            photo = Rectangle(width=10, height=6, color=brand.SURFACE_PANEL, fill_opacity=0.5)
        self.add(photo)

        # Title
        section_title = title("Three FBH Standards", 0.6).to_edge(UP, buff=0.4)
        self.play(FadeIn(section_title), run_time=0.3)

        # Three badges arranged left to right at bottom (representing the 3 cylinders in the photo)
        def make_badge(num, label):
            box = RoundedRectangle(
                width=2.2, height=0.9,
                corner_radius=0.12,
                color=brand.BRAND_CYAN,
                fill_color=brand.BG_DARK,
                fill_opacity=0.95,
                stroke_width=2,
            )
            num_t = Text(num, font=brand.FONT_DISPLAY, color=brand.BRAND_CYAN, weight="BOLD").scale(0.5)
            lbl_t = Text(label, font=brand.FONT_BODY, color=brand.NEUTRAL_LIGHT).scale(0.35)
            text_grp = VGroup(num_t, lbl_t).arrange(RIGHT, buff=0.3)
            text_grp.move_to(box.get_center())
            return VGroup(box, text_grp)

        badge_near = make_badge("#1", "NEAR").move_to(LEFT * 4.0 + DOWN * 2.6)
        badge_mid = make_badge("#2", "MIDDLE").move_to(DOWN * 2.6)
        badge_far = make_badge("#3", "FAR").move_to(RIGHT * 4.0 + DOWN * 2.6)

        for badge in (badge_near, badge_mid, badge_far):
            self.play(FadeIn(badge, shift=UP * 0.2), run_time=0.4)
            self.wait(0.4)

        self.wait(2.0)
        self.play(
            FadeOut(section_title),
            FadeOut(Group(badge_near, badge_mid, badge_far)),
            FadeOut(photo),
            run_time=0.4,
        )


# ═════════════════════════════════════════════════════════════════
# Scene 4 — WATER PATH WARNING CARD
# ═════════════════════════════════════════════════════════════════
class WaterPathWarning(Scene):
    """Amber warning card for the water-path consistency rule."""
    def construct(self):
        # Big amber warning card
        card = RoundedRectangle(
            width=12, height=6,
            corner_radius=0.25,
            color=brand.WARNING_AMBER,
            fill_color=brand.SURFACE_PANEL,
            fill_opacity=0.92,
            stroke_width=4,
        ).move_to(ORIGIN)

        # Header bar
        header_bar = Rectangle(
            width=12, height=0.9,
            color=brand.WARNING_AMBER,
            fill_color=brand.WARNING_AMBER,
            fill_opacity=1.0,
            stroke_width=0,
        ).move_to(card.get_top() + DOWN * 0.45)
        header_text = Text(
            "IMPORTANT  ·  WATER PATH CONSISTENCY",
            font=brand.FONT_DISPLAY,
            color=brand.BG_DARK,
            weight="BOLD",
        ).scale(0.5).move_to(header_bar.get_center())

        # Body lines
        line1 = Text(
            "Keep the water path consistent",
            font=brand.FONT_DISPLAY,
            color=brand.NEUTRAL_LIGHT,
            weight="BOLD",
        ).scale(0.65).move_to(card.get_center() + UP * 0.7)

        line2 = Text(
            "within  ± ¼ inch",
            font=brand.FONT_DISPLAY,
            color=brand.WARNING_AMBER,
            weight="BOLD",
        ).scale(0.9).move_to(card.get_center() + UP * 0.0)

        line3 = Text(
            "during standardisation  ·  initial scanning  ·  final evaluation",
            font=brand.FONT_BODY,
            color=brand.NEUTRAL_MUTED,
        ).scale(0.42).move_to(card.get_center() + DOWN * 0.8)

        line4 = Text(
            "Deviation beyond ±¼ inch requires re-standardization",
            font=brand.FONT_DISPLAY,
            color=brand.WARNING_AMBER,
            weight="BOLD",
        ).scale(0.5).move_to(card.get_center() + DOWN * 1.6)

        # Animate in
        self.play(FadeIn(card), FadeIn(header_bar), run_time=0.4)
        self.play(FadeIn(header_text), run_time=0.3)
        self.play(FadeIn(line1, shift=UP * 0.1), run_time=0.4)
        self.play(FadeIn(line2, shift=UP * 0.1), run_time=0.5)
        self.play(FadeIn(line3), run_time=0.4)
        self.wait(0.5)
        self.play(FadeIn(line4, shift=UP * 0.1), run_time=0.5)
        self.wait(3.5)

        self.play(
            FadeOut(VGroup(card, header_bar, header_text, line1, line2, line3, line4)),
            run_time=0.4,
        )


# ═════════════════════════════════════════════════════════════════
# Scene 5 — FINAL CHECKLIST
# ═════════════════════════════════════════════════════════════════
class FinalChecklist(Scene):
    """7-item animated checklist with cyan checkmarks appearing one by one."""
    def construct(self):
        section_title = title("TCG CALIBRATION CHECKLIST", 0.75).to_edge(UP, buff=0.6)
        self.play(FadeIn(section_title), run_time=0.4)

        items = [
            "Teach In opened",
            "Material velocity set",
            "Range set",
            "Water path kept within ±¼ inch",
            "Three FBH responses set to 80% FSH",
            "Optional back-wall points added if needed",
            "TCG setup saved",
        ]

        def make_row(text):
            box = RoundedRectangle(
                width=0.55, height=0.55, corner_radius=0.06,
                color=brand.NEUTRAL_MUTED,
                fill_color=brand.SURFACE_PANEL,
                fill_opacity=0.6,
                stroke_width=2,
            )
            check = Text("✓", font=brand.FONT_DISPLAY, color=brand.SUCCESS_GREEN, weight="BOLD").scale(0.55)
            check.move_to(box.get_center())
            check.set_opacity(0)  # hidden initially
            label = body_text(text, 0.5, brand.NEUTRAL_LIGHT)
            row = VGroup(VGroup(box, check), label).arrange(RIGHT, buff=0.4, aligned_edge=DOWN)
            return row, box, check

        rows_data = [make_row(t) for t in items]
        rows = VGroup(*[r[0] for r in rows_data])
        rows.arrange(DOWN, aligned_edge=LEFT, buff=0.32).move_to(ORIGIN + DOWN * 0.2)

        # Reveal rows
        for r, _, _ in rows_data:
            self.play(FadeIn(r, shift=RIGHT * 0.3), run_time=0.25)
            self.wait(0.08)

        self.wait(0.4)

        # Now check each one off in sequence
        for r, box, check in rows_data:
            self.play(
                box.animate.set_color(brand.SUCCESS_GREEN).set_fill(brand.SUCCESS_GREEN, opacity=0.2),
                check.animate.set_opacity(1),
                run_time=0.25,
            )
            self.wait(0.18)

        self.wait(1.0)

        # Final stamp
        stamp = title("Ready to inspect.", 0.7).set_color(brand.SUCCESS_GREEN)
        stamp.to_edge(DOWN, buff=0.5)
        self.play(FadeIn(stamp, shift=UP * 0.2), run_time=0.5)
        self.wait(2.5)

        self.play(FadeOut(VGroup(section_title, rows, stamp)), run_time=0.4)


# ═════════════════════════════════════════════════════════════════
# Scene 6 — DRAG + 80% FSH OVERLAY (reusable composite)
# ═════════════════════════════════════════════════════════════════
class DragAnd80FSH(Scene):
    """Reusable overlay: A-scan with 80% FSH line + drag arrow demo.
    Used in steps 10/11/12 — render once, drop in three times in editor."""
    def construct(self):
        section_title = title("Drag yellow dot → onto the peak", 0.5).to_edge(UP, buff=0.5)
        self.play(FadeIn(section_title), run_time=0.3)

        axes = make_ascan_axes(x_length=10, y_length=4.5).move_to(DOWN * 0.4)

        # Single tall FBH echo at center
        signal = axes.plot(
            lambda t: echo_signal(t, [(5, 92, 0.45)]),
            x_range=[0, 10, 0.02],
            color=brand.BRAND_CYAN,
            stroke_width=3,
        )

        # 80% FSH reference line
        ref_line = DashedLine(
            axes.c2p(0, 80), axes.c2p(10, 80),
            color=brand.WARNING_AMBER,
            stroke_width=2.5,
            dash_length=0.12,
        )
        ref_label = body_text("80% FSH — reference", 0.42, brand.WARNING_AMBER)
        ref_label.move_to(axes.c2p(9, 80) + UP * 0.3).align_to(axes.c2p(8.5, 80), RIGHT)

        self.play(Create(axes), run_time=0.5)
        self.play(Create(signal), run_time=1.0)
        self.play(Create(ref_line), FadeIn(ref_label), run_time=0.5)
        self.wait(0.6)

        # Yellow dot starts on baseline
        start_point = axes.c2p(5, 5)
        end_point = axes.c2p(5, 92)
        yellow_dot = Dot(point=start_point, radius=0.16, color=brand.WARNING_AMBER)
        self.play(FadeIn(yellow_dot), run_time=0.3)

        # Drag arrow
        drag_arrow = Arrow(
            start=axes.c2p(5.3, 5),
            end=axes.c2p(5.3, 90),
            color=brand.BRAND_CYAN,
            buff=0,
            stroke_width=6,
            max_tip_length_to_length_ratio=0.08,
        )
        drag_label = body_text("DRAG", 0.45, brand.BRAND_CYAN)
        drag_label.next_to(drag_arrow, RIGHT, buff=0.2)
        self.play(Create(drag_arrow), FadeIn(drag_label), run_time=0.6)
        self.wait(0.4)

        # Animate dot rising
        self.play(yellow_dot.animate.move_to(end_point), run_time=1.4, rate_func=rate_functions.ease_in_out_cubic)
        self.play(Indicate(yellow_dot, scale_factor=1.5, color=brand.SUCCESS_GREEN), run_time=0.5)

        # Confirmation
        ok = title("Peak at 80% FSH ✓", 0.55).set_color(brand.SUCCESS_GREEN)
        ok.to_edge(DOWN, buff=0.5)
        self.play(FadeIn(ok, shift=UP * 0.2), run_time=0.4)
        self.wait(1.8)

        all_objs = VGroup(section_title, axes, signal, ref_line, ref_label,
                          yellow_dot, drag_arrow, drag_label, ok)
        self.play(FadeOut(all_objs), run_time=0.4)


# ═════════════════════════════════════════════════════════════════
# Scene 7 [v3] — INTRO TITLE
# ═════════════════════════════════════════════════════════════════
class IntroTitle(Scene):
    """Opening title card: TCG Calibration for Normal Beam Inspection."""
    def construct(self):
        # Series tag
        tag = Text(
            "SCANMASTER  ·  TRAINING",
            font=brand.FONT_BODY,
            color=brand.BRAND_CYAN,
            weight="BOLD",
        ).scale(0.4).move_to(UP * 2.4)

        # Main title (two lines)
        title_l1 = Text(
            "TCG Calibration",
            font=brand.FONT_DISPLAY,
            color=brand.NEUTRAL_LIGHT,
            weight="BOLD",
        ).scale(1.3).move_to(UP * 1.1)

        title_l2 = Text(
            "for Normal Beam Inspection",
            font=brand.FONT_DISPLAY,
            color=brand.NEUTRAL_LIGHT,
            weight="BOLD",
        ).scale(0.85).move_to(UP * 0.1)

        # Cyan rule
        rule = Line(LEFT * 1.5, RIGHT * 1.5, color=brand.BRAND_CYAN, stroke_width=4)\
            .move_to(DOWN * 0.6)

        # Subtitle
        sub_line1 = Text(
            "In this video, you will learn how to create,",
            font=brand.FONT_BODY,
            color=brand.NEUTRAL_MUTED,
        ).scale(0.5).move_to(DOWN * 1.3)

        sub_line2 = Text(
            "verify, and save a TCG setup in ScanMaster.",
            font=brand.FONT_BODY,
            color=brand.NEUTRAL_MUTED,
        ).scale(0.5).move_to(DOWN * 1.9)

        # Animate in
        self.play(FadeIn(tag, shift=UP * 0.1), run_time=0.4)
        self.play(Write(title_l1), run_time=0.7)
        self.play(Write(title_l2), run_time=0.5)
        self.play(Create(rule), run_time=0.3)
        self.play(FadeIn(sub_line1, shift=UP * 0.1), run_time=0.4)
        self.play(FadeIn(sub_line2, shift=UP * 0.1), run_time=0.4)
        self.wait(3.0)

        # Clean exit
        self.play(FadeOut(VGroup(tag, title_l1, title_l2, rule, sub_line1, sub_line2)), run_time=0.4)


# ═════════════════════════════════════════════════════════════════
# Scene 8 [v3] — REQUIRED EQUIPMENT
# ═════════════════════════════════════════════════════════════════
class RequiredEquipment(Scene):
    """Pre-flight checklist of what to prepare before starting."""
    def construct(self):
        section_title = title("Before You Start", 0.7).to_edge(UP, buff=0.7)
        self.play(FadeIn(section_title), run_time=0.4)

        subtitle = body_text("Prepare these six items:", 0.45, brand.NEUTRAL_MUTED)\
            .next_to(section_title, DOWN, buff=0.2)
        self.play(FadeIn(subtitle), run_time=0.3)

        items = [
            "ScanMaster system",
            "Normal beam probe",
            "Calibration block with ≥ 3 FBH reflectors,  3/64 inch  or as required",
            "Correct material velocity",
            "Stable water path",
            "Access to Teach In mode",
        ]

        def make_row(text):
            dot = Dot(radius=0.13, color=brand.BRAND_CYAN)
            label = body_text(text, 0.5, brand.NEUTRAL_LIGHT)
            return VGroup(dot, label).arrange(RIGHT, buff=0.4, aligned_edge=DOWN)

        rows = VGroup(*[make_row(t) for t in items])
        rows.arrange(DOWN, aligned_edge=LEFT, buff=0.4).move_to(DOWN * 0.3)

        for r in rows:
            self.play(FadeIn(r, shift=RIGHT * 0.2), run_time=0.3)
            self.wait(0.4)

        self.wait(1.8)

        # Final stamp
        stamp = body_text(
            "Once ready  →  open the ScanMaster Wizard.",
            0.45, brand.BRAND_CYAN,
        ).to_edge(DOWN, buff=0.6)
        self.play(FadeIn(stamp, shift=UP * 0.2), run_time=0.4)
        self.wait(2.0)

        self.play(FadeOut(VGroup(section_title, subtitle, rows, stamp)), run_time=0.4)


# ═════════════════════════════════════════════════════════════════
# Scene 9 [v3] — OPEN SCANMASTER → TEACH IN
# ═════════════════════════════════════════════════════════════════
class OpenScanMasterTeachIn(Scene):
    """Zoom on the Teach In tile in the wizard menu."""
    def construct(self):
        section_title = title("Open ScanMaster  →  Click Teach In", 0.6).to_edge(UP, buff=0.5)
        self.play(FadeIn(section_title), run_time=0.4)

        # Background — the wizard menu screenshot
        photo_path = (Path(__file__).resolve().parents[2]
                      / "assets" / "tube-scan-plan" / "step-03-scanmaster-wizard-menu.png")
        try:
            photo = ImageMobject(str(photo_path)).scale_to_fit_height(5.5).move_to(DOWN * 0.2)
        except Exception:
            photo = Rectangle(width=8, height=5.5, color=brand.SURFACE_PANEL, fill_opacity=0.5)
        self.add(photo)
        self.play(FadeIn(photo, run_time=0.5))

        # Highlight box around the Teach In tile (top-middle of the menu)
        # The menu image is roughly 6 tiles in a 3×2 grid; Teach In is top-middle
        photo_top = photo.get_top()[1]
        photo_bottom = photo.get_bottom()[1]
        photo_left = photo.get_left()[0]
        photo_right = photo.get_right()[0]
        photo_w = photo_right - photo_left
        photo_h = photo_top - photo_bottom

        # Tile estimated coords (top-middle column, top row)
        tile_w = photo_w * 0.31
        tile_h = photo_h * 0.22
        tile_x = photo_left + photo_w * 0.50
        tile_y = photo_top - photo_h * 0.22

        ring = Rectangle(
            width=tile_w, height=tile_h,
            color=brand.BRAND_CYAN,
            stroke_width=6,
            fill_opacity=0.0,
        ).move_to([tile_x, tile_y, 0])

        # Arrow pointing to the Teach In tile from the right
        arrow_start = [tile_x + tile_w * 0.7 + 1.5, tile_y, 0]
        arrow_end = [tile_x + tile_w * 0.55, tile_y, 0]
        arrow = Arrow(
            start=arrow_start, end=arrow_end,
            color=brand.BRAND_CYAN,
            buff=0,
            stroke_width=6,
            max_tip_length_to_length_ratio=0.25,
        )
        arrow_label = Text(
            "TEACH IN",
            font=brand.FONT_DISPLAY,
            color=brand.BRAND_CYAN,
            weight="BOLD",
        ).scale(0.55).next_to(arrow, RIGHT, buff=0.2)

        self.play(Create(ring), run_time=0.5)
        self.play(Indicate(ring, scale_factor=1.05, color=brand.BRAND_CYAN), run_time=0.6)
        self.play(Create(arrow), FadeIn(arrow_label), run_time=0.5)
        self.wait(2.5)

        # Footer
        footer = body_text(
            "A new screen image appears  →  the Setup Toolbox dialog.",
            0.42, brand.NEUTRAL_MUTED,
        ).to_edge(DOWN, buff=0.4)
        self.play(FadeIn(footer), run_time=0.4)
        self.wait(1.6)

        all_objs = Group(section_title, photo, ring, arrow, arrow_label, footer)
        self.play(FadeOut(all_objs), run_time=0.4)


# ═════════════════════════════════════════════════════════════════
# Scene 10 [v3] — SET BASIC PARAMETERS
# ═════════════════════════════════════════════════════════════════
class SetBasicParameters(Scene):
    """4 parameters appearing one at a time: Material velocity / Range / Gain / Water path."""
    def construct(self):
        section_title = title("Set Basic Parameters", 0.7).to_edge(UP, buff=0.6)
        self.play(FadeIn(section_title), run_time=0.4)

        # Background — the highlighted Setup Toolbox screenshot
        photo_path = (Path(__file__).resolve().parents[2]
                      / "assets" / "tube-scan-plan" / "step-08-setup-toolbox-highlighted.png")
        try:
            photo = ImageMobject(str(photo_path)).scale_to_fit_height(2.4).move_to(UP * 1.7)
        except Exception:
            photo = Rectangle(width=10, height=2.4, color=brand.SURFACE_PANEL, fill_opacity=0.5).move_to(UP * 1.7)
        self.add(photo)
        self.play(FadeIn(photo, run_time=0.4))

        # Four parameter cards appearing below
        def param_card(num, name, sub):
            box = RoundedRectangle(
                width=3.0, height=1.4,
                corner_radius=0.12,
                color=brand.NEUTRAL_MUTED,
                fill_color=brand.SURFACE_PANEL,
                fill_opacity=0.75,
                stroke_width=2,
            )
            n_t = Text(num, font=brand.FONT_DISPLAY, color=brand.BRAND_CYAN, weight="BOLD")\
                .scale(0.45).move_to(box.get_corner(UL) + DR * 0.3)
            name_t = Text(name, font=brand.FONT_DISPLAY, color=brand.NEUTRAL_LIGHT, weight="BOLD")\
                .scale(0.45).move_to(box.get_center() + UP * 0.15)
            sub_t = Text(sub, font=brand.FONT_BODY, color=brand.NEUTRAL_MUTED)\
                .scale(0.32).move_to(box.get_center() + DOWN * 0.35)
            return VGroup(box, n_t, name_t, sub_t)

        # 4 cards in a single row at the bottom half — fits cleanly below the photo
        cards = [
            param_card("1", "Material velocity", "from material database"),
            param_card("2", "Range", "until back wall visible"),
            param_card("3", "Gain", "FBH response verified"),
            param_card("4", "Water path", "consistent during calibration & scan"),
        ]
        row = VGroup(*cards).arrange(RIGHT, buff=0.22).move_to(DOWN * 1.6)

        for c in cards:
            self.play(FadeIn(c, shift=UP * 0.2), run_time=0.4)
            # Highlight card cyan briefly
            box = c[0]
            self.play(
                box.animate.set_color(brand.BRAND_CYAN).set_fill(brand.BRAND_CYAN, opacity=0.15),
                run_time=0.3,
            )
            self.wait(1.3)

        # Extra emphasis on the 4th card (Water path) — easiest to forget
        water_box = cards[3][0]
        water_name = cards[3][2]
        self.play(
            water_box.animate.set_color(brand.WARNING_AMBER).set_fill(brand.WARNING_AMBER, opacity=0.18),
            water_name.animate.set_color(brand.WARNING_AMBER),
            run_time=0.5,
        )
        self.play(
            Indicate(cards[3], scale_factor=1.08, color=brand.WARNING_AMBER),
            run_time=0.6,
        )
        self.wait(1.5)
        self.play(FadeOut(Group(section_title, photo, row)), run_time=0.4)


# ═════════════════════════════════════════════════════════════════
# Scene 11 [v4] — SAVE TCG SETUP  (with real screenshot)
# ═════════════════════════════════════════════════════════════════
class SaveTCGSetup(Scene):
    """4-step save sequence + REAL UPRDB Navigator screenshot + filename + success."""
    def construct(self):
        section_title = title("Save the TCG Setup", 0.65).to_edge(UP, buff=0.4)
        self.play(FadeIn(section_title), run_time=0.4)

        # Real screenshot of Files tab + UPRDB Navigator on the LEFT side
        photo_path = (Path(__file__).resolve().parents[2]
                      / "assets" / "tube-scan-plan" / "step-13-save-tcg-uprdb-navigator.png")
        try:
            photo = ImageMobject(str(photo_path)).scale_to_fit_height(5.5).to_edge(LEFT, buff=0.6)
        except Exception:
            photo = Rectangle(width=6, height=5.5, color=brand.SURFACE_PANEL, fill_opacity=0.5).to_edge(LEFT, buff=0.6)

        self.play(FadeIn(photo, run_time=0.5))

        # 4-step list on the RIGHT side
        def step_row(num, action):
            n = Text(num, font=brand.FONT_DISPLAY, color=brand.BRAND_CYAN, weight="BOLD").scale(0.55)
            t = body_text(action, 0.45, brand.NEUTRAL_LIGHT)
            return VGroup(n, t).arrange(RIGHT, buff=0.35, aligned_edge=DOWN)

        steps = [
            step_row("1.", "Click the  Files  tab"),
            step_row("2.", "Under  TCG, click  Save"),
            step_row("3.", "UPRDB Navigator  opens"),
            step_row("4.", "Name file  →  click  Save"),
        ]
        list_grp = VGroup(*steps).arrange(DOWN, aligned_edge=LEFT, buff=0.45).to_edge(RIGHT, buff=0.8).shift(UP * 0.3)

        for s in steps:
            self.play(FadeIn(s, shift=RIGHT * 0.3), run_time=0.4)
            self.wait(0.7)

        self.wait(0.6)

        # Filename suggestion card (bottom)
        name_card = RoundedRectangle(
            width=13, height=1.1,
            corner_radius=0.15,
            color=brand.BRAND_CYAN,
            fill_color=brand.SURFACE_PANEL,
            fill_opacity=0.92,
            stroke_width=2,
        ).to_edge(DOWN, buff=0.8)

        name_label = body_text("Suggested file name:", 0.36, brand.NEUTRAL_MUTED)\
            .move_to(name_card.get_center() + UP * 0.28)
        name_value = Text(
            "NormalBeam_TCG_3-64FBH_YYYY-MM-DD",
            font=brand.FONT_MONO,
            color=brand.BRAND_CYAN,
            weight="BOLD",
        ).scale(0.45).move_to(name_card.get_center() + DOWN * 0.18)

        self.play(FadeIn(name_card), run_time=0.4)
        self.play(FadeIn(name_label), FadeIn(name_value), run_time=0.5)
        self.wait(1.2)

        # Success confirmation
        success = title("TCG setup saved", 0.55).set_color(brand.SUCCESS_GREEN)
        success.to_edge(DOWN, buff=0.2)
        self.play(FadeIn(success, shift=UP * 0.2), run_time=0.5)
        self.wait(1.8)

        self.play(
            FadeOut(Group(section_title, photo, list_grp, name_card, name_label, name_value, success)),
            run_time=0.4,
        )


# ═════════════════════════════════════════════════════════════════
# Scene 12 [v4] — POINT SEQUENCE  (#1 / #2 / #3 emphasis)
# ═════════════════════════════════════════════════════════════════
class PointSequence(Scene):
    """3 quick badge cards making the repetition explicit: Set Point #1 → #2 → #3."""
    def construct(self):
        section_title = title("Three Reference Points", 0.7).to_edge(UP, buff=0.7)
        sub = body_text("The same action — repeated three times", 0.45, brand.NEUTRAL_MUTED)\
            .next_to(section_title, DOWN, buff=0.2)
        self.play(FadeIn(section_title), FadeIn(sub), run_time=0.4)

        def point_card(num, sub_text):
            box = RoundedRectangle(
                width=3.6, height=2.4,
                corner_radius=0.18,
                color=brand.NEUTRAL_MUTED,
                fill_color=brand.SURFACE_PANEL,
                fill_opacity=0.7,
                stroke_width=2,
            )
            tag = Text("SET", font=brand.FONT_BODY, color=brand.BRAND_CYAN, weight="BOLD").scale(0.4)\
                .move_to(box.get_center() + UP * 0.6)
            num_t = Text(f"Point {num}", font=brand.FONT_DISPLAY, color=brand.NEUTRAL_LIGHT, weight="BOLD")\
                .scale(0.85).move_to(box.get_center() + UP * 0.05)
            sub_t = body_text(sub_text, 0.36, brand.NEUTRAL_MUTED)\
                .move_to(box.get_center() + DOWN * 0.7)
            return VGroup(box, tag, num_t, sub_t)

        cards = [
            point_card("#1", "Near FBH @ 80% FSH"),
            point_card("#2", "Middle FBH @ 80% FSH"),
            point_card("#3", "Far FBH @ 80% FSH"),
        ]
        row = VGroup(*cards).arrange(RIGHT, buff=0.5).move_to(DOWN * 0.3)

        # Reveal each card with cyan highlight
        for c in cards:
            self.play(FadeIn(c, shift=UP * 0.2), run_time=0.45)
            box = c[0]
            self.play(
                box.animate.set_color(brand.BRAND_CYAN).set_fill(brand.BRAND_CYAN, opacity=0.12),
                run_time=0.3,
            )
            self.wait(0.8)

        # Pulse all three at the end
        self.play(
            *[Indicate(c[0], scale_factor=1.04, color=brand.BRAND_CYAN) for c in cards],
            run_time=0.6,
        )

        # Closing line
        closer = body_text("Drag yellow dot → 80% FSH → Save  ·  three times.", 0.45, brand.BRAND_CYAN)\
            .to_edge(DOWN, buff=0.6)
        self.play(FadeIn(closer, shift=UP * 0.2), run_time=0.4)
        self.wait(2.5)

        self.play(FadeOut(VGroup(section_title, sub, row, closer)), run_time=0.4)


# ═════════════════════════════════════════════════════════════════
# Scene 13 [v4] — OPTIONAL BACK-WALL POINTS  (dedicated clip)
# ═════════════════════════════════════════════════════════════════
class OptionalBackWallPoints(Scene):
    """Short dedicated clip: 'Optional: Add back-wall TCG points if required'."""
    def construct(self):
        # OPTIONAL tag
        optional_tag = Text(
            "OPTIONAL  ·  STEP 13",
            font=brand.FONT_BODY,
            color=brand.WARNING_AMBER,
            weight="BOLD",
        ).scale(0.4).to_edge(UP, buff=0.7)
        self.play(FadeIn(optional_tag), run_time=0.3)

        # Main heading
        heading = title("Add Back-Wall TCG Points", 0.7).next_to(optional_tag, DOWN, buff=0.3)
        sub_heading = body_text("if your inspection extends to full part depth", 0.42, brand.NEUTRAL_MUTED)\
            .next_to(heading, DOWN, buff=0.2)
        self.play(FadeIn(heading), FadeIn(sub_heading), run_time=0.4)

        # Real screenshot of back-wall A-scan
        photo_path = (Path(__file__).resolve().parents[2]
                      / "assets" / "tube-scan-plan" / "step-13-ascan-backwall-tcg-points.png")
        try:
            photo = ImageMobject(str(photo_path)).scale_to_fit_height(4.0).move_to(DOWN * 0.3)
        except Exception:
            photo = Rectangle(width=10, height=4, color=brand.SURFACE_PANEL, fill_opacity=0.5).move_to(DOWN * 0.3)
        self.play(FadeIn(photo), run_time=0.5)

        # Three bullet rules under the photo
        rules = VGroup(
            body_text("Click toolbar button → set first point BEFORE the back-wall pulse", 0.36, brand.NEUTRAL_LIGHT),
            body_text("Set second point AFTER the back-wall pulse", 0.36, brand.NEUTRAL_LIGHT),
            body_text("Create at least 4 points total to define the back-wall TCG curve", 0.36, brand.WARNING_AMBER),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.18).to_edge(DOWN, buff=0.4)

        for r in rules:
            self.play(FadeIn(r, shift=RIGHT * 0.2), run_time=0.35)
            self.wait(0.7)

        self.wait(1.4)

        # Skip note
        skip = body_text(
            "Skip this step if your inspection only covers the FBH depth range.",
            0.36, brand.NEUTRAL_MUTED,
        ).to_edge(DOWN, buff=0.05)
        self.play(FadeIn(skip), run_time=0.4)
        self.wait(1.6)

        self.play(FadeOut(Group(optional_tag, heading, sub_heading, photo, rules, skip)), run_time=0.4)
