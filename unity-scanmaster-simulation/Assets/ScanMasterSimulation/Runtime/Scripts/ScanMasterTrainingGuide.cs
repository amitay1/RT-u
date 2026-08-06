using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    public sealed class ScanMasterTrainingGuide : MonoBehaviour
    {
        [SerializeField] private ScanMasterSimulationController controller;
        [SerializeField] private ScanMasterPartSelector partSelector;
        [SerializeField] private ScanMasterScanPath scanPath;
        [SerializeField] private ScanMasterCameraOrbit cameraOrbit;
        [SerializeField] private ScanMasterCameraFocus cameraFocus;
        [SerializeField] private bool showGuide = true;
        [SerializeField] private bool showProcedureData = true;
        [SerializeField] private bool autoDirectScene = true;
        [SerializeField] private bool autoPlayTutorial = true;
        [SerializeField] private bool loopTutorial = true;
        [SerializeField] private float setupStepSeconds = 6.5f;
        [SerializeField] private float scanStepSeconds = 12f;
        [SerializeField] private Texture2D wizardMenuImage;
        [SerializeField] private Texture2D setupToolboxImage;
        [SerializeField] private Texture2D setupHighlightedImage;
        [SerializeField] private Texture2D ascanCalibrationImage;
        [SerializeField] private Texture2D tcgOneNodeImage;
        [SerializeField] private Texture2D ascanSecondPeakImage;
        [SerializeField] private Texture2D tcgTwoNodesImage;
        [SerializeField] private Texture2D ascanThirdPeakImage;
        [SerializeField] private Texture2D tcgThreeNodesImage;
        [SerializeField] private Texture2D ascanBackwallTcgImage;
        [SerializeField] private Texture2D saveSetupImage;

        private int stepIndex;
        private int appliedStepIndex = -1;
        private float stepElapsed;
        private GUIStyle titleStyle;
        private GUIStyle bodyStyle;
        private GUIStyle smallStyle;
        private GUIStyle dataStyle;
        private GUIStyle warningStyle;

        public int CurrentStepIndex => stepIndex;
        public int StepCount => Steps.Length;

        private static readonly TrainingStep[] Steps =
        {
            new TrainingStep(
                "Mission Brief",
                "Build the operator's mental model before the real disk enters the tank.",
                "Confirm part family, NDIP revision, transducer, mirror, calibration block and the reason both shear directions are required.",
                "This is a training simulation. Production acceptance still belongs to the approved NDIP and Level II/III review.",
                "Wide view: tank, turntable, robot and software flow.",
                1, 0.02f, true, false, -38f, 25f, 3.65f, new Vector3(0f, 0.34f, 0f), SoftwareImage.Wizard, "Open ScanMaster and start from Teach In.", "Click Teach In", new Rect(0.37f, 0.17f, 0.25f, 0.24f)),
            new TrainingStep(
                "Part ID And Zero",
                "Stop the scan from becoming anonymous data.",
                "Record part number, serial number, heat code, engine data, TSN, CSN and define the 12 o'clock zero-degree start position.",
                "Do not continue if the disk identity, revision or orientation is uncertain.",
                "Camera looks down at the bore and zero reference.",
                1, 0.00f, true, false, -8f, 54f, 2.15f, new Vector3(0f, 0.28f, 0f), SoftwareImage.Wizard, "Create or open the Teach In program before touching motion settings.", "Teach In program", new Rect(0.37f, 0.17f, 0.25f, 0.24f)),
            new TrainingStep(
                "Equipment Build",
                "Make the physical setup match the procedure before calibration.",
                "Install the 5 MHz, 8 inch focus immersion probe, 45-degree mirror, turntable fixture and calibration block.",
                "The probe, mirror and cable must be visible and seated. A missing probe object in the simulation is not acceptable.",
                "Close-up: probe body, black housing, mirror shoe and yellow cable.",
                1, 0.12f, true, false, -58f, 19f, 1.62f, new Vector3(0.08f, 0.43f, 0.02f), SoftwareImage.Setup, "Use Setup Toolbox to verify instrument, channel, probe and material before scanning.", "Setup Toolbox", new Rect(0.09f, 0.13f, 0.75f, 0.46f)),
            new TrainingStep(
                "Tank Prep",
                "Remove the coupling problems before they become fake indications.",
                "Immerse the part and probe, wipe bubbles from the entry surface, under-web areas and mirror face, and wait for stable water.",
                "Bubbles, debris and unstable water path can defeat a perfect software setup.",
                "Low waterline view: probe clearance and part immersion.",
                1, 0.18f, true, false, -78f, 13f, 2.05f, new Vector3(0.02f, 0.30f, 0.04f), SoftwareImage.Setup, "Confirm the setup values before moving from water preparation to calibration.", "Check channel setup", new Rect(0.09f, 0.13f, 0.75f, 0.46f)),
            new TrainingStep(
                "Reference Calibration",
                "Normalize on the reference reflector and establish a controlled response.",
                "Set water path to 8 inches, optimize incidence near 18.9 degrees for a 45-degree shear wave and bring FBH #1 to 80 percent FSH.",
                "Apply curvature and calibration-block gain offsets from the approved data.",
                "Calibration close-up: the beam, entry spot and probe stand-off are emphasized.",
                1, 0.27f, true, false, -44f, 17f, 1.48f, new Vector3(0.10f, 0.39f, 0.02f), SoftwareImage.SetupHighlighted, "Set acoustic values in the highlighted calibration area before accepting the reference response.", "Delay / range / water path", new Rect(0.03f, 0.13f, 0.42f, 0.54f)),
            new TrainingStep(
                "TCG Point 1",
                "Teach the operator that TCG is built from real echoes, not a decorative graph.",
                "Move to the first FBH response, set the peak to the reference level and store the first TCG node.",
                "Bad peak selection here poisons every later scan review.",
                "A-scan view paired with a static probe pose.",
                1, 0.33f, true, false, -34f, 20f, 1.75f, new Vector3(0.08f, 0.40f, 0f), SoftwareImage.AscanFirst, "Use the A-scan peak to create the first TCG point.", "Peak to 80% FSH", new Rect(0.23f, 0.12f, 0.56f, 0.42f)),
            new TrainingStep(
                "TCG Multi Point",
                "Show how the setup becomes usable across depth.",
                "Add the second and third TCG nodes, then verify the list contains all required entries before moving to the disk.",
                "A single pretty echo is not enough; the operator must confirm the TCG list.",
                "Camera stays close while software focuses on the TCG node list.",
                1, 0.40f, true, false, -28f, 22f, 1.82f, new Vector3(0.06f, 0.40f, 0.02f), SoftwareImage.TcgThree, "Verify the TCG list after storing each node.", "TCG node list", new Rect(0.12f, 0.18f, 0.42f, 0.54f)),
            new TrainingStep(
                "Move To Bore",
                "Transfer from calibration to the part without changing the inspection geometry by accident.",
                "Normalize on the inspection surface, set the bore offset and verify the 8 inch water path before scanning.",
                "Stage 1 offset is 0.943 inch for nominal radius 2.910 inch; Stage 2 offset is 0.898 inch for nominal radius 2.773 inch.",
                "Side view: the probe is brought close enough to look like a real scan setup.",
                1, 0.48f, true, false, -64f, 18f, 1.7f, new Vector3(0.03f, 0.34f, 0f), SoftwareImage.Setup, "Verify Gates, TCG, Material and Timebase before pressing Scan.", "Gates + TCG tabs", new Rect(0.56f, 0.13f, 0.19f, 0.09f)),
            new TrainingStep(
                "Stage 1 Surface Map",
                "Make the operator see the required bore surfaces before motion starts.",
                "Stage 1 surfaces: E, A, B, C and D. Confirm the scan plan covers each surface in both circumferential shear directions.",
                "The surface map is a guide. Confirm any surface-specific exception in the approved procedure.",
                "High angle: zone labels and planned path are visible.",
                1, 0.52f, true, false, -16f, 48f, 2.25f, new Vector3(0f, 0.35f, 0f), SoftwareImage.Setup, "The software setup must match the selected physical surface map.", "Surface setup", new Rect(0.56f, 0.13f, 0.19f, 0.09f)),
            new TrainingStep(
                "Stage 1 +45 Scan",
                "Demonstrate live scanning, not just robot movement.",
                "Run the first circumferential shear direction and watch beam entry, footprint, trace density and C-scan strip progress.",
                "Scan and index increments must be no larger than 0.020 inch.",
                "Tracking view: probe, footprint and live trace stay in frame.",
                1, 0.08f, true, true, -50f, 18f, 1.58f, new Vector3(0.06f, 0.34f, 0f), SoftwareImage.Setup, "Press Scan only after setup, gates and TCG are correct.", "Press Scan", new Rect(0.74f, 0.68f, 0.18f, 0.18f)),
            new TrainingStep(
                "Stage 1 -45 Scan",
                "Show that opposite shear direction is a separate required coverage pass.",
                "Reverse direction, reset the live trace and scan the same required surfaces again.",
                "Do not treat the second direction as optional when the procedure requires both directions.",
                "Opposite-side camera view: the path color changes to show direction reversal.",
                1, 0.58f, false, true, 46f, 18f, 1.62f, new Vector3(-0.04f, 0.34f, 0.02f), SoftwareImage.Setup, "Confirm the scan direction/program before starting the reverse pass.", "Reverse direction scan", new Rect(0.74f, 0.68f, 0.18f, 0.18f)),
            new TrainingStep(
                "Stage 2 Changeover",
                "Teach the operator that Stage 2 is not Stage 1 with a different label.",
                "Switch to P/N 2A4802, NDIP-1227 Rev D, then verify surfaces M, N, O, P, K and L.",
                "Surface N is marked as noisy in the extracted plan; confirm current approved instruction before treating it as active coverage.",
                "High angle: Stage 2 part and zone labels.",
                2, 0.14f, true, false, 15f, 50f, 2.25f, new Vector3(0f, 0.34f, 0f), SoftwareImage.Setup, "Load or verify the Stage 2 setup before scanning.", "Stage 2 setup", new Rect(0.09f, 0.13f, 0.75f, 0.46f)),
            new TrainingStep(
                "Stage 2 Coverage",
                "Repeat the coverage logic on the second disk geometry.",
                "Run the Stage 2 surfaces with the smaller nominal radius and the 0.898 inch bore offset.",
                "The robot animation must stay close to the part; a floating probe teaches the wrong habit.",
                "Probe close-up: smaller radius and active footprint.",
                2, 0.36f, true, true, -62f, 18f, 1.55f, new Vector3(0.04f, 0.32f, 0f), SoftwareImage.Setup, "Verify gates and TCG before Stage 2 motion.", "Stage 2 gates", new Rect(0.56f, 0.13f, 0.19f, 0.09f)),
            new TrainingStep(
                "Live C-Scan Review",
                "Show what the operator must watch while the robot is moving.",
                "Compare the live C-scan strip, A-scan peak behavior and world-space footprint. Pause and rescan any questionable area.",
                "The orange marker is synthetic training data, not a reject call.",
                "Review view: synthetic indication marker and software signal are both visible.",
                2, 0.68f, true, false, -42f, 24f, 1.78f, new Vector3(0.04f, 0.34f, 0f), SoftwareImage.BackwallTcg, "Use the live A-scan/C-scan response to decide whether data quality is acceptable.", "Review response", new Rect(0.24f, 0.10f, 0.58f, 0.45f)),
            new TrainingStep(
                "Post Calibration",
                "Prove that the inspection stayed valid after scanning.",
                "Return to the calibration block and document the post-cal response before accepting the data set.",
                "If post-cal is out of tolerance, rescan the affected surfaces per procedure.",
                "Stable overview: the scan is stopped and the software is back in verification mode.",
                2, 0.86f, true, false, -34f, 26f, 2.15f, new Vector3(0f, 0.36f, 0f), SoftwareImage.AscanThird, "Verify the stored calibration/TCG response after scanning.", "Post-cal check", new Rect(0.23f, 0.12f, 0.56f, 0.42f)),
            new TrainingStep(
                "Save And Report",
                "End with traceability, not just a nice animation.",
                "Save the setup and data file, then report inspector, system, probe, calibration block, part identity, surface, index, depth, location and amplitude/TOF results.",
                "Training is incomplete if the operator cannot find the saved record.",
                "Final wide shot: full cell and software save target.",
                2, 0.98f, true, false, -38f, 25f, 3.35f, new Vector3(0f, 0.34f, 0f), SoftwareImage.Save, "Save the TCG/setup and inspection data before closing the job.", "Save setup/data", new Rect(0.58f, 0.50f, 0.28f, 0.28f))
        };

        private static readonly string[] Stage1Zones = { "E", "A", "B", "C", "D" };
        private static readonly string[] Stage2Zones = { "M", "N", "O", "P", "K", "L" };

        private void Start()
        {
            Time.timeScale = 1f;
            stepElapsed = 0f;
            ApplyCurrentStep(true);
        }

        private void Update()
        {
            if (ScanMasterInput.GetKeyDown(KeyCode.H))
            {
                showGuide = !showGuide;
            }

            if (ScanMasterInput.GetKeyDown(KeyCode.Tab))
            {
                showProcedureData = !showProcedureData;
            }

            if (ScanMasterInput.GetKeyDown(KeyCode.V))
            {
                autoPlayTutorial = !autoPlayTutorial;
                stepElapsed = 0f;
            }

            if (ScanMasterInput.GetKeyDown(KeyCode.RightArrow) || ScanMasterInput.GetKeyDown(KeyCode.N))
            {
                SetStep(stepIndex + 1);
            }

            if (ScanMasterInput.GetKeyDown(KeyCode.LeftArrow) || ScanMasterInput.GetKeyDown(KeyCode.B))
            {
                SetStep(stepIndex - 1);
            }

            if (ScanMasterInput.GetKeyDown(KeyCode.Home))
            {
                SetStep(0);
            }

            if (ScanMasterInput.GetKeyDown(KeyCode.End))
            {
                SetStep(Steps.Length - 1);
            }

            if (autoPlayTutorial)
            {
                stepElapsed += Time.unscaledDeltaTime;
                if (stepElapsed >= GetCurrentStepDuration())
                {
                    if (stepIndex < Steps.Length - 1)
                    {
                        SetStep(stepIndex + 1);
                    }
                    else if (loopTutorial)
                    {
                        SetStep(0);
                    }
                    else
                    {
                        autoPlayTutorial = false;
                    }
                }
            }
        }

        private void OnGUI()
        {
            EnsureStyles();

            if (!showGuide)
            {
                GUI.Box(new Rect(16f, 16f, 280f, 34f), "Training Guide hidden - press H");
                return;
            }

            DrawGuidePanel();

            if (showProcedureData)
            {
                DrawProcedurePanel();
                DrawSoftwarePanel();
                DrawCScanStrip();
            }
        }

        private void SetStep(int newIndex)
        {
            var clamped = Mathf.Clamp(newIndex, 0, Steps.Length - 1);
            if (clamped == stepIndex)
            {
                return;
            }

            stepIndex = clamped;
            stepElapsed = 0f;
            ApplyCurrentStep(false);
        }

        private float GetCurrentStepDuration()
        {
            return Steps[stepIndex].PlayScan
                ? Mathf.Max(3f, scanStepSeconds)
                : Mathf.Max(2f, setupStepSeconds);
        }

        private void ApplyCurrentStep(bool force)
        {
            if (!autoDirectScene || (!force && appliedStepIndex == stepIndex))
            {
                return;
            }

            appliedStepIndex = stepIndex;
            var step = Steps[stepIndex];

            var stageChanged = partSelector != null && partSelector.ActiveStage != step.Stage;
            var directionChanged = scanPath != null && scanPath.PositiveDirection != step.PositiveDirection;

            if (partSelector != null)
            {
                partSelector.SelectStage(step.Stage);
            }

            if (scanPath != null)
            {
                scanPath.PositiveDirection = step.PositiveDirection;
            }

            if (controller != null)
            {
                if (step.PlayScan)
                {
                    if (stageChanged || directionChanged)
                    {
                        controller.SetProgress(step.Progress, true, true);
                    }

                    controller.SetPlaying(true);
                }
                else
                {
                    controller.SetPlaying(false);
                    controller.SetProgress(step.Progress, false, stageChanged || stepIndex == 0);
                }
            }

            if (cameraOrbit != null)
            {
                cameraOrbit.SetGuidedView(step.CameraYaw, step.CameraPitch, step.CameraDistance, step.CameraOffset);
            }

            if (cameraFocus != null)
            {
                cameraFocus.SetProbeWeight(GetCameraProbeWeight(step));
            }
        }

        private float GetCameraProbeWeight(TrainingStep step)
        {
            if (step.PlayScan)
            {
                return 0.78f;
            }

            if (stepIndex >= 2 && stepIndex <= 7)
            {
                return 0.42f;
            }

            return 0.08f;
        }

        private void DrawGuidePanel()
        {
            var step = Steps[stepIndex];
            var rect = new Rect(16f, 16f, 520f, 332f);
            GUI.Box(rect, GUIContent.none);
            GUI.Label(new Rect(34f, 30f, 470f, 28f), $"Training Step {stepIndex + 1}/{Steps.Length}: {step.Title}", titleStyle);
            GUI.Label(new Rect(34f, 66f, 470f, 46f), step.Goal, bodyStyle);
            GUI.Label(new Rect(34f, 120f, 470f, 56f), "Operator action: " + step.Action, bodyStyle);
            GUI.Label(new Rect(34f, 184f, 470f, 50f), "Watch point: " + step.WatchPoint, warningStyle);
            GUI.Label(new Rect(34f, 242f, 470f, 36f), "Scene focus: " + step.SceneCue, smallStyle);
            var autoStatus = autoPlayTutorial ? "Auto video on" : "Auto video off";
            var remaining = Mathf.Max(0f, GetCurrentStepDuration() - stepElapsed);
            GUI.Label(new Rect(34f, 294f, 470f, 24f), $"{autoStatus} ({remaining:0}s) | V = auto, B/N = step, Space = scan, H = hide, Tab = panels", smallStyle);
        }

        private void DrawProcedurePanel()
        {
            var stage = partSelector != null ? partSelector.ActiveStage : Steps[stepIndex].Stage;
            var zones = stage == 1 ? Stage1Zones : Stage2Zones;
            var progress = controller != null ? controller.Progress : Steps[stepIndex].Progress;
            var zone = zones[Mathf.Clamp(Mathf.FloorToInt(progress * zones.Length), 0, zones.Length - 1)];
            var mode = scanPath != null && scanPath.PositiveDirection ? "+45 shear" : "-45 shear";
            var ndip = stage == 1 ? "NDIP-1226 Rev F / P/N 2A5001" : "NDIP-1227 Rev D / P/N 2A4802";
            var offset = stage == 1 ? "0.943 in offset, 2.910 in nominal radius" : "0.898 in offset, 2.773 in nominal radius";

            var rect = new Rect(Screen.width - 430f, 16f, 410f, 252f);
            GUI.Box(rect, GUIContent.none);
            GUI.Label(new Rect(rect.x + 16f, rect.y + 14f, 370f, 26f), "Procedure Data", titleStyle);
            GUI.Label(new Rect(rect.x + 16f, rect.y + 50f, 370f, 24f), ndip, dataStyle);
            GUI.Label(new Rect(rect.x + 16f, rect.y + 78f, 370f, 24f), "Active zone: " + zone + "   Mode: " + mode, dataStyle);
            GUI.Label(new Rect(rect.x + 16f, rect.y + 106f, 370f, 24f), "Bore setup: " + offset, dataStyle);
            GUI.Label(new Rect(rect.x + 16f, rect.y + 134f, 370f, 24f), "Water path: 8 in   Calibration: FBH #1 to 80% FSH", dataStyle);
            GUI.Label(new Rect(rect.x + 16f, rect.y + 162f, 370f, 24f), "Limits: scan <= 0.020 in, index <= 0.020 in/rev", dataStyle);
            GUI.Label(new Rect(rect.x + 16f, rect.y + 190f, 370f, 24f), "Coverage: minimum 2.6 in radial volumetric coverage", dataStyle);
            GUI.Label(new Rect(rect.x + 16f, rect.y + 218f, 370f, 24f), controller != null && controller.IsPlaying ? "Status: live scan running" : "Status: guided setup / paused scan", warningStyle);
        }

        private void DrawCScanStrip()
        {
            var rect = new Rect(16f, Screen.height - 122f, Screen.width - 32f, 94f);
            GUI.Box(rect, GUIContent.none);
            GUI.Label(new Rect(rect.x + 16f, rect.y + 12f, 190f, 24f), "Live C-Scan Training Strip", titleStyle);

            var scanRect = new Rect(rect.x + 220f, rect.y + 18f, rect.width - 250f, 58f);
            DrawRect(scanRect, new Color(0.02f, 0.04f, 0.05f, 0.95f));

            var stage = partSelector != null ? partSelector.ActiveStage : Steps[stepIndex].Stage;
            var zones = stage == 1 ? Stage1Zones : Stage2Zones;
            for (var i = 0; i < zones.Length; i++)
            {
                var x = scanRect.x + i * scanRect.width / zones.Length;
                var width = scanRect.width / zones.Length - 2f;
                var shade = i % 2 == 0 ? new Color(0.05f, 0.18f, 0.22f, 0.8f) : new Color(0.04f, 0.13f, 0.16f, 0.8f);
                DrawRect(new Rect(x, scanRect.y, width, scanRect.height), shade);
                GUI.Label(new Rect(x + 6f, scanRect.y + 18f, width - 8f, 22f), zones[i], dataStyle);
            }

            var progress = controller != null ? controller.Progress : Steps[stepIndex].Progress;
            var sweepX = scanRect.x + Mathf.Clamp01(progress) * scanRect.width;
            DrawRect(new Rect(sweepX - 2f, scanRect.y - 4f, 4f, scanRect.height + 8f), new Color(0f, 1f, 0.45f, 0.95f));
            DrawRect(new Rect(scanRect.x + scanRect.width * 0.68f, scanRect.y + 10f, 8f, scanRect.height - 20f), new Color(1f, 0.65f, 0.1f, 0.85f));

            GUI.Label(new Rect(rect.x + 16f, rect.y + 48f, 188f, 44f), "Orange marker = synthetic training indication. It teaches review behavior, not acceptance.", smallStyle);
        }

        private void DrawSoftwarePanel()
        {
            var step = GetSoftwareStep();
            if (step.Image == null || Screen.height < 660)
            {
                return;
            }

            var panel = new Rect(16f, 358f, 520f, Mathf.Min(292f, Screen.height - 492f));
            if (panel.height < 205f)
            {
                return;
            }

            GUI.Box(panel, GUIContent.none);
            GUI.Label(new Rect(panel.x + 16f, panel.y + 10f, panel.width - 32f, 24f), "ScanMaster Software Click Guide", titleStyle);
            GUI.Label(new Rect(panel.x + 16f, panel.y + 38f, panel.width - 32f, 42f), step.Instruction, smallStyle);

            var imageContainer = new Rect(panel.x + 16f, panel.y + 86f, panel.width - 32f, panel.height - 100f);
            DrawRect(imageContainer, new Color(0.02f, 0.025f, 0.03f, 0.92f));
            var imageRect = FitImageRect(imageContainer, step.Image);
            GUI.DrawTexture(imageRect, step.Image, ScaleMode.ScaleToFit);

            var marker = new Rect(
                imageRect.x + step.Marker.x * imageRect.width,
                imageRect.y + step.Marker.y * imageRect.height,
                step.Marker.width * imageRect.width,
                step.Marker.height * imageRect.height);
            DrawOutline(marker, new Color(1f, 0.92f, 0.1f, 1f), 3f);
            DrawRect(new Rect(marker.center.x - 12f, marker.center.y - 2f, 24f, 4f), new Color(1f, 0.92f, 0.1f, 1f));
            DrawRect(new Rect(marker.center.x - 2f, marker.center.y - 12f, 4f, 24f), new Color(1f, 0.92f, 0.1f, 1f));
            GUI.Label(new Rect(marker.xMax + 8f, marker.y - 2f, imageRect.xMax - marker.xMax - 12f, 42f), step.ClickLabel, warningStyle);
        }

        private SoftwareStep GetSoftwareStep()
        {
            var step = Steps[stepIndex];
            return new SoftwareStep(
                ResolveImage(step.SoftwareImage),
                step.SoftwareInstruction,
                step.SoftwareClickLabel,
                step.SoftwareMarker);
        }

        private Texture2D ResolveImage(SoftwareImage image)
        {
            switch (image)
            {
                case SoftwareImage.Wizard:
                    return wizardMenuImage;
                case SoftwareImage.Setup:
                    return setupToolboxImage;
                case SoftwareImage.SetupHighlighted:
                    return setupHighlightedImage;
                case SoftwareImage.AscanFirst:
                    return ascanCalibrationImage;
                case SoftwareImage.TcgOne:
                    return tcgOneNodeImage;
                case SoftwareImage.AscanSecond:
                    return ascanSecondPeakImage;
                case SoftwareImage.TcgTwo:
                    return tcgTwoNodesImage;
                case SoftwareImage.AscanThird:
                    return ascanThirdPeakImage;
                case SoftwareImage.TcgThree:
                    return tcgThreeNodesImage;
                case SoftwareImage.BackwallTcg:
                    return ascanBackwallTcgImage;
                case SoftwareImage.Save:
                    return saveSetupImage;
                default:
                    return setupToolboxImage;
            }
        }

        private void EnsureStyles()
        {
            if (titleStyle != null)
            {
                return;
            }

            titleStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 18,
                fontStyle = FontStyle.Bold,
                normal = { textColor = Color.white },
                wordWrap = true
            };

            bodyStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 14,
                normal = { textColor = new Color(0.9f, 0.94f, 0.96f) },
                wordWrap = true
            };

            warningStyle = new GUIStyle(bodyStyle)
            {
                normal = { textColor = new Color(1f, 0.82f, 0.36f) }
            };

            smallStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 11,
                normal = { textColor = new Color(0.72f, 0.82f, 0.86f) },
                wordWrap = true
            };

            dataStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 13,
                normal = { textColor = new Color(0.86f, 0.95f, 0.98f) },
                wordWrap = true
            };
        }

        private static void DrawRect(Rect rect, Color color)
        {
            var previous = GUI.color;
            GUI.color = color;
            GUI.DrawTexture(rect, Texture2D.whiteTexture);
            GUI.color = previous;
        }

        private static void DrawOutline(Rect rect, Color color, float width)
        {
            DrawRect(new Rect(rect.x, rect.y, rect.width, width), color);
            DrawRect(new Rect(rect.x, rect.yMax - width, rect.width, width), color);
            DrawRect(new Rect(rect.x, rect.y, width, rect.height), color);
            DrawRect(new Rect(rect.xMax - width, rect.y, width, rect.height), color);
        }

        private static Rect FitImageRect(Rect container, Texture2D image)
        {
            var imageAspect = image.width / (float)image.height;
            var containerAspect = container.width / container.height;
            if (imageAspect > containerAspect)
            {
                var height = container.width / imageAspect;
                return new Rect(container.x, container.y + (container.height - height) * 0.5f, container.width, height);
            }

            var width = container.height * imageAspect;
            return new Rect(container.x + (container.width - width) * 0.5f, container.y, width, container.height);
        }

        private enum SoftwareImage
        {
            Wizard,
            Setup,
            SetupHighlighted,
            AscanFirst,
            TcgOne,
            AscanSecond,
            TcgTwo,
            AscanThird,
            TcgThree,
            BackwallTcg,
            Save
        }

        private readonly struct TrainingStep
        {
            public TrainingStep(
                string title,
                string goal,
                string action,
                string watchPoint,
                string sceneCue,
                int stage,
                float progress,
                bool positiveDirection,
                bool playScan,
                float cameraYaw,
                float cameraPitch,
                float cameraDistance,
                Vector3 cameraOffset,
                SoftwareImage softwareImage,
                string softwareInstruction,
                string softwareClickLabel,
                Rect softwareMarker)
            {
                Title = title;
                Goal = goal;
                Action = action;
                WatchPoint = watchPoint;
                SceneCue = sceneCue;
                Stage = stage;
                Progress = progress;
                PositiveDirection = positiveDirection;
                PlayScan = playScan;
                CameraYaw = cameraYaw;
                CameraPitch = cameraPitch;
                CameraDistance = cameraDistance;
                CameraOffset = cameraOffset;
                SoftwareImage = softwareImage;
                SoftwareInstruction = softwareInstruction;
                SoftwareClickLabel = softwareClickLabel;
                SoftwareMarker = softwareMarker;
            }

            public string Title { get; }
            public string Goal { get; }
            public string Action { get; }
            public string WatchPoint { get; }
            public string SceneCue { get; }
            public int Stage { get; }
            public float Progress { get; }
            public bool PositiveDirection { get; }
            public bool PlayScan { get; }
            public float CameraYaw { get; }
            public float CameraPitch { get; }
            public float CameraDistance { get; }
            public Vector3 CameraOffset { get; }
            public SoftwareImage SoftwareImage { get; }
            public string SoftwareInstruction { get; }
            public string SoftwareClickLabel { get; }
            public Rect SoftwareMarker { get; }
        }

        private readonly struct SoftwareStep
        {
            public SoftwareStep(Texture2D image, string instruction, string clickLabel, Rect marker)
            {
                Image = image;
                Instruction = instruction;
                ClickLabel = clickLabel;
                Marker = marker;
            }

            public Texture2D Image { get; }
            public string Instruction { get; }
            public string ClickLabel { get; }
            public Rect Marker { get; }
        }
    }
}
