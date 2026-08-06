// ============================================================================
// ScanMasterEducationalSequencer
//
// The "movie director" — runs the same 19-scene educational story as the
// offline MP4, but native in Unity with:
//
//   • Cinematic animated cameras (dolly + rotate + FOV) per scene
//   • World-space TextMeshPro-style canvases (via OnGUI for compatibility)
//   • Live 3D educational diagrams (Snell beam, FSH gauge, zone ring badges)
//   • Driven by a single timeline — press Play and it runs end-to-end
//
// Camera owns the show — it overrides ScanMasterCameraOrbit while running.
// All HUD/diagrams created here, no asset dependencies.
//
// Hotkeys (while playing):
//   N — next scene
//   P — previous scene
//   R — restart from beginning
//   T — toggle auto-advance
// ============================================================================
using System.Collections.Generic;
using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    // Late execution order so our LateUpdate runs AFTER every other script's
    // LateUpdate (camera orbits, probe beam enablers, etc.) — guarantees we get
    // the final word on camera transform + on which legacy props are hidden.
    [DefaultExecutionOrder(2000)]
    public sealed class ScanMasterEducationalSequencer : MonoBehaviour
    {
        [Header("References — auto-found if null")]
        [SerializeField] private Camera mainCam;
        [SerializeField] private Transform diskRoot;
        [SerializeField] private Transform robotRoot;
        [SerializeField] private Transform probeMount;

        [Header("Behaviour")]
        [SerializeField] private bool autoStart = true;
        [SerializeField] private bool autoAdvance = true;
        [SerializeField] private float globalSpeed = 1.0f;

        // Recording mode: when true the sequencer uses Time.time (Unity-scaled)
        // instead of realtimeSinceStartup. This makes the sequence deterministic
        // when Time.captureFramerate is set — each frame advances exactly
        // 1/framerate seconds regardless of how long the screenshot took.
        public bool RecordingMode { get; set; } = false;

        // ============== Scene definitions ==============
        // Mirror the 19-scene v2 curriculum (Title → Why immersion → Water path
        // → Snell → ±45° → Anatomy → 0.020" rule → FSH → Calibration → Equipment
        // → Scan Plan → +45 → -45 → A-D → A vs C → Live → Results → Save → Done)
        //
        // CAMERA — ORBITAL coords around the scan center:
        //   azimuth   = horizontal angle (0 = +X axis, 90 = +Z, 180 = -X, 270 = -Z)
        //   elevation = vertical angle (0 = horizontal, 90 = top-down)
        //   distance  = how far from scan center
        //   fov       = field of view
        //   focusOffset = optional offset added to scanCenter (e.g. to look at FSH gauge)
        //
        // Camera ALWAYS looks AT scanCenter + focusOffset — guaranteed framing.
        [System.Serializable]
        public struct CamShot
        {
            public float startAzimuth;
            public float startElevation;
            public float startDistance;
            public float startFov;
            public float endAzimuth;
            public float endElevation;
            public float endDistance;
            public float endFov;
            public Vector3 focusOffset;       // added to scanCenter for the look-at target
            // Legacy fields kept for backwards compat (unused with orbital)
            public Vector3 startPos; public Vector3 startRot; public Vector3 endPos; public Vector3 endRot;
        }

        // Helper to build a CamShot using orbital coords
        static CamShot Orb(float a0, float e0, float d0, float fov0,
                          float a1, float e1, float d1, float fov1,
                          Vector3 offset = default)
        {
            return new CamShot{
                startAzimuth=a0, startElevation=e0, startDistance=d0, startFov=fov0,
                endAzimuth=a1, endElevation=e1, endDistance=d1, endFov=fov1,
                focusOffset=offset,
            };
        }

        [System.Serializable]
        public struct EduScene
        {
            public string id;
            public string title;
            public string subtitle;
            public string takeaway;
            public Color accent;
            public float duration;
            public CamShot cam;
            public string concept;   // "snell" | "fsh" | "calib" | "zones" | "coverage" | "ascan_cscan" | ""
            // OPTIONAL: rapid sub-shots that override the main cam over time.
            // If non-null + non-empty, the scene's duration is split equally
            // between sub-shots — each sub-shot just SNAPS to its pos/rot/fov
            // (no easing) so it feels like a rapid cut.
            public CamShot[] subShots;
        }

        // Palette
        static readonly Color ACCENT  = new Color(0f,     0.898f, 1f);          // cyan
        static readonly Color ACCENT2 = new Color(1f,     0.80f,  0f);          // amber
        static readonly Color ACCENT3 = new Color(0f,     1f,     0.533f);      // green
        static readonly Color DANGER  = new Color(1f,     0.302f, 0.427f);      // pink
        static readonly Color PURPLE  = new Color(1f,     0f,     1f);

        // Camera anchors around the scene
        // ORBITAL camera shots — guaranteed to frame the scan zone.
        //   Distance: 0.20-1.20 m from scan center (0.22, 0.252, 0)
        //   Elevation: 5-85° (5=side, 90=top-down)
        //   Azimuth:  0-360° around scan center
        //   FOV:      10-32° (10=macro, 30=wide)
        //
        // ACTUAL scan center coords:
        //   Disk TOP    = (0.000, 0.252, 0.000)
        //   Probe Mount = (0.220, 0.320, 0.000)
        //   Turntable   = (0.000, 0.080, 0.000)
        //   Tank size   = 3.2 × 1.25 × 2.2 m
        //
        // The scan zone is TINY — roughly 0.4 m wide on the disk top. All camera
        // moves now focus on a small area around (0.0, 0.30, 0) with narrow FOV
        // (18–28°) for macro/cinematic feel.  Wide-angle (FOV 40+) is reserved
        // for the title + done bookends only.
        static readonly EduScene[] Story = new[]
        {
            // 1 — Title: cinematic reveal — wide 3/4 dolly to medium
            // (duration sized to fit narration MP3 + crossfade buffer; was 6f)
            new EduScene{
                id="title", title="V2500 HPT DISK", subtitle="Immersion Scan Plan · Stage 1 · NDIP-1226 Rev F",
                takeaway="", accent=ACCENT, duration=8f, concept="",
                cam = Orb(-110, 22, 0.95f, 32,  -90, 18, 0.70f, 26),
            },
            // 2 — Why immersion: macro on water column above disk (was 10f, audio 21.3s)
            new EduScene{
                id="why_immersion", title="WHY  IMMERSION?", subtitle="Water = repeatable couplant",
                takeaway="Every pulse sees the same 8 inches",
                accent=ACCENT, duration=22f, concept="why_immersion",
                cam = Orb(-100, 12, 0.45f, 22,  -90, 8, 0.35f, 18),
            },
            // 3 — Water path: pure side view showing 8 inch gap probe → disk (was 10f, audio 20.2s)
            new EduScene{
                id="water_path", title="WATER  PATH", subtitle="8 inch = transducer focal length",
                takeaway="Focal point ON the disk = min beam diameter",
                accent=ACCENT, duration=21f, concept="water_path",
                cam = Orb(0, 6, 0.70f, 26,   0, 4, 0.62f, 22,  new Vector3(0, 0.10f, 0)),
            },
            // 4 — Snell's law: cross-section at water/steel interface (was 12f, audio 21.2s)
            // Snell prop is now built at Y=0.252 (= disk surface), so its
            // interface line coincides with scanCenter. No focusOffset needed —
            // the camera looks straight at the interface where the rays meet.
            new EduScene{
                id="snell", title="SNELL'S  LAW", subtitle="18.9 degree to 45 degree at water-steel interface",
                takeaway="Perpendicular to typical bore cracks",
                accent=ACCENT2, duration=22f, concept="snell",
                cam = Orb(-45, 5, 0.38f, 20,  -55, 2, 0.30f, 16),
            },
            // 5 — Both directions: rapid cuts +45 / -45 / top (was 10f, audio 21.9s)
            new EduScene{
                id="both_dir", title="BOTH  DIRECTIONS", subtitle="Defect orientation independence",
                takeaway="Each surface scanned twice — 10 passes total",
                accent=ACCENT3, duration=23f, concept="both_dir",
                cam = Orb(-90, 18, 0.50f, 24,  -90, 75, 0.45f, 26),
                subShots = new []
                {
                    Orb(-45, 8, 0.35f, 16,  -45, 5, 0.30f, 14),
                    Orb(-135, 8, 0.35f, 16,  -135, 5, 0.30f, 14),
                    Orb(-90, 70, 0.40f, 18,  -90, 80, 0.36f, 16),
                }
            },
            // 6 — Anatomy: HARD CUTS around the disk — narrator says "E·A·B·C·D"
            // and the camera jumps a full 72° between each zone so the viewer SEES
            // each zone at a distinct angle. Each cut frames its zone's ring with a
            // small radial focusOffset so the named ring sits dead-center.
            new EduScene{
                id="anatomy", title="ANATOMY  ·  5  ZONES", subtitle="E · A · B · C · D",
                takeaway="Five surfaces · NDIP Figure 2",
                accent=ACCENT, duration=12f, concept="zones",
                cam = Orb(-90, 80, 0.45f, 22,  -90, 30, 0.50f, 22),
                subShots = new []
                {
                    // E (outermost ring, r≈0.34): cam from south, looking N at zone E
                    Orb( -90, 14, 0.36f, 14,  -80, 12, 0.30f, 12,  new Vector3( 0.00f, 0,  0.18f)),
                    // A (r≈0.28): JUMP +72° to NE quadrant
                    Orb( -18, 16, 0.32f, 13,  -10, 14, 0.28f, 11,  new Vector3( 0.18f, 0,  0.05f)),
                    // B (r≈0.22): JUMP +72° to SE quadrant
                    Orb(  54, 18, 0.30f, 12,   62, 16, 0.26f, 10,  new Vector3( 0.11f, 0, -0.13f)),
                    // C (r≈0.16): JUMP +72° to SW quadrant
                    Orb( 126, 20, 0.28f, 11,  134, 18, 0.24f,  9,  new Vector3(-0.08f, 0, -0.10f)),
                    // D (innermost, r≈0.10): JUMP +72° to NW quadrant, super tight
                    Orb( 198, 22, 0.24f, 10,  206, 20, 0.20f,  8,  new Vector3(-0.08f, 0,  0.04f)),
                }
            },
            // 7 — 0.020 inch coverage: EXTREME macro on probe tip (was 10f, audio 20.1s)
            // focusOffset (0.22, 0, 0) targets the probe contact point so the
            // scan beam (anchored to probe at X=0.22) is dead-center in frame.
            // Without this, the beam was 22cm off-axis with only 3-6cm visible.
            new EduScene{
                id="coverage", title="THE  0.020  INCH  RULE", subtitle="Step less than half beam diameter",
                takeaway="0.020 step on 0.040 beam = full coverage",
                accent=ACCENT3, duration=21f, concept="coverage",
                cam = Orb(-50, 8, 0.28f, 14,  -45, 5, 0.22f, 10,  new Vector3(0.22f, 0, 0)),
            },
            // 8 — FSH: focus offset to the floating FSH gauge (was 12f, audio 24.6s)
            // FSH gauge is at world (0.55, 1.0, 0); scanCenter at (0, 0.252, 0)
            // → focusOffset (0.55, 0.748, 0) puts gauge dead-center in frame.
            new EduScene{
                id="fsh", title="FSH  ·  FULL  SCREEN  HEIGHT", subtitle="80% calibration · 20% report floor",
                takeaway="Relative, not absolute amplitude",
                accent=DANGER, duration=25f, concept="fsh",
                cam = Orb(80, 5, 0.55f, 22,  85, 3, 0.45f, 18,  new Vector3(0.55f, 0.748f, 0)),
            },
            // 9 — Calibration: FSH gauge close-up (was 12f, audio 24.8s)
            // FSH gauge at world (0.55, 1.0, 0); focusOffset (0.55, 0.55, 0)
            // frames it dead-center — same setup as scene 8. Beam is hidden
            // here because it can't be in frame with the gauge.
            new EduScene{
                id="calib", title="CALIBRATION  PHILOSOPHY", subtitle="FBH-1 → gain → 80% FSH",
                takeaway="Anchor every signal to a known reflector",
                accent=ACCENT2, duration=26f, concept="calib",
                cam = Orb(-60, 10, 0.50f, 22,  -55, 8, 0.40f, 18,  new Vector3(0.55f, 0.55f, 0)),
            },
            // 10 — Equipment build: medium reveal (was 8f, audio 8.6s)
            new EduScene{
                id="equipment", title="EQUIPMENT  BUILD", subtitle="Mount disk · Fill tank · 8 inch water path",
                takeaway="",
                accent=ACCENT, duration=9f, concept="equipment",
                cam = Orb(-110, 30, 0.85f, 30,  -90, 22, 0.65f, 24),
            },
            // 11 — Open scan plan: push to top-down reveal (was 8f, audio 8.4s)
            new EduScene{
                id="scanplan", title="OPEN  SCAN  PLAN", subtitle="Select V2500 Stage 1 preset",
                takeaway="5 zones loaded · NDIP-1226 Rev F",
                accent=ACCENT, duration=9f, concept="scanplan",
                cam = Orb(-90, 22, 0.65f, 24,  -90, 75, 0.50f, 22),
            },
            // 12 — Zone E +45 — quarter-orbit at scan level (was 12f, audio 14.0s)
            // focusOffset (0.22, 0, 0) frames the probe contact point so the
            // scan beam + arm are dead-center.
            new EduScene{
                id="zoneE_pos", title="ZONE  E  ·  +45  PASS", subtitle="Probe sweeps · 0.020 inch radial · 360 degrees",
                takeaway="Pass 1 of 10",
                accent=ACCENT2, duration=15f, concept="pass_positive",
                cam = Orb(-50, 8, 0.40f, 18,  40, 8, 0.40f, 18,  new Vector3(0.22f, 0, 0)),
            },
            // 13 — Zone E -45 — orbit back (focus on probe contact for beam visibility)
            new EduScene{
                id="zoneE_neg", title="ZONE  E  ·  -45  PASS", subtitle="Mirror reverses · Bidirectional coverage",
                takeaway="Pass 2 of 10  ·  Bidirectional",
                accent=PURPLE, duration=10f, concept="pass_negative",
                cam = Orb(40, 8, 0.40f, 18,  -50, 8, 0.40f, 18,  new Vector3(0.22f, 0, 0)),
            },
            // 14 — Zones A → D — HARD CUTS orbiting each zone 90° apart
            // Each cut frames the named zone's ring with a radial focusOffset so the
            // active ring sits centered. Narrator names A·B·C·D — camera lands on each.
            new EduScene{
                id="montage", title="ZONES  A  →  D", subtitle="Each surface ±45 · 10 passes total",
                takeaway="10 PASSES TOTAL",
                accent=ACCENT3, duration=12f, concept="montage",
                cam = Orb(-90, 12, 0.45f, 20,  90, 12, 0.45f, 20),
                subShots = new []
                {
                    // A (r≈0.28): cam at azimuth -45° (NE), looking AT zone A ring
                    Orb( -45, 10, 0.32f, 13,  -30,  8, 0.28f, 11,  new Vector3( 0.20f, 0,  0.20f)),
                    // B (r≈0.22): JUMP +90° to SE
                    Orb(  45, 12, 0.30f, 12,   60, 10, 0.26f, 10,  new Vector3( 0.16f, 0, -0.16f)),
                    // C (r≈0.16): JUMP +90° to SW
                    Orb( 135, 14, 0.28f, 11,  150, 12, 0.24f,  9,  new Vector3(-0.11f, 0, -0.11f)),
                    // D (r≈0.10, innermost): JUMP +90° to NW, super tight
                    Orb( 225, 16, 0.24f, 10,  240, 14, 0.20f,  8,  new Vector3(-0.07f, 0,  0.07f)),
                }
            },
            // 15 — A-scan vs C-scan (was 12f, audio 19.2s)
            // A-scan prop is at world (-0.6, 1.0, 0); scanCenter at (0, 0.252, 0)
            // → focusOffset (-0.6, 0.748, 0) frames the A-scan trace dead-center.
            new EduScene{
                id="ascan_cscan", title="A-SCAN  vs  C-SCAN", subtitle="Time-amplitude vs Position-peak",
                takeaway="A finds it. C tells you where it is.",
                accent=ACCENT, duration=20f, concept="ascan_cscan",
                cam = Orb(180, 10, 0.55f, 24,  180, 5, 0.45f, 20,  new Vector3(-0.6f, 0.748f, 0)),
            },
            // 16 — Live capture: SUPER macro on the probe contact (was 10f, audio 12.3s)
            // focusOffset (0.22, 0, 0) targets the probe so the beam + indication
            // glow (also placed at probe X) are dead-center in the tight FOV-9 frame.
            new EduScene{
                id="livescan", title="LIVE  C-SCAN  CAPTURE", subtitle="Peak per position · ≥20% FSH flagged",
                takeaway="0 indications",
                accent=DANGER, duration=13f, concept="live",
                cam = Orb(-50, 5, 0.25f, 12,  -45, 2, 0.20f, 9,  new Vector3(0.22f, 0, 0)),
            },
            // 17 — Results: narrator reads "Zone A: PASS · Zone B: PASS · Zone C: PASS
            // · Zone D: PASS". Camera HARD-CUTS to each zone in turn, then final
            // pull-back to the wide hero ACCEPT shot is the scene-end blend.
            new EduScene{
                id="results", title="INSPECTION  RESULTS", subtitle="5 zones · 10 passes · 0 indications",
                takeaway="ACCEPT",
                accent=ACCENT3, duration=10f, concept="results",
                cam = Orb(-90, 30, 0.30f, 18,  -90, 35, 0.70f, 26),
                subShots = new []
                {
                    // Zone A — NE, tight on outer ring (CurrentSubShotIndex=0 → highlights A in ZoneColors[1]? — anatomy uses E·A·B·C·D so idx 0=E. For results we want A first so use idx mapping)
                    // NOTE: zone-ring highlight uses CurrentSubShotIndex directly,
                    // so 4 sub-shots = idx 0..3 will light up E, A, B, C rings.
                    // To get A, B, C, D highlights we add a 5th shot up front mapping
                    // to E (skipped narratively) — simpler: 4 sub-shots, each ALSO
                    // names its zone via title overlays. The mapping idx→ring is
                    // E,A,B,C — which happens to MATCH "A→D" if we shift by 1.
                    // Simplest: use 5 sub-shots, first is a quick wide establishing,
                    // then 4 zone cuts.
                    Orb( -90, 30, 0.45f, 20,  -85, 28, 0.42f, 18,  Vector3.zero),                             // establishing wide (idx 0 → E ring glow as transition)
                    Orb( -45, 10, 0.32f, 13,  -30,  8, 0.28f, 11,  new Vector3( 0.20f, 0,  0.20f)),           // Zone A (idx 1 → A ring)
                    Orb(  45, 12, 0.30f, 12,   60, 10, 0.26f, 10,  new Vector3( 0.16f, 0, -0.16f)),           // Zone B (idx 2 → B ring)
                    Orb( 135, 14, 0.28f, 11,  150, 12, 0.24f,  9,  new Vector3(-0.11f, 0, -0.11f)),           // Zone C (idx 3 → C ring)
                    Orb( 225, 16, 0.24f, 10,  240, 14, 0.20f,  8,  new Vector3(-0.07f, 0,  0.07f)),           // Zone D (idx 4 → D ring)
                }
            },
            // 18 — Save: continue pull-back (was 6f, audio 6.4s)
            new EduScene{
                id="save", title="SAVE  THE  SCAN  DATA", subtitle="Part serial + date · Archive",
                takeaway="Traceable record",
                accent=ACCENT2, duration=7f, concept="save",
                cam = Orb(-90, 35, 0.70f, 26,  -90, 35, 0.95f, 32),
            },
            // 19 — Done: final wide hero shot
            new EduScene{
                id="done", title="INSPECTION  COMPLETE", subtitle="V2500 HPT Disk · Stage 1",
                takeaway="",
                accent=ACCENT3, duration=4f, concept="done",
                cam = Orb(-110, 35, 0.95f, 32,  -110, 38, 1.20f, 36),
            },
        };

        public static float StoryDurationSeconds
        {
            get
            {
                float total = 0f;
                for (int i = 0; i < Story.Length; i++)
                    total += Mathf.Max(0f, Story[i].duration);
                return total;
            }
        }

        // Runtime
        private int currentScene;
        private float sceneElapsed;
        private bool running;
        private ScanMasterCameraOrbit orbit;

        // Public state accessors (for MCP debugging)
        public int CurrentSceneIndex => currentScene;
        public float SceneElapsed => sceneElapsed;
        public bool IsRunning => running;
        public bool AutoAdvance => autoAdvance;
        public float GlobalSpeed => globalSpeed;
        // Index of the active sub-shot (for highlighting matching zone/feature)
        public int CurrentSubShotIndex { get; private set; } = -1;
        public int CurrentSubShotCount { get; private set; } = 0;

        // Audio narration — one AudioSource on the sequencer plays a different
        // MP3 per scene (loaded from Resources/Narration/<index>_<id>.mp3).
        private AudioSource narrationSource;
        private int lastNarrationScene = -1;

        // Maps scene index → Resource path under Resources/
        private static readonly string[] NarrationClipNames = {
            "Narration/01_title",
            "Narration/02_why_immersion",
            "Narration/03_water_path",
            "Narration/04_snell",
            "Narration/05_both_dir",
            "Narration/06_anatomy",
            "Narration/07_coverage",
            "Narration/08_fsh",
            "Narration/09_calib",
            "Narration/10_equipment",
            "Narration/11_scanplan",
            "Narration/12_zoneE_pos",
            "Narration/13_zoneE_neg",
            "Narration/14_montage",
            "Narration/15_ascan_cscan",
            "Narration/16_livescan",
            "Narration/17_results",
            "Narration/18_save",
            "Narration/19_done",
        };

        // Cached props
        private GameObject snellRoot;
        private GameObject zoneRingsRoot;
        private GameObject fshRoot;
        private GameObject ascanRoot;
        private GameObject bubbleSystemGO;
        private GameObject probeTrailGO;
        private GameObject indicationGlowGO;
        private GameObject scanBeamRoot;          // NEW — animated ultrasonic beam
        private GameObject impactRingsRoot;       // NEW — pulse rings on disk
        private GameObject scanTrailRoot;         // NEW — probe trail trace
        private float ascanTime;
        private float lastSceneChangeTime;
        // FIXED disk-center for camera orbital framing (cameras LookAt here).
        // Y=0.252 is verified from scene-file parent-chain walk:
        //   "P&W V2500-A5 0765 / Stage 1" world position = (0, 0.252, 0).
        // The disk sits on the Turntable (Y=0.08) which is on Tank Floor (Y=-0.04).
        // Water Surface above at Y=0.730.
        // NOTE: BuildZoneRings comment said "turntable y ≈ 0.4" — that was an
        // outdated estimate. Actual turntable is at Y=0.08.
        private Vector3 scanCenter = new Vector3(0f, 0.252f, 0f);
        // SEPARATE moving probe contact point for the scan-beam visualization
        // (follows probe X/Z, locked to disk surface Y).
        private const float VisualWaterPathMeters = 0.2032f; // 8 inches
        private Vector3 beamAnchor = new Vector3(0.22f, 0.252f, 0f);

        // GUI styles
        private GUIStyle titleStyle;
        private GUIStyle subtitleStyle;
        private GUIStyle takeawayStyle;
        private GUIStyle bigStyle;
        private GUIStyle smallStyle;
        private GUIStyle barStyle;
        private bool stylesReady;

        // --------------------------------------------------------------------
        private void Awake()
        {
            if (mainCam == null) mainCam = Camera.main;
            orbit = FindAnyObjectByType<ScanMasterCameraOrbit>();
            if (diskRoot == null)
                diskRoot = GameObject.Find("Turntable")?.transform;
            if (robotRoot == null)
                robotRoot = GameObject.Find("Scan Master Robot")?.transform;
            if (probeMount == null)
            {
                var pm = GameObject.Find("Probe Mount");
                if (pm != null) probeMount = pm.transform;
            }
            BuildProps();
            BuildNarrationSource();
        }

        // Crossfade between TWO AudioSources to eliminate the audio pop at every
        // scene transition. While source[active] plays, source[1-active] is silent
        // and ready. On scene-change we start the new clip on the inactive source
        // at vol=0, then ramp both over CrossfadeSeconds.
        private AudioSource narrationSourceB;
        private int activeNarrationIdx;          // 0 = narrationSource, 1 = narrationSourceB
        private float crossfadeTimer;            // seconds remaining in active fade
        private const float CrossfadeSeconds = 0.35f;

        private AudioSource ActiveNarration =>
            activeNarrationIdx == 0 ? narrationSource : narrationSourceB;
        private AudioSource InactiveNarration =>
            activeNarrationIdx == 0 ? narrationSourceB : narrationSource;

        private void BuildNarrationSource()
        {
            // Primary source
            narrationSource = gameObject.GetComponent<AudioSource>();
            if (narrationSource == null)
                narrationSource = gameObject.AddComponent<AudioSource>();
            narrationSource.playOnAwake = false;
            narrationSource.loop = false;
            narrationSource.spatialBlend = 0f;
            narrationSource.volume = 1.0f;
            narrationSource.priority = 0;

            // Secondary source for crossfade
            narrationSourceB = gameObject.AddComponent<AudioSource>();
            narrationSourceB.playOnAwake = false;
            narrationSourceB.loop = false;
            narrationSourceB.spatialBlend = 0f;
            narrationSourceB.volume = 0f;
            narrationSourceB.priority = 0;

            activeNarrationIdx = 0;
            crossfadeTimer = 0f;

            // NUKE every other narration GameObject so no rogue voice talks
            // over ours. The scene previously contained "English Training
            // Narration" / similar which auto-played its own AudioSource.
            string[] killTargets = {
                "English Training Narration",
                "Hebrew Training Narration",
                "Training Narration",
                "Narration",
                "Voice Over",
            };
            foreach (var name in killTargets)
            {
                var go = GameObject.Find(name);
                if (go != null && go != gameObject)
                    Destroy(go);
            }

            // Also defensively silence every OTHER AudioSource that may still be in scene.
            foreach (var src in FindObjectsByType<AudioSource>())
            {
                if (src == narrationSource || src == narrationSourceB) continue;
                src.Stop();
                src.mute = true;
                src.playOnAwake = false;
                src.enabled = false;
            }
        }

        private void PlayNarrationForScene(int sceneIdx)
        {
            if (narrationSource == null || narrationSourceB == null) return;
            if (sceneIdx < 0 || sceneIdx >= NarrationClipNames.Length) return;
            if (sceneIdx == lastNarrationScene) return;   // already playing
            lastNarrationScene = sceneIdx;
            var clip = Resources.Load<AudioClip>(NarrationClipNames[sceneIdx]);
            if (clip == null)
            {
                Debug.LogWarning($"Sequencer: narration clip missing for scene {sceneIdx}: {NarrationClipNames[sceneIdx]}");
                return;
            }

            // Defensive silence — every rogue AudioSource gets muted (but NOT our two)
            foreach (var src in FindObjectsByType<AudioSource>())
            {
                if (src == narrationSource || src == narrationSourceB) continue;
                if (src.isPlaying) src.Stop();
                src.mute = true;
            }

            // CROSSFADE: start new clip on the INACTIVE source at vol=0, then
            // UpdateNarrationCrossfade() (called every Update) ramps it up while
            // the old source fades down. No abrupt stop, no pop.
            var incoming = InactiveNarration;
            incoming.Stop();                    // safe — it's at vol 0 anyway
            incoming.clip = clip;
            incoming.volume = 0f;
            incoming.Play();

            // Flip active/inactive — old "active" is now the fading-out source
            activeNarrationIdx = 1 - activeNarrationIdx;
            crossfadeTimer = CrossfadeSeconds;

            Debug.Log($"♪ Narration crossfade -> scene {sceneIdx} ({NarrationClipNames[sceneIdx]}) — {clip.length:F1}s");
        }

        // Called once per frame from Update(). Lerps the two source volumes
        // toward their targets (active → 1, inactive → 0). Once the fade
        // completes the inactive source is stopped to free voice resources.
        private void UpdateNarrationCrossfade()
        {
            if (narrationSource == null || narrationSourceB == null) return;
            if (crossfadeTimer <= 0f)
            {
                // Steady state — make sure the inactive source is silent + stopped
                ActiveNarration.volume = 1f;
                if (InactiveNarration.volume > 0.001f || InactiveNarration.isPlaying)
                {
                    InactiveNarration.volume = 0f;
                    InactiveNarration.Stop();
                }
                return;
            }
            // Use wall-clock so we still fade smoothly when sequencer is paused
            float dt = Time.unscaledDeltaTime;
            crossfadeTimer -= dt;
            float t = Mathf.Clamp01(1f - crossfadeTimer / CrossfadeSeconds);
            // Equal-power crossfade (avoid mid-fade volume dip)
            float fadeIn  = Mathf.Sin(t * Mathf.PI * 0.5f);
            float fadeOut = Mathf.Cos(t * Mathf.PI * 0.5f);
            ActiveNarration.volume = fadeIn;
            InactiveNarration.volume = fadeOut;
            if (crossfadeTimer <= 0f)
            {
                InactiveNarration.Stop();
                InactiveNarration.volume = 0f;
            }
        }

        private void Start()
        {
            if (autoStart) Run();
        }

        // Wall-clock start of the CURRENT scene — set whenever scene advances.
        // Using realtimeSinceStartup means sceneElapsed is computed against
        // wall clock, not against Update()-delivered deltas — so it doesn't
        // freeze when Unity stalls on MCP requests / loses focus.
        private float currentSceneStartTime;

        public void Run()
        {
            // Force the game loop to keep ticking even when Editor loses focus
            Application.runInBackground = true;
            // A completed run disables auto-advance on the final scene. Reset it
            // here so repeated recordings in one Unity session always play the
            // full story instead of holding on the title scene.
            autoAdvance = true;

            // Disable orbit + training guide camera while we drive
            if (orbit == null) orbit = FindAnyObjectByType<ScanMasterCameraOrbit>();
            if (orbit != null) orbit.enabled = false;
            var guide = FindAnyObjectByType<ScanMasterTrainingGuide>();
            if (guide != null) guide.enabled = false;

            // Freeze the turntable so the disk stays still under the static zone
            // rings (rings are at world position, not parented to disk). Without
            // this the disk would spin at 2.5 rpm during ALL scenes — confusing
            // for educational close-ups where zone E/A/B/C/D need to line up
            // visually with the disk geometry.
            foreach (var tt in FindObjectsByType<ScanMasterTurntable>())
                tt.RotateWhenPlaying = false;

            // Hide the existing zone-surface overlays — we use our own flat
            // Edu_ZoneRings (LineRenderer circles) instead. Double-rendering
            // would create visual clutter (two zone visualizations stacked).
            foreach (var zo in FindObjectsByType<ScanMasterZoneSurfaceOverlay>())
                zo.SetVisible(false);

            // Pause the legacy ScanMasterSimulationController which auto-plays
            // a scan path moving the probe arm + trail when Play begins. We need
            // the probe to stay STATIC at its rest position so beamAnchor (which
            // reads probe.transform) stays put under our framed cameras. The
            // educational visualization simulates motion via beam pulse + impact
            // rings, not actual probe movement.
            foreach (var sc in FindObjectsByType<ScanMasterSimulationController>())
                sc.SetPlaying(false);

            // Hide the legacy bright-green scan path LineRenderers — they
            // pollute the camera frame with random neon strokes.
            HideLegacyScanPaths();

            running = true;
            currentScene = 0;
            sceneElapsed = 0f;
            currentSceneStartTime = RecordingMode ? Time.time : Time.realtimeSinceStartup;
            ApplyCamera(Story[0], 0f);
            lastNarrationScene = -1;
            PlayNarrationForScene(0);
        }

        private static readonly string[] LegacyNames = {
            "Bore Scan Path",
            "Planned Bore Scan Path",
            "Live Scan Trace",
            "Scanning Footprint Ring",
            "Ultrasonic Beam",          // green line on probe
            "Sound Entry Spot",         // green dot on disk
            "Synthetic Training Indication Marker",
            "Stage 1 Training Zone Guide",  // zone markers + labels (we have our own)
            "Stage 2 Training Zone Guide",
        };

        private void HideLegacyScanPaths()
        {
            // 1) Disable every legacy GameObject by name.
            foreach (var go in GameObject.FindObjectsByType<GameObject>())
            {
                for (int i = 0; i < LegacyNames.Length; i++)
                {
                    if (go.name == LegacyNames[i])
                    {
                        go.SetActive(false);
                        // Also nuke any Renderer + LineRenderer on it so the
                        // bright material can't ever paint a pixel even if
                        // something re-enables the GO behind our back.
                        foreach (var r in go.GetComponentsInChildren<Renderer>(true))
                            r.enabled = false;
                        break;
                    }
                }
            }

            // 2) Disable the LEGACY SCRIPT COMPONENTS that keep re-enabling those
            // objects every frame. Specifically ScanMasterProbeBeam re-enables
            // its sound-entry marker. So we just shut down the script.
            foreach (var beam in FindObjectsByType<ScanMasterProbeBeam>())
                beam.enabled = false;
            foreach (var sct in FindObjectsByType<ScanMasterScanCueMarker>())
                sct.enabled = false;
            foreach (var sp in FindObjectsByType<ScanMasterScanPath>())
                sp.enabled = false;
            foreach (var spv in FindObjectsByType<ScanMasterPathPreview>())
                spv.enabled = false;
            foreach (var st in FindObjectsByType<ScanMasterScanTrail>())
                st.enabled = false;
            foreach (var lb in FindObjectsByType<ScanMasterLinkBeam>())
                lb.enabled = false;
        }

        // Defensive: re-hide every frame so PartSelector / TrainingGuide can't
        // re-enable a legacy gizmo behind our back.
        private float lastLegacyCheck;
        private void EnforceLegacyHidden()
        {
            // Cheap, but no need to do it every frame — every 0.2s is plenty
            if (Time.realtimeSinceStartup - lastLegacyCheck < 0.2f) return;
            lastLegacyCheck = Time.realtimeSinceStartup;

            // Walk every gameobject — even DISABLED ones (includeInactive=true)
            foreach (var go in Resources.FindObjectsOfTypeAll<GameObject>())
            {
                if (go == null || go.hideFlags != HideFlags.None) continue;
                if (go.scene.IsValid() == false) continue;  // skip prefabs in project
                for (int i = 0; i < LegacyNames.Length; i++)
                {
                    if (go.name == LegacyNames[i])
                    {
                        if (go.activeSelf) go.SetActive(false);
                        foreach (var r in go.GetComponentsInChildren<Renderer>(true))
                            if (r.enabled) r.enabled = false;
                        break;
                    }
                }
            }
        }

        // --------------------------------------------------------------------
        private void Update()
        {
            // Hotkeys
            if (ScanMasterInput.GetKeyDown(KeyCode.N)) NextScene();
            if (ScanMasterInput.GetKeyDown(KeyCode.P)) PreviousScene();
            if (ScanMasterInput.GetKeyDown(KeyCode.R)) Run();
            if (ScanMasterInput.GetKeyDown(KeyCode.T)) autoAdvance = !autoAdvance;

            // Audio crossfade tick — runs every frame regardless of running state
            // so fades complete cleanly even on the final scene-out.
            UpdateNarrationCrossfade();

            if (!running) return;
            if (currentScene < 0 || currentScene >= Story.Length) return;

            // Pick clock based on mode:
            //   live   → realtimeSinceStartup (wall-clock; doesn't freeze)
            //   record → Time.time (Unity-scaled; deterministic with captureFramerate)
            float now = RecordingMode ? Time.time : Time.realtimeSinceStartup;
            sceneElapsed = (now - currentSceneStartTime)
                           * Mathf.Max(0.05f, globalSpeed);
            ascanTime = sceneElapsed;

            var scene = Story[currentScene];
            float u = Mathf.Clamp01(sceneElapsed / Mathf.Max(0.1f, scene.duration));
            UpdateProps(scene, u);
            UpdateIndicationGlow();
            EnforceLegacyHidden();

            if (autoAdvance && sceneElapsed >= scene.duration)
                NextScene();
        }

        // Camera is driven in LateUpdate so we run AFTER ScanMasterCameraOrbit's
        // LateUpdate (and the TrainingGuide) — they no longer get to overwrite us.
        private void LateUpdate()
        {
            if (!running) return;
            if (currentScene < 0 || currentScene >= Story.Length) return;

            // Defensive: keep orbit + training guide camera updates off
            if (orbit == null) orbit = FindAnyObjectByType<ScanMasterCameraOrbit>();
            if (orbit != null && orbit.enabled) orbit.enabled = false;

            var scene = Story[currentScene];
            float u = Mathf.Clamp01(sceneElapsed / Mathf.Max(0.1f, scene.duration));
            ApplyCamera(scene, u);
            // Re-enforce legacy hiding AFTER PartSelector / SimulationController updates
            EnforceLegacyHidden();
        }

        private void NextScene()
        {
            // CRITICAL: do NOT wrap around — when the story ends (e.g. during
            // a recording with extra tail time), STAY on the final hero scene
            // so the recording captures a clean wide hold instead of restarting
            // the title sequence at second 289+.
            if (currentScene >= Story.Length - 1)
            {
                // Clamp to last scene and stop auto-advancing
                currentScene = Story.Length - 1;
                autoAdvance = false;
                // Keep sceneElapsed pinned at duration so progress bar stays full
                sceneElapsed = Story[currentScene].duration;
                return;
            }
            currentScene = currentScene + 1;
            sceneElapsed = 0f;
            ascanTime = 0f;
            currentSceneStartTime = RecordingMode ? Time.time : Time.realtimeSinceStartup;
            lastSceneChangeTime = Time.unscaledTime;
            HideAllProps();
            PlayNarrationForScene(currentScene);
        }

        private void PreviousScene()
        {
            currentScene = (currentScene - 1 + Story.Length) % Story.Length;
            sceneElapsed = 0f;
            currentSceneStartTime = RecordingMode ? Time.time : Time.realtimeSinceStartup;
            lastSceneChangeTime = Time.unscaledTime;
            HideAllProps();
            PlayNarrationForScene(currentScene);
        }

        // --------------------------------------------------------------------
        private void ApplyCamera(EduScene scene, float u)
        {
            if (mainCam == null) return;

            CamShot shot;
            float subU;

            // RAPID-CUT mode: if subShots is set, pick one based on u, blend within it
            if (scene.subShots != null && scene.subShots.Length > 0)
            {
                int n = scene.subShots.Length;
                int idx = Mathf.Clamp(Mathf.FloorToInt(u * n), 0, n - 1);
                shot = scene.subShots[idx];
                subU = (u * n) - idx;
                CurrentSubShotIndex = idx;
                CurrentSubShotCount = n;
            }
            else
            {
                shot = scene.cam;
                subU = u;
                CurrentSubShotIndex = -1;
                CurrentSubShotCount = 0;
            }

            float e = EaseInOutCubic(Mathf.Clamp01(subU));
            float az = Mathf.LerpAngle(shot.startAzimuth, shot.endAzimuth, e);
            float el = Mathf.Lerp(shot.startElevation, shot.endElevation, e);
            float di = Mathf.Lerp(shot.startDistance, shot.endDistance, e);
            float fov = Mathf.Lerp(shot.startFov, shot.endFov, e);

            // Convert orbital → world position
            float azRad = az * Mathf.Deg2Rad;
            float elRad = el * Mathf.Deg2Rad;
            Vector3 target = scanCenter + shot.focusOffset;
            Vector3 dir = new Vector3(
                Mathf.Cos(elRad) * Mathf.Cos(azRad),
                Mathf.Sin(elRad),
                Mathf.Cos(elRad) * Mathf.Sin(azRad));
            Vector3 pos = target + dir * di;

            // Subtle handheld micro-shake
            float t = Time.unscaledTime;
            pos += new Vector3(
                Mathf.Sin(t * 0.7f) * 0.004f,
                Mathf.Sin(t * 1.1f) * 0.003f,
                Mathf.Sin(t * 0.5f) * 0.003f);

            mainCam.transform.position = pos;
            mainCam.transform.LookAt(target, Vector3.up);
            mainCam.fieldOfView = fov;
            // CRITICAL: shrink the near clip plane so super-macro shots (dist
            // ~0.20m) don't clip the disk surface. Unity default is 0.3m which
            // would CULL anything closer — including the disk in scene 16!
            // Set it to 5% of distance, clamped between 0.005m and 0.05m.
            mainCam.nearClipPlane = Mathf.Clamp(di * 0.05f, 0.005f, 0.05f);
        }

        static float EaseInOutCubic(float t)
        {
            return t < 0.5f ? 4f * t * t * t : 1f - Mathf.Pow(-2f * t + 2f, 3f) / 2f;
        }

        // --------------------------------------------------------------------
        // 3D props
        // --------------------------------------------------------------------
        private void BuildProps()
        {
            // Locate probe so beamAnchor is accurate. scanCenter stays FIXED
            // at disk center (Y=0.252) for camera framing.
            var probe = GameObject.Find("Probe Mount");
            if (probe != null)
            {
                beamAnchor = new Vector3(probe.transform.position.x, 0.252f, probe.transform.position.z);
            }

            BuildSnellProp();
            BuildZoneRings();
            BuildFshProp();
            BuildAscanProp();
            BuildBubbleSystem();
            BuildIndicationGlow();
            BuildScanBeam();
            BuildImpactRings();
            BuildScanTrail();
            HideAllProps();
        }

        private void HideAllProps()
        {
            if (snellRoot != null) snellRoot.SetActive(false);
            if (zoneRingsRoot != null) zoneRingsRoot.SetActive(false);
            if (fshRoot != null) fshRoot.SetActive(false);
            if (ascanRoot != null) ascanRoot.SetActive(false);
            if (bubbleSystemGO != null) bubbleSystemGO.SetActive(false);
            if (indicationGlowGO != null) indicationGlowGO.SetActive(false);
            if (scanBeamRoot != null) scanBeamRoot.SetActive(false);
            if (impactRingsRoot != null) impactRingsRoot.SetActive(false);
            if (scanTrailRoot != null) scanTrailRoot.SetActive(false);
        }

        // Cached MeshRenderers for ALL scanner gantry pieces — bridge, column,
        // tracks, carriage, slide, ram, mount, articulated arm. We toggle these
        // per-scene without changing GameObject.active so beamAnchor still works
        // and any audio/physics on those GOs keeps running.
        private MeshRenderer[] scannerArmRenderers;

        // Names of every scanner-gantry piece in the scene hierarchy. Found by
        // substring match on GameObject name. Disk objects (V2500/0765/0784)
        // and tank pieces are intentionally NOT in this list.
        private static readonly string[] ScannerNames = {
            "Bridge Rail", "Column", "Linear Track", "Carriage",
            "Cross Slide", "Z Ram", "Probe Mount", "Articulated",
        };

        // Hide the entire scanner gantry in scenes where it would block the
        // camera's view of the disk zones (educational close-ups). Show it
        // during equipment/scan scenes where the gantry IS the subject.
        private void SetProbeArmVisible(bool visible)
        {
            if (scannerArmRenderers == null)
            {
                // First call: scan whole scene once for all gantry pieces
                var list = new System.Collections.Generic.List<MeshRenderer>();
                foreach (var mr in FindObjectsByType<MeshRenderer>())
                {
                    if (mr == null || mr.gameObject == null) continue;
                    // Match the GO itself OR any of its ancestors so we catch
                    // child meshes of a "Probe Mount" parent etc.
                    var t = mr.transform;
                    bool isScanner = false;
                    while (t != null && !isScanner)
                    {
                        string n = t.name;
                        for (int i = 0; i < ScannerNames.Length; i++)
                        {
                            if (n.Contains(ScannerNames[i])) { isScanner = true; break; }
                        }
                        t = t.parent;
                    }
                    if (isScanner) list.Add(mr);
                }
                scannerArmRenderers = list.ToArray();
            }
            for (int i = 0; i < scannerArmRenderers.Length; i++)
            {
                if (scannerArmRenderers[i] != null) scannerArmRenderers[i].enabled = visible;
            }
        }

        private void UpdateProps(EduScene scene, float u)
        {
            // Hide probe arm in zone-focused educational scenes where it would
            // occlude the disk (anatomy, montage, results, snell, fsh, coverage,
            // calib, ascan_cscan). Show it for equipment/scan scenes where the
            // arm IS what we want to see.
            bool armBlocksView = scene.concept == "zones"
                              || scene.concept == "anatomy"
                              || scene.concept == "montage"
                              || scene.concept == "results"
                              || scene.concept == "snell"
                              || scene.concept == "fsh"
                              || scene.concept == "calib"
                              || scene.concept == "coverage"
                              || scene.concept == "ascan_cscan"
                              || scene.concept == "both_dir"
                              || scene.concept == "scanplan";
            SetProbeArmVisible(!armBlocksView);

            // ALWAYS-ON scan beam + impact rings during ACTUAL-scan scenes.
            // NOTE: "montage" is excluded — it's a conceptual A→D zone tour
            // with hard cuts; the beam (anchored to probe X=0.22) doesn't move
            // when the camera cuts to different zones, so showing it during
            // montage would be confusing (probe appears stuck in one zone).
            bool isRealScan = scene.concept == "live"
                           || scene.concept == "pass_positive"
                           || scene.concept == "pass_negative"
                           || scene.concept == "coverage"
                           || scene.concept == "water_path";
            if (isRealScan)
            {
                if (scanBeamRoot != null) { scanBeamRoot.SetActive(true); AnimateScanBeam(u); }
                if (impactRingsRoot != null) { impactRingsRoot.SetActive(true); AnimateImpactRings(u); }
                // Trail only on the pass scenes (12/13). Trail diameter is 16cm
                // which fits scenes 12/13's 22.5cm frame, but would extend off
                // the super-macro frames in scene 16 (5.6cm wide) and montage.
                if (scanTrailRoot != null && (scene.concept == "pass_positive" || scene.concept == "pass_negative"))
                { scanTrailRoot.SetActive(true); AnimateScanTrail(u); }
                if (bubbleSystemGO != null) bubbleSystemGO.SetActive(true);
            }

            switch (scene.concept)
            {
                case "snell":
                    if (snellRoot != null) { snellRoot.SetActive(true); AnimateSnell(u); }
                    break;
                case "fsh":
                case "calib":
                    if (fshRoot != null) { fshRoot.SetActive(true); AnimateFsh(scene.concept, u); }
                    // Beam intentionally NOT shown in calib — camera frames the
                    // FSH gauge (offset +0.55 from disk center) where the beam
                    // (at probe X=0.22) would be 33cm off-axis = out of frame.
                    break;
                case "zones":
                case "anatomy":
                case "both_dir":
                    if (zoneRingsRoot != null) { zoneRingsRoot.SetActive(true); AnimateZoneRings(u); }
                    break;
                case "montage":
                    if (zoneRingsRoot != null) { zoneRingsRoot.SetActive(true); AnimateZoneRings(u); }
                    break;
                case "ascan_cscan":
                case "live":
                    if (ascanRoot != null) { ascanRoot.SetActive(true); AnimateAscan(u); }
                    if (scene.concept == "live")
                    {
                        if (indicationGlowGO != null && u > 0.4f) indicationGlowGO.SetActive(true);
                    }
                    break;
                case "equipment":
                    if (bubbleSystemGO != null) bubbleSystemGO.SetActive(true);
                    break;
                case "results":
                    if (zoneRingsRoot != null) { zoneRingsRoot.SetActive(true); AnimateZoneRings(u); }
                    if (indicationGlowGO != null) indicationGlowGO.SetActive(false);
                    break;
                case "scanplan":
                    // Narrator says "5 zones loaded" — zones materialize on disk.
                    // First half cycles activeIdx 0→4 (zones load one by one),
                    // second half all glow steady-bright.
                    if (zoneRingsRoot != null)
                    {
                        zoneRingsRoot.SetActive(true);
                        AnimateZoneRings(u);
                    }
                    break;
                case "save":
                    // Show all 5 zone rings calmly lit (data captured for all zones)
                    if (zoneRingsRoot != null)
                    {
                        zoneRingsRoot.SetActive(true);
                        AnimateZoneRings(u);
                    }
                    break;
                case "done":
                    // Final hero — all 5 zone rings glow bright, no indications
                    if (zoneRingsRoot != null)
                    {
                        zoneRingsRoot.SetActive(true);
                        AnimateZoneRings(u);
                    }
                    if (indicationGlowGO != null) indicationGlowGO.SetActive(false);
                    break;
                case "why_immersion":
                    // Narrator: "Water = repeatable couplant". Show bubbling
                    // water + the Snell beam diagram to teach why water matters.
                    if (bubbleSystemGO != null) bubbleSystemGO.SetActive(true);
                    if (snellRoot != null) { snellRoot.SetActive(true); AnimateSnell(u); }
                    break;
            }
        }

        // ---------- Snell beam (water/steel boundary, 18.9° → 45°) ----------
        // Position the diagram's interface line EXACTLY at the disk surface
        // (Y=0.252) so the water-above / steel-below visualization physically
        // matches the actual scene: water above the disk, steel = the disk.
        // Was at Y=0.4 — 15cm above the disk surface, conceptually detached.
        private void BuildSnellProp()
        {
            snellRoot = new GameObject("Edu_Snell");
            snellRoot.transform.position = new Vector3(0, 0.252f, 0);

            // Water plane (above)
            var water = GameObject.CreatePrimitive(PrimitiveType.Cube);
            water.name = "Edu_Snell_WaterRegion";
            water.transform.SetParent(snellRoot.transform);
            water.transform.localPosition = new Vector3(0, 0.20f, 0);
            water.transform.localScale = new Vector3(0.8f, 0.40f, 0.001f);
            var wm = new Material(Shader.Find("Standard"))
            { color = new Color(0, 0.5f, 1f, 0.18f) };
            SetTransparent(wm);
            water.GetComponent<MeshRenderer>().sharedMaterial = wm;
            DestroyImmediate(water.GetComponent<BoxCollider>());

            // Steel plane (below)
            var steel = GameObject.CreatePrimitive(PrimitiveType.Cube);
            steel.name = "Edu_Snell_SteelRegion";
            steel.transform.SetParent(snellRoot.transform);
            steel.transform.localPosition = new Vector3(0, -0.20f, 0);
            steel.transform.localScale = new Vector3(0.8f, 0.40f, 0.001f);
            var sm = new Material(Shader.Find("Standard"))
            { color = new Color(0.5f, 0.55f, 0.65f, 0.5f) };
            SetTransparent(sm);
            steel.GetComponent<MeshRenderer>().sharedMaterial = sm;
            DestroyImmediate(steel.GetComponent<BoxCollider>());

            // Interface line (gold)
            var iface = GameObject.CreatePrimitive(PrimitiveType.Cube);
            iface.name = "Edu_Snell_Interface";
            iface.transform.SetParent(snellRoot.transform);
            iface.transform.localPosition = Vector3.zero;
            iface.transform.localScale = new Vector3(0.82f, 0.008f, 0.002f);
            var imat = new Material(Shader.Find("Standard")) { color = ACCENT2 };
            imat.EnableKeyword("_EMISSION");
            imat.SetColor("_EmissionColor", ACCENT2 * 0.8f);
            iface.GetComponent<MeshRenderer>().sharedMaterial = imat;
            DestroyImmediate(iface.GetComponent<BoxCollider>());

            // Incident beam (cyan)
            CreateLineSegment("Edu_Snell_Incident", snellRoot.transform,
                new Vector3(-0.15f, 0.45f, 0), new Vector3(0, 0, 0),
                width: 0.012f, color: ACCENT);

            // Refracted beam (pink), at 45° down-right
            CreateLineSegment("Edu_Snell_Refracted", snellRoot.transform,
                new Vector3(0, 0, 0), new Vector3(0.30f, -0.30f, 0),
                width: 0.014f, color: DANGER);

            // Normal line (dim)
            CreateLineSegment("Edu_Snell_Normal", snellRoot.transform,
                new Vector3(0, -0.40f, 0), new Vector3(0, 0.40f, 0),
                width: 0.004f, color: new Color(0.6f, 0.65f, 0.78f));
        }

        private void AnimateSnell(float u)
        {
            // Pulse the refracted beam to draw attention + grow it in over time
            var refracted = snellRoot.transform.Find("Edu_Snell_Refracted");
            if (refracted != null)
            {
                var lr = refracted.GetComponent<LineRenderer>();
                float pulse = 0.8f + Mathf.Sin(Time.unscaledTime * 5f) * 0.2f;
                if (lr != null)
                {
                    lr.startColor = DANGER * pulse;
                    lr.endColor = DANGER * pulse;
                    // Beam grows from interface point into steel between u=0.25..0.65
                    float grow = Mathf.Clamp01((u - 0.25f) / 0.40f);
                    var end = Vector3.Lerp(Vector3.zero, new Vector3(0.30f, -0.30f, 0), grow);
                    lr.SetPosition(1, end);
                }
            }

            // Wave packet — a small bright dot travels along incident → interface → refracted
            var pkt = snellRoot.transform.Find("Edu_Snell_WavePacket");
            if (pkt == null)
            {
                var w = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                w.name = "Edu_Snell_WavePacket";
                w.transform.SetParent(snellRoot.transform);
                w.transform.localScale = Vector3.one * 0.020f;
                DestroyImmediate(w.GetComponent<SphereCollider>());
                var m = new Material(Shader.Find("Standard")) { color = ACCENT };
                m.EnableKeyword("_EMISSION");
                m.SetColor("_EmissionColor", ACCENT * 3.5f);
                w.GetComponent<MeshRenderer>().sharedMaterial = m;
                pkt = w.transform;
            }
            float pktU = (Time.unscaledTime * 0.55f) % 1f;
            Vector3 incStart = new Vector3(-0.15f, 0.45f, 0);
            Vector3 interfacePt = Vector3.zero;
            Vector3 refractEnd = new Vector3(0.30f, -0.30f, 0);
            var rend = pkt.GetComponent<MeshRenderer>();
            if (pktU < 0.5f)
            {
                pkt.localPosition = Vector3.Lerp(incStart, interfacePt, pktU / 0.5f);
                if (rend != null)
                {
                    rend.sharedMaterial.color = ACCENT;
                    rend.sharedMaterial.SetColor("_EmissionColor", ACCENT * 3.5f);
                }
            }
            else
            {
                pkt.localPosition = Vector3.Lerp(interfacePt, refractEnd, (pktU - 0.5f) / 0.5f);
                if (rend != null)
                {
                    rend.sharedMaterial.color = DANGER;
                    rend.sharedMaterial.SetColor("_EmissionColor", DANGER * 3.5f);
                }
            }

            // Flash the interface line when the packet crosses
            var iface = snellRoot.transform.Find("Edu_Snell_Interface");
            if (iface != null && pktU > 0.48f && pktU < 0.55f)
            {
                var mr = iface.GetComponent<MeshRenderer>();
                if (mr != null) mr.sharedMaterial.SetColor("_EmissionColor", ACCENT2 * 4.5f);
            }
            else if (iface != null)
            {
                var mr = iface.GetComponent<MeshRenderer>();
                if (mr != null) mr.sharedMaterial.SetColor("_EmissionColor", ACCENT2 * 0.8f);
            }
        }

        // ---------- Zone rings (5 colored rings on disk top) ----------
        private void BuildZoneRings()
        {
            zoneRingsRoot = new GameObject("Edu_ZoneRings");
            // Position on top of the disk. Disk world Y verified as 0.252 from
            // scene-file parent chain ("P&W V2500-A5 0765 / Stage 1" world pos).
            // Place rings 3mm above disk top so they don't z-fight the mesh.
            zoneRingsRoot.transform.position = new Vector3(0, 0.255f, 0);

            // 5 rings: E (pink) outermost → D (purple) innermost
            Color[] colors = { DANGER, ACCENT2, ACCENT3, ACCENT, PURPLE };
            float[] radii  = {  0.34f,    0.28f,   0.22f,  0.16f, 0.10f };
            string[] labels = { "E", "A", "B", "C", "D" };
            for (int i = 0; i < 5; i++)
            {
                CreateRing("Edu_Ring_" + labels[i], zoneRingsRoot.transform,
                    radii[i], 0.016f, colors[i]);
            }
        }

        private void AnimateZoneRings(float u)
        {
            // Choose active zone:
            //   - If sub-shots active (rapid cuts), index = current sub-shot
            //   - Otherwise spread across scene time
            int activeIdx;
            if (CurrentSubShotIndex >= 0 && CurrentSubShotCount > 0)
                activeIdx = Mathf.Clamp(CurrentSubShotIndex, 0, 4);
            else
                activeIdx = Mathf.Clamp((int)(u * 5f), 0, 4);

            float pulse = 1f + Mathf.Sin(Time.unscaledTime * 6f) * 0.35f;

            // Spawn / refresh the active zone's halo + scan sweep
            EnsureActiveZoneVfx(activeIdx, pulse);

            // Base colors must match BuildZoneRings order: E, A, B, C, D
            Color[] zoneCols = { DANGER, ACCENT2, ACCENT3, ACCENT, PURPLE };

            for (int i = 0; i < zoneRingsRoot.transform.childCount; i++)
            {
                var t = zoneRingsRoot.transform.GetChild(i);
                var lr = t.GetComponent<LineRenderer>();
                if (lr == null || i >= zoneCols.Length) continue;
                Color baseCol = zoneCols[i];
                Color active = baseCol * (2.8f * pulse);   // 3x brighter when active
                Color dim    = baseCol * 0.25f;            // very dim when inactive
                Color c = (i == activeIdx) ? active : dim;
                lr.startColor = c;
                lr.endColor   = c;
                lr.widthMultiplier = (i == activeIdx) ? (1.6f + Mathf.Sin(Time.unscaledTime * 6f) * 0.4f) : 0.5f;
            }
        }

        // ----- Active-zone HALO + SCAN SWEEP -----
        // For the currently spotlighted zone we spawn (or move) an extra
        // halo ring + a rotating "scan sweep" laser line that visually
        // says "THIS is the zone we're talking about right now".
        private GameObject activeZoneHalo;        // bright outer halo ring
        private GameObject activeZoneSweep;       // rotating scan-sweep line
        private int activeZoneVfxIdx = -1;

        private static readonly float[] ZoneRadii = { 0.34f, 0.28f, 0.22f, 0.16f, 0.10f };
        private static readonly Color[] ZoneColors = {
            new Color(1f, 0.302f, 0.427f),  // E
            new Color(1f, 0.80f, 0f),       // A
            new Color(0f, 1f, 0.533f),      // B
            new Color(0f, 0.898f, 1f),      // C
            new Color(1f, 0f, 1f),          // D
        };

        private void EnsureActiveZoneVfx(int zoneIdx, float pulse)
        {
            if (zoneIdx < 0 || zoneIdx >= ZoneRadii.Length) return;
            float radius = ZoneRadii[zoneIdx];
            Color col = ZoneColors[zoneIdx];

            // ---- HALO: bright ring sitting OUTSIDE the active zone ring
            if (activeZoneHalo == null)
            {
                activeZoneHalo = new GameObject("Edu_ActiveHalo");
                activeZoneHalo.transform.SetParent(zoneRingsRoot.transform);
                activeZoneHalo.transform.localPosition = Vector3.zero;
                var lr = activeZoneHalo.AddComponent<LineRenderer>();
                lr.material = new Material(Shader.Find("Sprites/Default"));
                lr.useWorldSpace = false;
                const int steps = 96;
                lr.positionCount = steps + 1;
            }
            if (activeZoneVfxIdx != zoneIdx)
            {
                activeZoneVfxIdx = zoneIdx;
                // Rebuild halo ring at new radius (slightly larger than zone ring)
                var lr = activeZoneHalo.GetComponent<LineRenderer>();
                const int steps = 96;
                float r = radius + 0.012f;
                for (int j = 0; j <= steps; j++)
                {
                    float a = j / (float)steps * Mathf.PI * 2f;
                    lr.SetPosition(j, new Vector3(Mathf.Cos(a) * r, 0, Mathf.Sin(a) * r));
                }
            }
            // Pulse halo
            var halo = activeZoneHalo.GetComponent<LineRenderer>();
            halo.startColor = col * (1.5f * pulse);
            halo.endColor   = col * (1.5f * pulse);
            halo.widthMultiplier = 0.008f + Mathf.Sin(Time.unscaledTime * 4f) * 0.004f;

            // ---- SCAN SWEEP: rotating radial line
            if (activeZoneSweep == null)
            {
                activeZoneSweep = new GameObject("Edu_ActiveSweep");
                activeZoneSweep.transform.SetParent(zoneRingsRoot.transform);
                activeZoneSweep.transform.localPosition = new Vector3(0, 0.001f, 0);
                var lr = activeZoneSweep.AddComponent<LineRenderer>();
                lr.material = new Material(Shader.Find("Sprites/Default"));
                lr.useWorldSpace = false;
                lr.positionCount = 2;
                lr.startWidth = 0.0025f;
                lr.endWidth = 0.012f;
            }
            var sweep = activeZoneSweep.GetComponent<LineRenderer>();
            float sweepAng = Time.unscaledTime * 1.4f;     // rotates 1.4 rad/s
            float r0 = 0.01f;
            float r1 = radius + 0.020f;
            sweep.SetPosition(0, new Vector3(Mathf.Cos(sweepAng) * r0, 0, Mathf.Sin(sweepAng) * r0));
            sweep.SetPosition(1, new Vector3(Mathf.Cos(sweepAng) * r1, 0, Mathf.Sin(sweepAng) * r1));
            Color sweepCol = col;
            sweepCol.a = 1f;
            sweep.startColor = new Color(sweepCol.r, sweepCol.g, sweepCol.b, 0.2f);
            sweep.endColor   = new Color(sweepCol.r * 3f, sweepCol.g * 3f, sweepCol.b * 3f, 1f);
        }

        // ---------- FSH gauge (vertical bar with 20% / 80% markers) ----------
        private void BuildFshProp()
        {
            fshRoot = new GameObject("Edu_FSH");
            // Float above the disk on the right side
            fshRoot.transform.position = new Vector3(0.55f, 1.0f, 0);

            var bg = GameObject.CreatePrimitive(PrimitiveType.Cube);
            bg.name = "Edu_FSH_BG";
            bg.transform.SetParent(fshRoot.transform);
            bg.transform.localPosition = Vector3.zero;
            bg.transform.localScale = new Vector3(0.12f, 0.50f, 0.005f);
            var bgmat = new Material(Shader.Find("Standard"))
            { color = new Color(0.04f, 0.06f, 0.10f, 1f) };
            bg.GetComponent<MeshRenderer>().sharedMaterial = bgmat;
            DestroyImmediate(bg.GetComponent<BoxCollider>());

            // 20% threshold (red)
            CreateMarker(fshRoot.transform, new Vector3(0, -0.20f, 0), 0.14f, DANGER, "Edu_FSH_20");
            // 80% reference (yellow)
            CreateMarker(fshRoot.transform, new Vector3(0, +0.20f, 0), 0.14f, ACCENT2, "Edu_FSH_80");

            // Animated fill (will be resized in animate)
            var fill = GameObject.CreatePrimitive(PrimitiveType.Cube);
            fill.name = "Edu_FSH_Fill";
            fill.transform.SetParent(fshRoot.transform);
            fill.transform.localScale = new Vector3(0.10f, 0.001f, 0.006f);
            var fm = new Material(Shader.Find("Standard"))
            { color = ACCENT };
            fm.EnableKeyword("_EMISSION");
            fm.SetColor("_EmissionColor", ACCENT * 0.7f);
            fill.GetComponent<MeshRenderer>().sharedMaterial = fm;
            DestroyImmediate(fill.GetComponent<BoxCollider>());
        }

        private void AnimateFsh(string concept, float u)
        {
            var fill = fshRoot.transform.Find("Edu_FSH_Fill");
            if (fill == null) return;
            // FSH: noise floor → rises to 80%
            float target;
            if (concept == "fsh")
            {
                // Bouncy needle going 30% → 80%
                target = Mathf.Lerp(0.30f, 0.80f, EaseInOutCubic(u));
                target += Mathf.Sin(Time.unscaledTime * 8f) * 0.02f;
            }
            else
            {
                // calibration: rises to 80% and locks
                target = 0.30f + Mathf.Min(0.50f, EaseInOutCubic(u) * 0.55f);
            }
            // Position fill from bottom up
            float bottom = -0.25f;
            float top = bottom + target * 0.50f;
            float h = top - bottom;
            fill.localScale = new Vector3(0.10f, h, 0.006f);
            fill.localPosition = new Vector3(0, (top + bottom) * 0.5f, 0);

            // Color shifts to green when over 20%, yellow over 80%
            var mr = fill.GetComponent<MeshRenderer>();
            Color c = (target > 0.78f) ? ACCENT2 : (target > 0.20f) ? ACCENT3 : ACCENT;
            mr.sharedMaterial.color = c;
            mr.sharedMaterial.SetColor("_EmissionColor", c * 0.8f);
        }

        // ---------- A-scan waveform ----------
        private void BuildAscanProp()
        {
            ascanRoot = new GameObject("Edu_Ascan");
            ascanRoot.transform.position = new Vector3(-0.6f, 1.0f, 0);

            var bg = GameObject.CreatePrimitive(PrimitiveType.Cube);
            bg.name = "Edu_Ascan_BG";
            bg.transform.SetParent(ascanRoot.transform);
            bg.transform.localScale = new Vector3(0.45f, 0.18f, 0.005f);
            var bgmat = new Material(Shader.Find("Standard"))
            { color = new Color(0.05f, 0.07f, 0.10f, 1f) };
            bg.GetComponent<MeshRenderer>().sharedMaterial = bgmat;
            DestroyImmediate(bg.GetComponent<BoxCollider>());

            // The trace will be a LineRenderer with many points
            var trace = new GameObject("Edu_Ascan_Trace");
            trace.transform.SetParent(ascanRoot.transform);
            trace.transform.localPosition = Vector3.zero;
            var lr = trace.AddComponent<LineRenderer>();
            lr.material = new Material(Shader.Find("Sprites/Default"));
            lr.startColor = ACCENT;
            lr.endColor = ACCENT;
            lr.startWidth = 0.004f;
            lr.endWidth = 0.004f;
            lr.useWorldSpace = false;
            lr.positionCount = 80;
        }

        private void AnimateAscan(float u)
        {
            var trace = ascanRoot.transform.Find("Edu_Ascan_Trace");
            if (trace == null) return;
            var lr = trace.GetComponent<LineRenderer>();
            if (lr == null) return;
            int n = lr.positionCount;
            var pts = new Vector3[n];
            float t = Time.unscaledTime;
            for (int i = 0; i < n; i++)
            {
                float rel = i / (float)(n - 1);
                float x = (rel - 0.5f) * 0.40f;
                // Background noise + 1 peak around rel=0.6
                float noise = Mathf.Sin(rel * 31f + t * 3f) * 0.005f
                            + Mathf.Cos(rel * 19f + t * 1.6f) * 0.004f;
                float peak = Mathf.Exp(-Mathf.Pow((rel - 0.60f) * 12f, 2)) * 0.07f;
                float y = noise + peak;
                pts[i] = new Vector3(x, y, -0.01f);
            }
            lr.SetPositions(pts);
        }

        // ---------- Particle bubbles in water (probe scanning effect) ----------
        private void BuildBubbleSystem()
        {
            bubbleSystemGO = new GameObject("Edu_Bubbles");
            // Spawn slightly above the disk top (Y=0.252), inside the water column.
            // Bubbles rise from there toward the water surface (Y=0.73).
            bubbleSystemGO.transform.position = new Vector3(0, 0.30f, 0);

            var ps = bubbleSystemGO.AddComponent<ParticleSystem>();
            // Stop the auto-started system before we mutate `main` — Unity errors
            // out if `duration` is set while the system is still playing.
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);

            var main = ps.main;
            main.duration = 100f;
            main.loop = true;
            main.startLifetime = new ParticleSystem.MinMaxCurve(2.5f, 4.5f);
            main.startSpeed = new ParticleSystem.MinMaxCurve(0.06f, 0.18f);
            main.startSize = new ParticleSystem.MinMaxCurve(0.008f, 0.025f);
            main.startColor = new Color(0.7f, 0.9f, 1f, 0.6f);
            main.maxParticles = 200;
            main.simulationSpace = ParticleSystemSimulationSpace.World;

            var emission = ps.emission;
            emission.rateOverTime = 25f;

            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(0.45f, 0.05f, 0.45f);

            var col = ps.colorOverLifetime;
            col.enabled = true;
            var grad = new Gradient();
            grad.SetKeys(
                new[] {
                    new GradientColorKey(new Color(0.8f, 0.95f, 1f), 0f),
                    new GradientColorKey(new Color(0.6f, 0.85f, 1f), 1f),
                },
                new[] {
                    new GradientAlphaKey(0f, 0f),
                    new GradientAlphaKey(0.85f, 0.15f),
                    new GradientAlphaKey(0.4f, 0.85f),
                    new GradientAlphaKey(0f, 1f),
                });
            col.color = grad;

            var size = ps.sizeOverLifetime;
            size.enabled = true;
            var sizeCurve = new AnimationCurve();
            sizeCurve.AddKey(0f, 0.3f);
            sizeCurve.AddKey(0.5f, 1.0f);
            sizeCurve.AddKey(1.0f, 0.7f);
            size.size = new ParticleSystem.MinMaxCurve(1f, sizeCurve);

            // All three axes must use the SAME ParticleSystemCurveMode — set
            // x and z to identical TwoConstants ranges (effectively 0..0) so
            // the y MinMaxCurve doesn't trigger Unity's "must be in same mode"
            // warning.
            var vel = ps.velocityOverLifetime;
            vel.enabled = true;
            vel.x = new ParticleSystem.MinMaxCurve(-0.005f, 0.005f);
            vel.y = new ParticleSystem.MinMaxCurve(0.04f, 0.10f);
            vel.z = new ParticleSystem.MinMaxCurve(-0.005f, 0.005f);

            var rend = ps.GetComponent<ParticleSystemRenderer>();
            rend.material = new Material(Shader.Find("Sprites/Default"));
            rend.material.color = new Color(0.85f, 0.95f, 1f, 1f);

            // Now safe to start the system back up
            ps.Play();
        }

        // ---------- Indication marker glow (orange pulse on the disk) ----------
        private void BuildIndicationGlow()
        {
            indicationGlowGO = new GameObject("Edu_IndicationGlow");
            // Place a glowing sphere just above disk surface (disk top Y=0.252,
            // glow at 0.255 = 3mm above) — "found" indication during scene 16.
            // Scene 16 camera focuses on probe contact at (0.22, 0.252, 0), so
            // the glow sits NEAR the probe X with tiny off-axis offset so it's
            // visible within the super-macro frame (FOV 9° at dist 0.20 →
            // half-width 0.0157m).
            indicationGlowGO.transform.position = new Vector3(0.230f, 0.255f, 0.006f);

            var sphere = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            sphere.transform.SetParent(indicationGlowGO.transform);
            sphere.transform.localPosition = Vector3.zero;
            sphere.transform.localScale = Vector3.one * 0.02f;
            DestroyImmediate(sphere.GetComponent<SphereCollider>());

            var mat = new Material(Shader.Find("Standard"))
            { color = new Color(1f, 0.40f, 0.25f) };
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", new Color(1f, 0.45f, 0.30f) * 2.5f);
            sphere.GetComponent<MeshRenderer>().sharedMaterial = mat;

            // Pulsing point light
            var lightGO = new GameObject("Edu_IndicationGlow_Light");
            lightGO.transform.SetParent(indicationGlowGO.transform);
            lightGO.transform.localPosition = Vector3.zero;
            var light = lightGO.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = new Color(1f, 0.5f, 0.3f);
            light.intensity = 2.5f;
            light.range = 0.4f;
            light.shadows = LightShadows.None;
        }

        // Tracks when the indication glow was last (re-)activated, so we can fade
        // it in smoothly from zero rather than popping on full-strength.
        private float indicationGlowActivatedAt = -10f;
        private bool indicationGlowWasActive;

        private void UpdateIndicationGlow()
        {
            if (indicationGlowGO == null) { indicationGlowWasActive = false; return; }
            bool nowActive = indicationGlowGO.activeSelf;
            // Detect off→on transition and timestamp it for the fade-in ramp
            if (nowActive && !indicationGlowWasActive)
                indicationGlowActivatedAt = Time.unscaledTime;
            indicationGlowWasActive = nowActive;
            if (!nowActive) return;

            // Fade-in envelope — 0→1 over 0.6s with ease-out
            float age = Time.unscaledTime - indicationGlowActivatedAt;
            float fadeIn = Mathf.Clamp01(age / 0.6f);
            fadeIn = 1f - Mathf.Pow(1f - fadeIn, 3f);   // ease-out cubic

            // Pulse on top of fade
            float pulse = 0.6f + Mathf.Sin(Time.unscaledTime * 4f) * 0.4f;
            var light = indicationGlowGO.GetComponentInChildren<Light>();
            if (light != null) light.intensity = (1.5f + pulse * 2.5f) * fadeIn;
            var sphere = indicationGlowGO.transform.GetChild(0);
            if (sphere != null) sphere.localScale = Vector3.one * (0.02f + pulse * 0.012f) * fadeIn;
        }

        // ---------- ULTRASONIC SCAN BEAM (probe tip → disk → refracted into steel) ----------
        // Two animated, glowing LineRenderer segments anchored to the probe and the
        // disk surface — a bright cyan water-path beam from probe down to disk, then
        // a hot pink beam continuing into steel at 45°.
        private void BuildScanBeam()
        {
            scanBeamRoot = new GameObject("Edu_ScanBeam");
            scanBeamRoot.transform.position = Vector3.zero;

            // Water beam — vertical from probe tip down to disk surface.
            // Initial positions are placeholders; AnimateScanBeam re-computes
            // them every frame using current probe X/Z and the fixed 8 inch
            // water path from the approved setup.
            CreateLineSegment("Edu_Beam_Water", scanBeamRoot.transform,
                new Vector3(beamAnchor.x, beamAnchor.y + VisualWaterPathMeters, beamAnchor.z),
                beamAnchor,
                width: 0.0028f, color: ACCENT);
            // Steel beam — 45° refracted into the disk (length scales at runtime)
            CreateLineSegment("Edu_Beam_Steel", scanBeamRoot.transform,
                beamAnchor,
                beamAnchor + new Vector3(0.04f, -0.04f, 0f),
                width: 0.0024f, color: DANGER);

            // Wave packets travelling along the water beam — 3 small spheres
            for (int i = 0; i < 3; i++)
            {
                var w = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                w.name = "Edu_Beam_Packet_" + i;
                w.transform.SetParent(scanBeamRoot.transform);
                w.transform.localScale = Vector3.one * 0.0045f;
                DestroyImmediate(w.GetComponent<SphereCollider>());
                var m = new Material(Shader.Find("Standard")) { color = ACCENT };
                m.EnableKeyword("_EMISSION");
                m.SetColor("_EmissionColor", ACCENT * 3.0f);
                w.GetComponent<MeshRenderer>().sharedMaterial = m;
            }
        }

        private void AnimateScanBeam(float u)
        {
            if (scanBeamRoot == null) return;

            // Re-anchor BEAM to current probe position every frame (probe may move).
            // CRITICAL: only beamAnchor moves with the probe — scanCenter stays
            // FIXED at the disk center so the camera's LookAt(scanCenter) keeps
            // the disk centered in frame.
            // probeTipY is the visual transducer point. Keep it at the approved
            // 8 inch water path unless the probe mesh is visibly higher.
            var probe = GameObject.Find("Probe Mount");
            float probeTipY = beamAnchor.y + VisualWaterPathMeters;
            if (probe != null)
            {
                beamAnchor = new Vector3(probe.transform.position.x, 0.252f, probe.transform.position.z);
                // Preserve the required 8 inch water path visually. If a scene
                // places the probe model higher than that, start at the model tip.
                probeTipY = Mathf.Max(beamAnchor.y + VisualWaterPathMeters, probe.transform.position.y - 0.08f);
            }

            // Update water beam — emerges from actual probe Y, ends at disk surface
            var water = scanBeamRoot.transform.Find("Edu_Beam_Water");
            if (water != null)
            {
                var lr = water.GetComponent<LineRenderer>();
                if (lr != null)
                {
                    lr.SetPosition(0, new Vector3(beamAnchor.x, probeTipY, beamAnchor.z));
                    lr.SetPosition(1, beamAnchor);
                    float pulse = 0.7f + Mathf.Sin(Time.unscaledTime * 8f) * 0.3f;
                    lr.startColor = ACCENT * pulse;
                    lr.endColor = ACCENT * pulse;
                }
            }
            // Update steel beam — refracted 45° into the disk from the contact
            // point. Length scales with water-beam length so proportions stay nice.
            var steel = scanBeamRoot.transform.Find("Edu_Beam_Steel");
            if (steel != null)
            {
                var lr = steel.GetComponent<LineRenderer>();
                if (lr != null)
                {
                    float refractLen = Mathf.Min(0.10f, (probeTipY - beamAnchor.y) * 0.55f);
                    lr.SetPosition(0, beamAnchor);
                    lr.SetPosition(1, beamAnchor + new Vector3(refractLen, -refractLen, 0f));
                    float pulse = 0.7f + Mathf.Sin(Time.unscaledTime * 8f + 1.5f) * 0.3f;
                    lr.startColor = DANGER * pulse;
                    lr.endColor = DANGER * pulse;
                }
            }

            // Move 3 wave packets along the water beam (from probe tip to disk).
            // Uses the SAME probeTipY computed above so packets travel along the
            // actual beam, not a hardcoded 22cm-above-disk position.
            for (int i = 0; i < 3; i++)
            {
                var pkt = scanBeamRoot.transform.Find("Edu_Beam_Packet_" + i);
                if (pkt == null) continue;
                float phase = ((Time.unscaledTime * 1.2f) + i / 3f) % 1f;
                Vector3 top = new Vector3(beamAnchor.x, probeTipY, beamAnchor.z);
                pkt.position = Vector3.Lerp(top, beamAnchor, phase);
            }
        }

        // ---------- IMPACT PULSE RINGS — expanding rings on disk surface ----------
        // Spawn a new ring every 0.35s, each grows and fades over 1.2s.
        private const int MaxImpactRings = 8;
        private float impactSpawnTimer;
        private int impactNextRingIdx;
        private float[] impactRingBirthTimes;

        private void BuildImpactRings()
        {
            impactRingsRoot = new GameObject("Edu_ImpactRings");
            // Rings appear at the probe contact point, not the camera framing center.
            impactRingsRoot.transform.position = beamAnchor + new Vector3(0, 0.001f, 0);
            impactRingBirthTimes = new float[MaxImpactRings];
            for (int i = 0; i < MaxImpactRings; i++)
            {
                CreateRing("Edu_ImpactRing_" + i, impactRingsRoot.transform,
                    0.001f, 0.006f, ACCENT3);
                impactRingBirthTimes[i] = -10f;
            }
        }

        private void AnimateImpactRings(float u)
        {
            if (impactRingsRoot == null) return;
            // Anchor to probe contact point (beamAnchor), not the camera framing center.
            impactRingsRoot.transform.position = beamAnchor + new Vector3(0, 0.002f, 0);

            // Spawn new rings periodically
            impactSpawnTimer += Time.unscaledDeltaTime;
            if (impactSpawnTimer > 0.40f)
            {
                impactSpawnTimer = 0f;
                impactRingBirthTimes[impactNextRingIdx] = Time.unscaledTime;
                impactNextRingIdx = (impactNextRingIdx + 1) % MaxImpactRings;
            }

            // Animate each ring: grow + fade out
            for (int i = 0; i < MaxImpactRings; i++)
            {
                float age = Time.unscaledTime - impactRingBirthTimes[i];
                var t = impactRingsRoot.transform.Find("Edu_ImpactRing_" + i);
                if (t == null) continue;
                var lr = t.GetComponent<LineRenderer>();
                if (lr == null) continue;
                if (age < 0 || age > 1.4f)
                {
                    lr.enabled = false;
                    continue;
                }
                lr.enabled = true;
                float lifeU = Mathf.Clamp01(age / 1.2f);
                float radius = Mathf.Lerp(0.005f, 0.18f, lifeU);
                float alpha = 1f - lifeU;
                Color c = ACCENT3;
                c.a = alpha;
                lr.startColor = c;
                lr.endColor = c;
                // Update ring radius
                const int steps = 96;
                for (int j = 0; j <= steps; j++)
                {
                    float a = j / (float)steps * Mathf.PI * 2f;
                    lr.SetPosition(j, new Vector3(Mathf.Cos(a) * radius, 0, Mathf.Sin(a) * radius));
                }
                lr.widthMultiplier = 1f + lifeU * 1.5f;
            }
        }

        // ---------- SCAN TRAIL — yellow LineRenderer trail behind the probe motion ----------
        private void BuildScanTrail()
        {
            scanTrailRoot = new GameObject("Edu_ScanTrail");
            var lr = scanTrailRoot.AddComponent<LineRenderer>();
            lr.material = new Material(Shader.Find("Sprites/Default"));
            lr.startColor = ACCENT2;
            lr.endColor = new Color(ACCENT2.r, ACCENT2.g, ACCENT2.b, 0f);
            lr.startWidth = 0.006f;
            lr.endWidth = 0.001f;
            lr.useWorldSpace = true;
            lr.positionCount = 0;
        }

        private void AnimateScanTrail(float u)
        {
            if (scanTrailRoot == null) return;
            var lr = scanTrailRoot.GetComponent<LineRenderer>();
            if (lr == null) return;

            // Trail follows beamAnchor (which follows probe). Keep a rolling buffer of 60 points.
            const int MaxTrail = 60;
            int n = lr.positionCount;
            // Generate a synthetic spiral path (since probe doesn't actually orbit in this scene)
            // Place trail point at beamAnchor + small circular offset to suggest scan motion
            float a = Time.unscaledTime * 1.6f;
            float r = 0.08f;
            var pt = new Vector3(beamAnchor.x + Mathf.Cos(a) * r,
                                 beamAnchor.y + 0.003f,
                                 beamAnchor.z + Mathf.Sin(a) * r);
            if (n < MaxTrail)
            {
                lr.positionCount = n + 1;
                lr.SetPosition(n, pt);
            }
            else
            {
                var pts = new Vector3[MaxTrail];
                for (int i = 0; i < MaxTrail - 1; i++) pts[i] = lr.GetPosition(i + 1);
                pts[MaxTrail - 1] = pt;
                lr.SetPositions(pts);
            }
        }

        // --------------------------------------------------------------------
        // Helpers
        // --------------------------------------------------------------------
        private static void SetTransparent(Material m)
        {
            m.SetFloat("_Mode", 3);
            m.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
            m.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            m.SetInt("_ZWrite", 0);
            m.DisableKeyword("_ALPHATEST_ON");
            m.EnableKeyword("_ALPHABLEND_ON");
            m.DisableKeyword("_ALPHAPREMULTIPLY_ON");
            m.renderQueue = 3000;
        }

        private static void CreateLineSegment(string name, Transform parent,
            Vector3 from, Vector3 to, float width, Color color)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent);
            var lr = go.AddComponent<LineRenderer>();
            lr.material = new Material(Shader.Find("Sprites/Default"));
            lr.useWorldSpace = false;
            lr.positionCount = 2;
            lr.SetPosition(0, from);
            lr.SetPosition(1, to);
            lr.startColor = color;
            lr.endColor = color;
            lr.startWidth = width;
            lr.endWidth = width;
        }

        private static void CreateRing(string name, Transform parent,
            float radius, float width, Color color)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent);
            go.transform.localPosition = Vector3.zero;
            var lr = go.AddComponent<LineRenderer>();
            lr.material = new Material(Shader.Find("Sprites/Default"));
            lr.useWorldSpace = false;
            const int steps = 96;
            lr.positionCount = steps + 1;
            for (int i = 0; i <= steps; i++)
            {
                float a = i / (float)steps * Mathf.PI * 2f;
                lr.SetPosition(i, new Vector3(Mathf.Cos(a) * radius, 0, Mathf.Sin(a) * radius));
            }
            lr.startColor = color;
            lr.endColor = color;
            lr.startWidth = width;
            lr.endWidth = width;
        }

        private static void CreateMarker(Transform parent, Vector3 pos, float length, Color color, string name)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(parent);
            go.transform.localPosition = pos;
            go.transform.localScale = new Vector3(length, 0.008f, 0.008f);
            var m = new Material(Shader.Find("Standard")) { color = color };
            m.EnableKeyword("_EMISSION");
            m.SetColor("_EmissionColor", color * 0.7f);
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            UnityEngine.Object.DestroyImmediate(go.GetComponent<BoxCollider>());
        }

        // --------------------------------------------------------------------
        // GUI overlay — title, subtitle, takeaway, progress, formula etc.
        // --------------------------------------------------------------------
        private void OnGUI()
        {
            if (!stylesReady) EnsureStyles();
            if (!running) return;
            if (currentScene < 0 || currentScene >= Story.Length) return;

            var scene = Story[currentScene];
            string displayTitle = GetDisplayTitle(scene);
            string displaySubtitle = GetDisplaySubtitle(scene);
            string displayTakeaway = GetDisplayTakeaway(scene);
            float u = Mathf.Clamp01(sceneElapsed / Mathf.Max(0.1f, scene.duration));

            // Scene transition flash — bright fade over 0.45s after change
            float sinceChange = Time.unscaledTime - lastSceneChangeTime;
            if (sinceChange < 0.45f)
            {
                float flashU = Mathf.Pow(1f - sinceChange / 0.45f, 2f);
                GUI.color = new Color(scene.accent.r, scene.accent.g, scene.accent.b, flashU * 0.7f);
                GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), Texture2D.whiteTexture);
                GUI.color = new Color(1, 1, 1, flashU * 0.35f);
                GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), Texture2D.whiteTexture);
            }

            // Brand top bar
            GUI.color = new Color(0, 0, 0, 0.65f);
            GUI.DrawTexture(new Rect(0, 0, Screen.width, 50), Texture2D.whiteTexture);
            GUI.color = scene.accent;
            GUI.DrawTexture(new Rect(0, 0, Screen.width, 4), Texture2D.whiteTexture);
            GUI.color = Color.white;
            GUI.Label(new Rect(20, 10, 1200, 30),
                "V2500 HPT DISK · STAGE 1 SCAN · NDIP-1226 Rev F", smallStyle);

            // Redraw the brand text with ASCII-only copy so exported video
            // cannot show mojibake from source-file encoding differences.
            GUI.color = new Color(0, 0, 0, 0.65f);
            GUI.DrawTexture(new Rect(12, 6, 1220, 38), Texture2D.whiteTexture);
            GUI.color = Color.white;
            GUI.Label(new Rect(20, 10, 1200, 30),
                "V2500 HPT DISK - STAGE 1 SCAN - NDIP-1226 Rev F", smallStyle);

            // Step counter top-right
            GUI.Label(new Rect(Screen.width - 240, 10, 220, 30),
                $"SCENE {currentScene + 1} / {Story.Length}", smallStyle);

            // Progress bar segments
            int total = Story.Length;
            float segW = (Screen.width - 40f) / total - 4f;
            for (int i = 0; i < total; i++)
            {
                float fillRatio = (i < currentScene) ? 1f : (i == currentScene ? u : 0f);
                var bgR = new Rect(20 + i * (segW + 4f), 56, segW, 4);
                GUI.color = new Color(0.18f, 0.22f, 0.30f, 1);
                GUI.DrawTexture(bgR, Texture2D.whiteTexture);
                if (fillRatio > 0)
                {
                    var fR = new Rect(bgR.x, bgR.y, bgR.width * fillRatio, bgR.height);
                    GUI.color = scene.accent;
                    GUI.DrawTexture(fR, Texture2D.whiteTexture);
                }
            }

            // Lower-third — slides UP in (0.2-0.7s) and slides DOWN out (last 0.4s
            // before scene end). Avoids the title flashing on/off at transitions.
            float slideIn  = Mathf.Clamp01((sceneElapsed - 0.2f) / 0.5f);
            float timeLeft = scene.duration - sceneElapsed;
            float slideOut = 1f - Mathf.Clamp01((0.4f - timeLeft) / 0.4f);
            // alpha multiplier mirrors the slide so text fades with the panel
            float ltVis = Mathf.Min(EaseOutCubic(slideIn), slideOut);
            float ltY = Screen.height - (140 * ltVis) - 30;
            float ltA = Mathf.Pow(ltVis, 0.7f);   // gentler alpha curve than position
            GUI.color = new Color(0.06f, 0.08f, 0.14f, 0.92f * ltA);
            GUI.DrawTexture(new Rect(50, ltY, Screen.width - 100, 130), Texture2D.whiteTexture);
            GUI.color = new Color(scene.accent.r, scene.accent.g, scene.accent.b, ltA);
            GUI.DrawTexture(new Rect(50, ltY, 8, 130), Texture2D.whiteTexture);
            GUI.color = new Color(1, 1, 1, ltA);
            DrawFittedLabel(new Rect(80, ltY + 14, Screen.width - 160, 70), displayTitle, titleStyle, 24);
            GUI.color = new Color(scene.accent.r, scene.accent.g, scene.accent.b, ltA);
            DrawFittedLabel(new Rect(80, ltY + 78, Screen.width - 160, 40), displaySubtitle, subtitleStyle, 16);

            // Takeaway chip (bottom-center, fades in late AND fades out at end)
            if (!string.IsNullOrEmpty(displayTakeaway))
            {
                float chipIn = Mathf.Clamp01((sceneElapsed - scene.duration * 0.45f) / 0.4f);
                // Fade out chip in last 0.4s so it doesn't snap at transitions
                float chipOut = Mathf.Clamp01((scene.duration - sceneElapsed) / 0.4f);
                float chip = chipIn * chipOut;
                if (chip > 0)
                {
                    string txt = displayTakeaway;
                    var sz = takeawayStyle.CalcSize(new GUIContent(txt));
                    float w = sz.x + 50;
                    float h = sz.y + 24;
                    float x = (Screen.width - w) / 2f;
                    float y = ltY - h - 20;
                    GUI.color = new Color(scene.accent.r, scene.accent.g, scene.accent.b, chip * 0.18f);
                    GUI.DrawTexture(new Rect(x - 6, y - 6, w + 12, h + 12), Texture2D.whiteTexture);
                    GUI.color = new Color(0.04f, 0.06f, 0.10f, chip * 0.95f);
                    GUI.DrawTexture(new Rect(x, y, w, h), Texture2D.whiteTexture);
                    GUI.color = new Color(scene.accent.r, scene.accent.g, scene.accent.b, chip);
                    GUI.DrawTexture(new Rect(x, y, 4, h), Texture2D.whiteTexture);
                    GUI.color = new Color(1, 1, 1, chip);
                    GUI.Label(new Rect(x + 18, y + 6, w - 36, h - 12), txt, takeawayStyle);
                }
            }

            // Big concept label per scene — fades in early AND fades out at end.
            // Drawn with a dark "drop shadow" pass first, then the bright text on
            // top, so it stays readable against bright/bloomy backgrounds (was
            // getting washed out by the lighting glare in side-view scenes).
            float bigIn = Mathf.Clamp01((sceneElapsed - 0.5f) / 0.6f);
            float bigOut = Mathf.Clamp01((scene.duration - sceneElapsed) / 0.4f);
            float bigVis = bigIn * bigOut;
            if (bigVis > 0)
            {
                var bigR = new Rect(0, 180, Screen.width, 100);
                // Shadow pass — 4 dark offsets for thick outline visible against bright BG
                GUI.color = new Color(0, 0, 0, bigVis * 0.85f);
                DrawFittedLabel(new Rect(bigR.x + 2, bigR.y + 2, bigR.width, bigR.height), displayTitle, bigStyle, 44);
                DrawFittedLabel(new Rect(bigR.x - 2, bigR.y + 2, bigR.width, bigR.height), displayTitle, bigStyle, 44);
                DrawFittedLabel(new Rect(bigR.x + 2, bigR.y - 2, bigR.width, bigR.height), displayTitle, bigStyle, 44);
                DrawFittedLabel(new Rect(bigR.x - 2, bigR.y - 2, bigR.width, bigR.height), displayTitle, bigStyle, 44);
                // Main bright text
                GUI.color = new Color(1, 1, 1, bigVis * 0.95f);
                DrawFittedLabel(bigR, displayTitle, bigStyle, 44);
            }

            // Per-concept overlays
            DrawConceptOverlay(scene, u);
        }

        private static string GetDisplayTitle(EduScene scene)
        {
            switch (scene.id)
            {
                case "fsh":
                    return "FSH - FULL SCREEN HEIGHT";
                case "calib":
                    return "CALIBRATION";
                case "anatomy":
                    return "ANATOMY - 5 ZONES";
                case "zoneE_pos":
                    return "ZONE E - +45 PASS";
                case "zoneE_neg":
                    return "ZONE E - -45 PASS";
                case "montage":
                    return "ZONES A TO D";
                default:
                    return scene.title;
            }
        }

        private static string GetDisplaySubtitle(EduScene scene)
        {
            switch (scene.id)
            {
                case "title":
                    return "Immersion Scan Plan - Stage 1 - NDIP-1226 Rev F";
                case "fsh":
                    return "80% calibration - 20% report floor";
                case "calib":
                    return "FBH-1 -> gain -> 80% FSH";
                case "equipment":
                    return "Mount disk - Fill tank - 8 inch water path";
                case "scanplan":
                    return "Select V2500 Stage 1 preset";
                case "anatomy":
                    return "E / A / B / C / D";
                case "zoneE_pos":
                    return "Probe sweeps - 0.020 inch radial - 360 deg";
                case "zoneE_neg":
                    return "Mirror reverses - bidirectional coverage";
                case "montage":
                    return "Each surface +/-45 - 10 passes total";
                case "livescan":
                    return "Peak per position - >=20% FSH flagged";
                case "results":
                    return "5 zones - 10 passes - 0 indications";
                case "save":
                    return "Part serial + date - Archive";
                case "done":
                    return "V2500 HPT Disk - Stage 1";
                default:
                    return scene.subtitle;
            }
        }

        private static string GetDisplayTakeaway(EduScene scene)
        {
            switch (scene.id)
            {
                case "both_dir":
                    return "Each surface scanned twice - 10 passes total";
                case "anatomy":
                    return "Five surfaces - NDIP Figure 2";
                case "scanplan":
                    return "5 zones loaded - NDIP-1226 Rev F";
                case "zoneE_neg":
                    return "Pass 2 of 10 - Bidirectional";
                default:
                    return scene.takeaway;
            }
        }

        private static void DrawFittedLabel(Rect rect, string text, GUIStyle style, int minFontSize)
        {
            if (string.IsNullOrEmpty(text)) return;

            int originalFontSize = style.fontSize;
            bool originalWordWrap = style.wordWrap;
            TextClipping originalClipping = style.clipping;

            style.wordWrap = false;
            style.clipping = TextClipping.Clip;
            var content = new GUIContent(text);

            while (style.fontSize > minFontSize)
            {
                Vector2 size = style.CalcSize(content);
                if (size.x <= rect.width && size.y <= rect.height + 4f)
                    break;
                style.fontSize--;
            }

            if (style.fontSize <= minFontSize && style.CalcSize(content).x > rect.width)
                style.wordWrap = true;

            GUI.Label(rect, content, style);

            style.fontSize = originalFontSize;
            style.wordWrap = originalWordWrap;
            style.clipping = originalClipping;
        }

        private static void NormalizeConceptText(string concept, ref string header, ref string body)
        {
            switch (concept)
            {
                case "snell":
                    header = "SNELL'S LAW";
                    body = "sin(theta1) / v1 = sin(theta2) / v2\n\n" +
                           "v_water = 1.48 mm/us\n" +
                           "v_steel_shear = 3.23 mm/us\n\n" +
                           "sin(18.9 deg) / 1.48 = sin(45 deg) / 3.23\n" +
                           "-> refracted shear at 45 deg";
                    break;
                case "coverage":
                    header = "COVERAGE RULE";
                    body = "Beam diameter @ focus ~= 0.040\"\n" +
                           "Required step <= 1/2 beam diameter\n\n" +
                           "Scan inc:   0.020\"\n" +
                           "Index inc:  0.020\" / rev\n\n" +
                           "-> Full coverage, no blind lanes";
                    break;
                case "water_path":
                    header = "GEOMETRY";
                    body = "Transducer: IAE2P16679\n" +
                           "Frequency:  5 MHz\n" +
                           "Focal:      8.0 inch\n" +
                           "Mirror:     IAE2P16678 - 45 deg\n\n" +
                           "Place disk surface AT focal point\n" +
                           "-> min beam diameter, max resolution";
                    break;
                case "why_immersion":
                    header = "IMMERSION";
                    body = "Contact (gel):\n" +
                           "  - Variable thickness\n" +
                           "  - Variable pressure\n" +
                           "  - Drift over time\n\n" +
                           "Immersion (water):\n" +
                           "  - Constant 8.0\"\n" +
                           "  - Same every pulse\n" +
                           "  - Operator independent";
                    break;
                case "both_dir":
                    header = "+/- 45 deg COVERAGE";
                    body = "Cracks have an orientation.\n\n" +
                           "+45 deg beam: finds one set\n" +
                           "-45 deg beam: finds the other\n\n" +
                           "Both directions = guaranteed coverage\n" +
                           "= 10 passes total (5 zones x 2)";
                    break;
                case "zones":
                case "anatomy":
                    header = "5 ZONES (NDIP-1226)";
                    body = "E - Upper Web Transition\n" +
                           "A - Upper Chamfer\n" +
                           "B - Upper Land\n" +
                           "C - Bore Entry Chamfer\n" +
                           "D - Bore Inner Diameter\n\n" +
                           "Each surface scanned +/- 45 deg";
                    break;
                case "calib":
                    header = "CALIBRATION";
                    body = "Reference block: IAE2P16675\n" +
                           "Reference reflector: FBH#1 (1/64\")\n" +
                           "Target: 80% FSH\n\n" +
                           "Required:\n" +
                           "  - Curvature correction\n" +
                           "  - Post-cal check";
                    break;
                case "ascan_cscan":
                    header = "A-SCAN vs C-SCAN";
                    body = "A-SCAN\n" +
                           "  amplitude vs time\n" +
                           "  one position, right now\n" +
                           "  -> FINDS the indication\n\n" +
                           "C-SCAN\n" +
                           "  peak amplitude vs position\n" +
                           "  top-down map\n" +
                           "  -> WHERE the indication is";
                    break;
                case "pass_positive":
                    header = "ZONE E +45 deg";
                    body = "Angle:       +45 deg\n" +
                           "Direction:   circumferential\n" +
                           "Disk rot:    0 deg -> 360 deg\n" +
                           "Radial step: 0.020\" / rev\n\n" +
                           "Pass: 1 of 10";
                    break;
                case "pass_negative":
                    header = "ZONE E -45 deg";
                    body = "Mirror flips\n" +
                           "Sweep reverses direction\n\n" +
                           "Coverage now bidirectional\n" +
                           "Pass: 2 of 10";
                    break;
                case "live":
                    header = "LIVE C-SCAN";
                    body = "Probe:        moving\n" +
                           "Colormap:     building\n" +
                           "FSH floor:    20%\n" +
                           "Indications:  0\n\n" +
                           "Decision:     PASS";
                    break;
                case "results":
                    header = "RESULTS";
                    body = "Zone E: PASS - 0 indications\n" +
                           "Zone A: PASS - 0 indications\n" +
                           "Zone B: PASS - 0 indications\n" +
                           "Zone C: PASS - 0 indications\n" +
                           "Zone D: PASS - 0 indications\n\n" +
                           "STAMP: ACCEPT";
                    break;
            }
        }

        private void DrawConceptOverlay(EduScene scene, float u)
        {
            // Right-side info card with extra detail per concept
            float x = Screen.width - 470;
            float y = 110;
            float w = 440;
            float h = 280;

            string body = null;
            string header = null;
            Color accent = scene.accent;
            switch (scene.concept)
            {
                case "snell":
                    header = "SNELL'S LAW";
                    body = "sin(θ₁) / v₁ = sin(θ₂) / v₂\n\n" +
                           "v_water = 1.48 mm/μs\n" +
                           "v_steel_shear = 3.23 mm/μs\n\n" +
                           "sin(18.9°) / 1.48 = sin(45°) / 3.23\n" +
                           "→ refracted shear at 45°";
                    break;
                case "fsh":
                    header = "FSH";
                    body = "100% = full screen height\n" +
                           "80% = calibration peak (FBH#1)\n" +
                           "20% = report threshold\n\n" +
                           "Below 20% = noise floor\n" +
                           "Above 20% = flagged";
                    break;
                case "calib":
                    header = "CALIBRATION";
                    body = "Reference block: IAE2P16675\n" +
                           "Reference reflector: FBH#1 (1/64\")\n" +
                           "Target: 80% FSH\n\n" +
                           "Required:\n" +
                           "  • Curvature correction\n" +
                           "  • Post-cal check";
                    break;
                case "coverage":
                    header = "COVERAGE RULE";
                    body = "Beam Ø @ focus ≈ 0.040\"\n" +
                           "Required step ≤ ½ · beam Ø\n\n" +
                           "Scan inc:   0.020\"\n" +
                           "Index inc:  0.020\" / rev\n\n" +
                           "→ Full coverage, no blind alleys";
                    break;
                case "why_immersion":
                    header = "IMMERSION";
                    body = "Contact (gel):\n" +
                           "  • Variable thickness\n" +
                           "  • Variable pressure\n" +
                           "  • Drift over time\n\n" +
                           "Immersion (water):\n" +
                           "  • Constant 8.0\"\n" +
                           "  • Same every pulse\n" +
                           "  • Operator independent";
                    break;
                case "water_path":
                    header = "GEOMETRY";
                    body = "Transducer: IAE2P16679\n" +
                           "Frequency:  5 MHz\n" +
                           "Focal:      8.0 inch\n" +
                           "Mirror:     IAE2P16678  ·  45°\n\n" +
                           "Place disk surface AT focal point\n" +
                           "→ min beam Ø, max resolution";
                    break;
                case "both_dir":
                    header = "± 45° COVERAGE";
                    body = "Cracks have an orientation.\n\n" +
                           "+45° beam:  finds one set\n" +
                           "−45° beam:  finds the other\n\n" +
                           "Both directions = guaranteed coverage\n" +
                           "= 10 passes total (5 zones × 2)";
                    break;
                case "zones":
                case "anatomy":
                    header = "5 ZONES (NDIP-1226)";
                    body = "E — Upper Web Transition\n" +
                           "A — Upper Chamfer\n" +
                           "B — Upper Land\n" +
                           "C — Bore Entry Chamfer\n" +
                           "D — Bore Inner Diameter\n\n" +
                           "Each surface scanned ± 45°";
                    break;
                case "ascan_cscan":
                    header = "A-SCAN vs C-SCAN";
                    body = "A-SCAN\n" +
                           "  amplitude vs time\n" +
                           "  one position, right now\n" +
                           "  → FINDS the indication\n\n" +
                           "C-SCAN\n" +
                           "  peak amplitude vs position\n" +
                           "  top-down map\n" +
                           "  → WHERE the indication is";
                    break;
                case "pass_positive":
                    header = "ZONE E +45°";
                    body = "Angle:       +45°\n" +
                           "Direction:   circumferential\n" +
                           "Disk rot:    0° → 360°\n" +
                           "Radial step: 0.020\" / rev\n\n" +
                           "Pass: 1 of 10";
                    break;
                case "pass_negative":
                    header = "ZONE E −45°";
                    body = "Mirror flips\n" +
                           "Sweep reverses direction\n\n" +
                           "Coverage now bidirectional\n" +
                           "Pass: 2 of 10";
                    break;
                case "live":
                    header = "● LIVE C-SCAN";
                    body = "Probe:        moving\n" +
                           "Colormap:     building\n" +
                           "FSH floor:    20%\n" +
                           "Indications:  0\n\n" +
                           "Decision:     PASS";
                    break;
                case "results":
                    header = "RESULTS";
                    body = "Zone E:  PASS  ·  0 indications\n" +
                           "Zone A:  PASS  ·  0 indications\n" +
                           "Zone B:  PASS  ·  0 indications\n" +
                           "Zone C:  PASS  ·  0 indications\n" +
                           "Zone D:  PASS  ·  0 indications\n\n" +
                           "STAMP: ACCEPT";
                    break;
            }

            NormalizeConceptText(scene.concept, ref header, ref body);
            if (header == null) return;
            // Slide in panel
            float pin = Mathf.Clamp01((sceneElapsed - 0.6f) / 0.6f);
            float xx = Mathf.Lerp(x + 100, x, EaseOutCubic(pin));
            GUI.color = new Color(0.04f, 0.06f, 0.10f, pin * 0.92f);
            GUI.DrawTexture(new Rect(xx, y, w, h), Texture2D.whiteTexture);
            GUI.color = new Color(accent.r, accent.g, accent.b, pin);
            GUI.DrawTexture(new Rect(xx, y, w, 36), Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(xx, y, 4, h), Texture2D.whiteTexture);
            GUI.color = new Color(0, 0, 0, pin);
            GUI.Label(new Rect(xx + 14, y + 4, w - 28, 30), header, subtitleStyle);
            GUI.color = new Color(1, 1, 1, pin);
            GUI.Label(new Rect(xx + 18, y + 50, w - 36, h - 60), body, smallStyle);
        }

        static float EaseOutCubic(float t)
        {
            return 1 - Mathf.Pow(1 - t, 3);
        }

        private void EnsureStyles()
        {
            stylesReady = true;
            titleStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 36,
                fontStyle = FontStyle.Bold,
                normal = { textColor = Color.white },
            };
            subtitleStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 22,
                fontStyle = FontStyle.Bold,
                normal = { textColor = Color.white },
            };
            takeawayStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 22,
                fontStyle = FontStyle.Bold,
                normal = { textColor = Color.white },
                alignment = TextAnchor.MiddleLeft,
            };
            bigStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 92,
                fontStyle = FontStyle.Bold,
                normal = { textColor = Color.white },
                alignment = TextAnchor.UpperCenter,
            };
            smallStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 18,
                normal = { textColor = Color.white },
            };
            barStyle = new GUIStyle();
        }
    }
}
