"""
Brand-locked constants for every Manim scene.

Source of truth: training-videos/BRAND_KIT.md
Never override these values inside a scene — extend this module instead.
"""

# ───────── Colors (HEX) ─────────
BG_DARK        = "#0B1220"
SURFACE_PANEL  = "#111A2E"
BRAND_CYAN     = "#22D3EE"
BRAND_INDIGO   = "#6366F1"
SUCCESS_GREEN  = "#22C55E"
WARNING_AMBER  = "#F59E0B"
ERROR_RED      = "#EF4444"
NEUTRAL_LIGHT  = "#E2E8F0"
NEUTRAL_MUTED  = "#94A3B8"

# ───────── Typography ─────────
FONT_DISPLAY = "Inter Display"   # Fallback: Arial Black
FONT_BODY    = "Inter"           # Fallback: Arial
FONT_MONO    = "JetBrains Mono"  # Fallback: Courier New

# ───────── Common sizes (Manim units; ~scene height = 8) ─────────
TITLE_SIZE   = 1.2
HEADING_SIZE = 0.9
BODY_SIZE    = 0.6
CAPTION_SIZE = 0.4

# ───────── Animation easing ─────────
# Manim uses rate_func — these constants give consistent cinematic motion.
from manim import rate_functions

EASE_OUT_QUINT = rate_functions.ease_out_quint
EASE_IN_OUT    = rate_functions.smooth
EASE_LINEAR    = rate_functions.linear

# ───────── Standard durations ─────────
FADE_IN_DURATION = 0.35
TEXT_IN_DURATION = 0.45
HIGHLIGHT_PULSE  = 0.8
HOLD_BEAT        = 1.0

# ───────── Render presets ─────────
# Use these tags when running:
#   manim -qh wave_propagation.py WavePropagation  → 1080p
#   manim -qk wave_propagation.py WavePropagation  → 4K
