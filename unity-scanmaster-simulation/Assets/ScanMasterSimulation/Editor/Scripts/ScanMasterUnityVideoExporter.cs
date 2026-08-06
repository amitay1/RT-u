using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using ScanMaster.UnitySimulation;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using Debug = UnityEngine.Debug;

namespace ScanMaster.UnitySimulation.Editor
{
    public static class ScanMasterUnityVideoExporter
    {
        private const string ScenePath = "Assets/ScanMasterSimulation/Scenes/ScanMasterImmersionDemo.unity";
        private const string FrameDirectoryDefault = "../../tmp/unity-v2500-cinematic/frames";
        private const string OutputDefault = "../../public/videos/v2500-hpt-disk-unity-cinematic-training-v1.mp4";
        private const string ThumbDefault = "../../public/videos/v2500-hpt-disk-unity-cinematic-training-v1-thumb.jpg";
        private const string AudioDefault = "../../tmp/v2500-realmodel/v5_english_narration_48k.wav";

        private static readonly string[] ZoneOrder = { "E", "A", "B", "C", "D" };

        private static readonly Dictionary<string, ZoneCue> ZoneCues = new Dictionary<string, ZoneCue>
        {
            { "E", new ZoneCue("E", "Upper Web Transition", new Color(1.0f, 0.25f, 0.42f), 0.18f, 0.37f) },
            { "A", new ZoneCue("A", "Upper Chamfer", new Color(1.0f, 0.78f, 0.08f), 0.14f, 0.35f) },
            { "B", new ZoneCue("B", "Upper Land", new Color(0.05f, 0.95f, 0.45f), 0.115f, 0.335f) },
            { "C", new ZoneCue("C", "Bore Entry Chamfer", new Color(0.0f, 0.78f, 1.0f), 0.092f, 0.315f) },
            { "D", new ZoneCue("D", "Bore ID Wall", new Color(0.68f, 0.38f, 1.0f), 0.072f, 0.30f) },
        };

        [MenuItem("Scan Master/Render Unity Cinematic Training Video")]
        public static void RenderUnityCinematicTrainingVideo()
        {
            var width = ReadIntArg("-smWidth", 1920);
            var height = ReadIntArg("-smHeight", 1080);
            var fps = ReadIntArg("-smFps", 24);
            var duration = ReadFloatArg("-smDuration", 104f);
            var startTime = ReadFloatArg("-smStartTime", 0f);
            var supersample = ReadIntArg("-smSupersample", 1);
            var frameOffset = ReadIntArg("-smFrameOffset", 0);
            var keepFrames = ReadBoolArg("-smKeepFrames", false);
            var skipEncode = ReadBoolArg("-smSkipEncode", false);
            var frameDirectory = FullPath(ReadStringArg("-smFrameDir", FrameDirectoryDefault));
            var output = FullPath(ReadStringArg("-smOutput", OutputDefault));
            var thumb = FullPath(ReadStringArg("-smThumb", ThumbDefault));
            var audio = FullPath(ReadStringArg("-smAudio", AudioDefault));
            var frameCount = Mathf.CeilToInt(duration * fps);

            if (!keepFrames)
            {
                PrepareFrameDirectory(frameDirectory);
            }
            else
            {
                Directory.CreateDirectory(frameDirectory);
            }

            ScanMasterSceneBuilder.BuildSimulationScene();
            EditorSceneManager.OpenScene(ScenePath);

            var context = PrepareScene(width, height);
            RenderFrames(context, frameDirectory, width, height, supersample, fps, startTime, duration, frameCount, frameOffset);
            if (!skipEncode)
            {
                EncodeVideo(frameDirectory, output, thumb, audio, fps, frameCount, duration);
            }

            Debug.Log("Scan Master: Unity cinematic video exported to " + output);
        }

        [MenuItem("Scan Master/Render Unity Cinematic Live Segment Frames")]
        public static void RenderUnityCinematicLiveSegmentFrames()
        {
            const int width = 1920;
            const int height = 1080;
            const int fps = 24;
            const float startTime = 64f;
            const float duration = 40f;
            const int supersample = 1;

            var frameDirectory = FullPath(FrameDirectoryDefault);
            Directory.CreateDirectory(frameDirectory);

            ScanMasterSceneBuilder.BuildSimulationScene();
            EditorSceneManager.OpenScene(ScenePath);

            var context = PrepareScene(width, height);
            var frameCount = Mathf.CeilToInt(duration * fps);
            var frameOffset = Mathf.RoundToInt(startTime * fps);
            RenderFrames(context, frameDirectory, width, height, supersample, fps, startTime, duration, frameCount, frameOffset);

            Debug.Log("Scan Master: Unity cinematic live segment frames refreshed in " + frameDirectory);
        }

        private static RenderContext PrepareScene(int width, int height)
        {
            QualitySettings.antiAliasing = 8;
            QualitySettings.anisotropicFiltering = AnisotropicFiltering.ForceEnable;
            QualitySettings.pixelLightCount = 8;
            QualitySettings.shadowResolution = ShadowResolution.VeryHigh;
            QualitySettings.shadows = ShadowQuality.All;
            QualitySettings.vSyncCount = 0;

            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.08f, 0.12f, 0.18f);
            RenderSettings.ambientEquatorColor = new Color(0.035f, 0.055f, 0.08f);
            RenderSettings.ambientGroundColor = new Color(0.012f, 0.014f, 0.018f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = new Color(0.03f, 0.045f, 0.06f);
            RenderSettings.fogDensity = 0.018f;

            var root = GameObject.Find("Scan Master Immersion Simulation");
            if (root == null)
            {
                throw new InvalidOperationException("Simulation root was not found after scene build.");
            }

            var enhancer = root.GetComponent<ScanMasterCinematicEnhancer>();
            if (enhancer == null)
            {
                enhancer = root.AddComponent<ScanMasterCinematicEnhancer>();
            }
            enhancer.Apply();

            foreach (var guide in UnityEngine.Object.FindObjectsByType<ScanMasterTrainingGuide>())
            {
                guide.enabled = false;
            }

            foreach (var orbit in UnityEngine.Object.FindObjectsByType<ScanMasterCameraOrbit>())
            {
                orbit.enabled = false;
            }

            var selector = UnityEngine.Object.FindAnyObjectByType<ScanMasterPartSelector>();
            selector?.SelectStage(1);
            SetObjectActive("Planned Bore Scan Path", false);
            SetObjectActive("Live Scan Trace", false);
            SetObjectActive("Synthetic Training Indication Marker", false);
            SetObjectActive("Stage 1 Training Zone Guide", false);
            SetObjectActive("Stage 2 Training Zone Guide", false);

            var camera = Camera.main;
            if (camera == null)
            {
                camera = UnityEngine.Object.FindAnyObjectByType<Camera>();
            }
            if (camera == null)
            {
                var cameraObject = new GameObject("Main Camera");
                cameraObject.tag = "MainCamera";
                camera = cameraObject.AddComponent<Camera>();
            }

            camera.allowHDR = true;
            camera.allowMSAA = true;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.018f, 0.026f, 0.036f);
            camera.nearClipPlane = 0.015f;
            camera.farClipPlane = 70f;
            camera.depthTextureMode = DepthTextureMode.Depth;
            camera.aspect = width / (float)height;

            var stage1 = GameObject.Find("P&W V2500-A5 0765 / Stage 1");
            ScanMasterZoneSurfaceOverlay overlay = null;
            if (stage1 != null)
            {
                overlay = stage1.GetComponent<ScanMasterZoneSurfaceOverlay>();
                if (overlay == null)
                {
                    overlay = stage1.AddComponent<ScanMasterZoneSurfaceOverlay>();
                }
            }
            overlay?.Rebuild();

            CreateReflectionProbe();
            AddSoftFloorGrid();

            return new RenderContext
            {
                Root = root,
                Camera = camera,
                Controller = UnityEngine.Object.FindAnyObjectByType<ScanMasterSimulationController>(),
                ScanPath = UnityEngine.Object.FindAnyObjectByType<ScanMasterScanPath>(),
                Trail = UnityEngine.Object.FindAnyObjectByType<ScanMasterScanTrail>(),
                Turntable = GameObject.Find("Turntable")?.transform,
                ProbeMount = GameObject.Find("Probe Mount")?.transform,
                ZoneOverlay = overlay,
                Hud = new CameraHud(camera)
            };
        }

        private static void RenderFrames(
            RenderContext context,
            string frameDirectory,
            int width,
            int height,
            int supersample,
            int fps,
            float startTime,
            float duration,
            int frameCount,
            int frameOffset)
        {
            var renderWidth = width * Mathf.Max(1, supersample);
            var renderHeight = height * Mathf.Max(1, supersample);
            var rt = new RenderTexture(renderWidth, renderHeight, 32, RenderTextureFormat.ARGB32)
            {
                antiAliasing = supersample > 1 ? 8 : 4,
                useMipMap = false,
                autoGenerateMips = false
            };

            var previousTarget = context.Camera.targetTexture;
            var previousActive = RenderTexture.active;
            var raw = new Texture2D(renderWidth, renderHeight, TextureFormat.RGB24, false);
            var resized = supersample > 1 ? new Texture2D(width, height, TextureFormat.RGB24, false) : null;

            try
            {
                context.Camera.targetTexture = rt;
                for (var frame = 0; frame < frameCount; frame++)
                {
                    var t = startTime + frame / (float)fps;
                    DriveFrame(context, t, duration);

                    context.Camera.Render();
                    RenderTexture.active = rt;
                    raw.ReadPixels(new Rect(0, 0, renderWidth, renderHeight), 0, 0);
                    raw.Apply(false);

                    var outputTexture = raw;
                    if (supersample > 1 && resized != null)
                    {
                        Downsample(raw, resized);
                        outputTexture = resized;
                    }

                    var bytes = outputTexture.EncodeToJPG(95);
                    var outputFrame = frame + frameOffset;
                    File.WriteAllBytes(Path.Combine(frameDirectory, "frame_" + outputFrame.ToString("00000", CultureInfo.InvariantCulture) + ".jpg"), bytes);

                    if (frame % Math.Max(1, fps * 5) == 0)
                    {
                        Debug.Log("Scan Master Unity render: frame " + frame + " / " + frameCount);
                    }
                }
            }
            finally
            {
                context.Camera.targetTexture = previousTarget;
                RenderTexture.active = previousActive;
                UnityEngine.Object.DestroyImmediate(raw);
                if (resized != null)
                {
                    UnityEngine.Object.DestroyImmediate(resized);
                }

                rt.Release();
                UnityEngine.Object.DestroyImmediate(rt);
            }
        }

        private static void DriveFrame(RenderContext context, float t, float duration)
        {
            var zoneId = ActiveZoneAt(t);
            var zone = ZoneCues[zoneId];
            var live = t >= 64f && t < 91f;
            var anatomy = t >= 46f && t < 64f;

            if (context.ScanPath != null)
            {
                context.ScanPath.PositiveDirection = DirectionAt(t);
                context.ScanPath.ScanRadiusMeters = zone.ScanRadiusMeters;
                context.ScanPath.StartHeightMeters = zone.ScanHeightMeters;
                context.ScanPath.ScanLengthMeters = zone.Id == "E" ? 0.11f : 0.085f;
                context.ScanPath.Revolutions = 1.25f;
                context.ScanPath.ProbeStandOffMeters = 0.038f;
            }

            var progress = ScanProgressAt(t);
            if (context.Controller != null)
            {
                context.Controller.SetPlaying(live);
                context.Controller.SetProgress(progress, true, false);
                context.Controller.SetPlaying(live);
            }

            if (context.Turntable != null)
            {
                var baseAngle = live ? (t - 64f) * 72f : t * 8f;
                context.Turntable.localRotation = Quaternion.Euler(0f, baseAngle, 0f);
            }

            if (context.ZoneOverlay != null)
            {
                if (live)
                {
                    context.ZoneOverlay.SetOnlyActive(zone.Id);
                }
                else if (anatomy)
                {
                    context.ZoneOverlay.SetActiveZone(zone.Id);
                }
                else
                {
                    context.ZoneOverlay.SetVisible(false);
                }
            }

            foreach (var link in UnityEngine.Object.FindObjectsByType<ScanMasterLinkBeam>())
            {
                link.RefreshNow();
            }

            SetCamera(context, t, zone, live);
            context.Hud.Update(t, zone, live);
        }

        private static string ActiveZoneAt(float t)
        {
            if (t < 46f)
            {
                return "E";
            }

            var start = t < 64f ? 46f : 64f;
            var end = t < 64f ? 64f : 91f;
            var u = Mathf.Clamp01((t - start) / Mathf.Max(0.01f, end - start));
            var idx = Mathf.Clamp(Mathf.FloorToInt(u * ZoneOrder.Length), 0, ZoneOrder.Length - 1);
            return ZoneOrder[idx];
        }

        private static bool DirectionAt(float t)
        {
            if (t < 64f)
            {
                return true;
            }

            var perZone = (91f - 64f) / ZoneOrder.Length;
            var local = Mathf.Repeat(t - 64f, perZone) / perZone;
            return local < 0.5f;
        }

        private static float ScanProgressAt(float t)
        {
            if (t < 64f)
            {
                return Mathf.Clamp01(t / 64f) * 0.35f;
            }

            var perZone = (91f - 64f) / ZoneOrder.Length;
            var local = Mathf.Repeat(t - 64f, perZone) / perZone;
            return Mathf.Clamp01(local);
        }

        private static void SetCamera(RenderContext context, float t, ZoneCue zone, bool live)
        {
            var cam = context.Camera;
            Vector3 pos;
            Vector3 target;
            float fov;

            if (t < 7f)
            {
                var u = Ease(t / 7f);
                pos = Vector3.Lerp(new Vector3(1.55f, 0.92f, -1.36f), new Vector3(1.05f, 0.70f, -0.98f), u);
                target = Vector3.Lerp(new Vector3(0f, 0.32f, 0f), new Vector3(0f, 0.34f, 0f), u);
                fov = Mathf.Lerp(31f, 25f, u);
            }
            else if (t < 22f)
            {
                var u = Ease((t - 7f) / 15f);
                pos = Vector3.Lerp(new Vector3(1.05f, 0.70f, -0.98f), new Vector3(0.50f, 0.68f, -0.76f), u);
                target = new Vector3(0f, 0.34f, 0f);
                fov = Mathf.Lerp(25f, 21f, u);
            }
            else if (t < 46f)
            {
                var u = Ease((t - 22f) / 24f);
                pos = Vector3.Lerp(new Vector3(1.85f, 1.08f, -1.45f), new Vector3(0.92f, 0.68f, -0.82f), u);
                target = Vector3.Lerp(new Vector3(0.02f, 0.34f, 0.02f), ProbeOrDefault(context, new Vector3(0.08f, 0.39f, 0f)), u);
                fov = Mathf.Lerp(30f, 22f, u);
            }
            else if (t < 64f)
            {
                var u = Ease((t - 46f) / 18f);
                var side = ZoneCameraSide(zone.Id);
                pos = Vector3.Lerp(new Vector3(0.65f, 0.90f, -0.84f), side, u);
                target = new Vector3(0f, 0.33f, 0f);
                fov = Mathf.Lerp(23f, 18f, u);
            }
            else if (t < 91f)
            {
                var phase = Mathf.Repeat(t - 64f, 5.4f) / 5.4f;
                var angle = Mathf.Lerp(-35f, 45f, Ease(phase)) * Mathf.Deg2Rad;
                var core = new Vector3(0f, 0.34f, 0f);
                var follow = ProbeOrDefault(context, new Vector3(0.07f, 0.35f, 0f));
                pos = core + new Vector3(Mathf.Sin(angle) * 0.92f, 0.46f, -Mathf.Cos(angle) * 0.92f);
                target = Vector3.Lerp(core, follow, 0.22f);
                fov = 20.5f;
            }
            else
            {
                var u = Ease((t - 91f) / 13f);
                pos = Vector3.Lerp(new Vector3(0.95f, 0.78f, -1.05f), new Vector3(2.3f, 1.45f, -2.15f), u);
                target = Vector3.Lerp(new Vector3(0f, 0.34f, 0f), new Vector3(0f, 0.36f, 0f), u);
                fov = Mathf.Lerp(22f, 35f, u);
            }

            var drift = new Vector3(
                Mathf.Sin(t * 0.72f) * 0.01f,
                Mathf.Sin(t * 0.53f + 1.4f) * 0.006f,
                Mathf.Cos(t * 0.61f) * 0.01f);
            pos += drift;
            cam.transform.position = pos;
            cam.transform.rotation = Quaternion.LookRotation(target - pos, Vector3.up);
            cam.fieldOfView = fov;
        }

        private static Vector3 ZoneCameraSide(string zone)
        {
            switch (zone)
            {
                case "E": return new Vector3(0.82f, 0.74f, -0.74f);
                case "A": return new Vector3(0.62f, 0.68f, -0.68f);
                case "B": return new Vector3(0.46f, 0.61f, -0.58f);
                case "C": return new Vector3(0.32f, 0.56f, -0.48f);
                case "D": return new Vector3(0.18f, 0.52f, -0.38f);
                default: return new Vector3(0.72f, 0.72f, -0.7f);
            }
        }

        private static Vector3 ProbeOrDefault(RenderContext context, Vector3 fallback)
        {
            return context.ProbeMount != null ? context.ProbeMount.position : fallback;
        }

        private static float Ease(float value)
        {
            value = Mathf.Clamp01(value);
            return value * value * (3f - 2f * value);
        }

        private static void CreateReflectionProbe()
        {
            var go = GameObject.Find("Cinematic Reflection Probe");
            if (go == null)
            {
                go = new GameObject("Cinematic Reflection Probe");
            }
            go.transform.position = new Vector3(0f, 0.55f, 0f);
            var probe = go.GetComponent<ReflectionProbe>();
            if (probe == null)
            {
                probe = go.AddComponent<ReflectionProbe>();
            }
            probe.mode = ReflectionProbeMode.Realtime;
            probe.refreshMode = ReflectionProbeRefreshMode.OnAwake;
            probe.timeSlicingMode = ReflectionProbeTimeSlicingMode.NoTimeSlicing;
            probe.size = new Vector3(3.5f, 2.2f, 3.0f);
            probe.resolution = 512;
            probe.intensity = 0.75f;
            probe.RenderProbe();
        }

        private static void AddSoftFloorGrid()
        {
            var existing = GameObject.Find("Cinematic Floor Grid");
            if (existing != null)
            {
                return;
            }

            var mat = new Material(Shader.Find("Unlit/Color"));
            mat.color = new Color(0.0f, 0.75f, 1f, 0.18f);
            for (var i = -8; i <= 8; i++)
            {
                CreateGridLine("Cinematic Floor Grid X " + i, new Vector3(i * 0.15f, 0.012f, -1.2f), new Vector3(i * 0.15f, 0.012f, 1.2f), mat);
                CreateGridLine("Cinematic Floor Grid Z " + i, new Vector3(-1.2f, 0.012f, i * 0.15f), new Vector3(1.2f, 0.012f, i * 0.15f), mat);
            }
        }

        private static void SetObjectActive(string name, bool active)
        {
            var go = GameObject.Find(name);
            if (go != null)
            {
                go.SetActive(active);
            }
        }

        private static void CreateGridLine(string name, Vector3 a, Vector3 b, Material mat)
        {
            var go = new GameObject(name);
            var line = go.AddComponent<LineRenderer>();
            line.sharedMaterial = mat;
            line.useWorldSpace = true;
            line.positionCount = 2;
            line.SetPosition(0, a);
            line.SetPosition(1, b);
            line.startWidth = 0.002f;
            line.endWidth = 0.002f;
            line.startColor = mat.color;
            line.endColor = new Color(mat.color.r, mat.color.g, mat.color.b, 0.02f);
        }

        private static void Downsample(Texture2D src, Texture2D dst)
        {
            var rt = RenderTexture.GetTemporary(dst.width, dst.height, 0, RenderTextureFormat.ARGB32);
            var prev = RenderTexture.active;
            Graphics.Blit(src, rt);
            RenderTexture.active = rt;
            dst.ReadPixels(new Rect(0, 0, dst.width, dst.height), 0, 0);
            dst.Apply(false);
            RenderTexture.active = prev;
            RenderTexture.ReleaseTemporary(rt);
        }

        private static void EncodeVideo(string frameDirectory, string output, string thumb, string audio, int fps, int frameCount, float duration)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(output) ?? ".");
            Directory.CreateDirectory(Path.GetDirectoryName(thumb) ?? ".");

            var input = Path.Combine(frameDirectory, "frame_%05d.jpg");
            var hasAudio = File.Exists(audio);
            var args = hasAudio
                ? "-hide_banner -loglevel error -nostdin -y -framerate " + fps + " -i \"" + input + "\" -i \"" + audio + "\" -frames:v " + frameCount +
                  " -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest \"" + output + "\""
                : "-hide_banner -loglevel error -nostdin -y -framerate " + fps + " -i \"" + input + "\" -frames:v " + frameCount +
                  " -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p \"" + output + "\"";
            RunProcess("ffmpeg", args);

            var thumbTime = Mathf.Clamp(duration * 0.55f, 0.1f, Mathf.Max(0.1f, duration - 0.1f));
            var thumbArgs = "-hide_banner -loglevel error -nostdin -y -ss " + thumbTime.ToString("0.###", CultureInfo.InvariantCulture) +
                            " -i \"" + output + "\" -frames:v 1 -q:v 2 \"" + thumb + "\"";
            RunProcess("ffmpeg", thumbArgs);
        }

        private static void RunProcess(string fileName, string args)
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = args,
                    UseShellExecute = false,
                    RedirectStandardError = true,
                    RedirectStandardOutput = false,
                    CreateNoWindow = true
                }
            };
            process.Start();
            var error = process.StandardError.ReadToEnd();
            process.WaitForExit();
            if (process.ExitCode != 0)
            {
                throw new InvalidOperationException(fileName + " failed with exit code " + process.ExitCode + "\n" + error);
            }
        }

        private static void PrepareFrameDirectory(string frameDirectory)
        {
            frameDirectory = Path.GetFullPath(frameDirectory);
            var projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, "..", ".."));
            var tmpRoot = Path.GetFullPath(Path.Combine(projectRoot, "tmp"));
            if (!frameDirectory.StartsWith(tmpRoot, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Refusing to clear frame directory outside tmp: " + frameDirectory);
            }

            if (Directory.Exists(frameDirectory))
            {
                Directory.Delete(frameDirectory, true);
            }

            Directory.CreateDirectory(frameDirectory);
        }

        private static string FullPath(string value)
        {
            return Path.GetFullPath(Path.Combine(Application.dataPath, value));
        }

        private static string ReadStringArg(string name, string fallback)
        {
            var args = Environment.GetCommandLineArgs();
            for (var i = 0; i < args.Length - 1; i++)
            {
                if (string.Equals(args[i], name, StringComparison.OrdinalIgnoreCase))
                {
                    return args[i + 1];
                }
            }

            return fallback;
        }

        private static int ReadIntArg(string name, int fallback)
        {
            var value = ReadStringArg(name, null);
            return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var result) ? result : fallback;
        }

        private static float ReadFloatArg(string name, float fallback)
        {
            var value = ReadStringArg(name, null);
            return float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var result) ? result : fallback;
        }

        private static bool ReadBoolArg(string name, bool fallback)
        {
            var value = ReadStringArg(name, null);
            if (string.IsNullOrEmpty(value))
            {
                return fallback;
            }

            return value == "1" ||
                   value.Equals("true", StringComparison.OrdinalIgnoreCase) ||
                   value.Equals("yes", StringComparison.OrdinalIgnoreCase);
        }

        private sealed class CameraHud
        {
            private readonly Transform root;
            private readonly MeshRenderer topBarRenderer;
            private readonly TextMesh title;
            private readonly TextMesh subtitle;
            private readonly TextMesh zoneLabel;
            private readonly TextMesh actionLabel;
            private readonly MeshRenderer rightPanelRenderer;
            private readonly MeshRenderer imageRenderer;
            private readonly Dictionary<string, Texture2D> images = new Dictionary<string, Texture2D>();

            public CameraHud(Camera camera)
            {
                root = new GameObject("Cinematic Camera HUD").transform;
                root.SetParent(camera.transform, false);
                root.localPosition = Vector3.zero;
                root.localRotation = Quaternion.identity;

                var topBar = CreateQuad("HUD Top Bar", root, new Vector3(0f, 0.49f, 3.0f), new Vector3(1.70f, 0.13f, 1f), new Color(0.01f, 0.018f, 0.025f, 0.58f));
                topBarRenderer = topBar.GetComponent<MeshRenderer>();
                topBarRenderer.enabled = false;
                var rightPanel = CreateQuad("HUD Right Panel", root, new Vector3(0.60f, 0.00f, 3.0f), new Vector3(0.52f, 0.58f, 1f), new Color(0.01f, 0.018f, 0.025f, 0.62f));
                rightPanelRenderer = rightPanel.GetComponent<MeshRenderer>();
                title = CreateText("HUD Title", root, new Vector3(-0.80f, 0.515f, 2.99f), 0.0090f, Color.white, TextAnchor.MiddleLeft);
                subtitle = CreateText("HUD Subtitle", root, new Vector3(-0.80f, 0.465f, 2.99f), 0.0052f, new Color(0.72f, 0.92f, 0.95f), TextAnchor.MiddleLeft);
                zoneLabel = CreateText("HUD Zone Label", root, new Vector3(0.38f, 0.260f, 2.98f), 0.0055f, Color.white, TextAnchor.MiddleLeft);
                actionLabel = CreateText("HUD Action Label", root, new Vector3(0.38f, -0.265f, 2.98f), 0.0041f, new Color(0.90f, 0.95f, 0.95f), TextAnchor.MiddleLeft);

                var imageQuad = CreateQuad("HUD ScanMaster Image", root, new Vector3(0.60f, 0.005f, 2.97f), new Vector3(0.42f, 0.24f, 1f), Color.white);
                imageRenderer = imageQuad.GetComponent<MeshRenderer>();
                imageRenderer.sharedMaterial = new Material(Shader.Find("Unlit/Texture"));
                imageRenderer.sharedMaterial.SetInt("_Cull", (int)CullMode.Off);

                LoadImages();
            }

            public void Update(float t, ZoneCue zone, bool live)
            {
                SectionText(t, zone, live, out var heading, out var sub, out var imageKey, out var action);
                if (topBarRenderer != null)
                {
                    topBarRenderer.enabled = !string.IsNullOrEmpty(heading);
                }

                title.text = TrimSingleLine(heading, 64);
                subtitle.text = TrimSingleLine(sub, 88);
                var showPanel = !string.IsNullOrEmpty(imageKey) || !string.IsNullOrEmpty(action);
                if (rightPanelRenderer != null)
                {
                    rightPanelRenderer.enabled = showPanel;
                }

                var showZoneLabel = showPanel && t >= 46f && t < 91f;
                zoneLabel.text = showZoneLabel ? $"ZONE {zone.Id}\n{zone.Name}" : "";
                zoneLabel.color = zone.Color;
                actionLabel.text = showPanel ? WrapHudText(action, 33, 5) : "";

                if (showPanel && images.TryGetValue(imageKey, out var image))
                {
                    imageRenderer.enabled = true;
                    imageRenderer.sharedMaterial.mainTexture = image;
                }
                else
                {
                    imageRenderer.enabled = false;
                }
            }

            private static string TrimSingleLine(string text, int maxChars)
            {
                if (string.IsNullOrEmpty(text) || text.Length <= maxChars) return text ?? "";
                return text.Substring(0, Mathf.Max(0, maxChars - 3)) + "...";
            }

            private static string WrapHudText(string text, int maxCharsPerLine, int maxLines)
            {
                if (string.IsNullOrEmpty(text)) return "";

                var words = text.Split(' ');
                string result = "";
                string line = "";
                int lineCount = 0;

                for (int i = 0; i < words.Length; i++)
                {
                    string word = words[i];
                    string candidate = string.IsNullOrEmpty(line) ? word : line + " " + word;
                    if (candidate.Length > maxCharsPerLine && !string.IsNullOrEmpty(line))
                    {
                        result += line + "\n";
                        lineCount++;
                        if (lineCount >= maxLines)
                            return result.TrimEnd() + "...";
                        line = word;
                    }
                    else
                    {
                        line = candidate;
                    }
                }

                if (!string.IsNullOrEmpty(line) && lineCount < maxLines)
                    result += line;

                return result.TrimEnd();
            }

            private void LoadImages()
            {
                AddImage("wizard", "Assets/ScanMasterSimulation/TrainingImages/step-03-scanmaster-wizard-menu.png");
                AddImage("setup", "Assets/ScanMasterSimulation/TrainingImages/step-04-setup-toolbox-instrument.png");
                AddImage("setup-hi", "Assets/ScanMasterSimulation/TrainingImages/step-08-setup-toolbox-highlighted.png");
                AddImage("ascan", "Assets/ScanMasterSimulation/TrainingImages/step-10-ascan-first-fbh-peak.png");
                AddImage("tcg", "Assets/ScanMasterSimulation/TrainingImages/step-12-tcg-list-three-nodes-scroll.png");
                AddImage("save", "Assets/ScanMasterSimulation/TrainingImages/step-13-save-tcg-uprdb-navigator.png");
            }

            private void AddImage(string key, string path)
            {
                var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
                if (texture != null)
                {
                    images[key] = texture;
                }
            }

            private static void SectionText(float t, ZoneCue zone, bool live, out string heading, out string sub, out string imageKey, out string action)
            {
                if (t < 7f)
                {
                    heading = "V2500 HPT Disk - Unity real-model training";
                    sub = "Real STL, cinematic camera, surface highlights, English voice-over";
                    imageKey = "";
                    action = "Goal: teach the exact setup and scan behavior, not just show a rotating disk.";
                    return;
                }

                if (t < 22f)
                {
                    heading = "Real geometry plus approved procedure";
                    sub = "The model gives shape. NDIP/ScanMaster define the surfaces.";
                    imageKey = "";
                    action = "Operator action: start from the ScanMaster workflow and verify the loaded program.";
                    return;
                }

                if (t < 34f)
                {
                    heading = "Load the Stage 1 scan plan";
                    sub = "Do not guess coordinates. Load the correct part and NDIP revision.";
                    imageKey = "setup";
                    action = "Click path: Teach In -> Stage 1 plan -> verify part number and revision.";
                    return;
                }

                if (t < 46f)
                {
                    heading = "Calibration before live motion";
                    sub = "FBH #1 to 80% FSH, water path, angle, DAC/TCG.";
                    imageKey = t < 40f ? "ascan" : "tcg";
                    action = "Stop condition: do not press Scan until calibration and TCG are valid.";
                    return;
                }

                if (t < 64f)
                {
                    heading = "Surface anatomy, not random rings";
                    sub = "The active color is drawn on the STL triangles for the selected zone.";
                    imageKey = "";
                    action = "Current surface: Zone " + zone.Id + ". Confirm the same surface exists in the ScanMaster plan.";
                    return;
                }

                if (t < 91f)
                {
                    heading = "Live scan pass - camera follows the probe";
                    sub = "Each zone is scanned in +45 and -45 shear directions.";
                    imageKey = "";
                    action = "Watch: beam entry, footprint, trace density, and C-scan growth. Index <= 0.020 inch.";
                    return;
                }

                heading = "Review, post-cal and save";
                sub = "A good animation is not enough. Prove data quality and traceability.";
                imageKey = "save";
                action = "Review C-scan and TOF, perform post-cal, then save the setup/data record.";
            }

            private static GameObject CreateQuad(string name, Transform parent, Vector3 localPosition, Vector3 localScale, Color color)
            {
                var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
                go.name = name;
                go.transform.SetParent(parent, false);
                go.transform.localPosition = localPosition;
                go.transform.localRotation = Quaternion.identity;
                go.transform.localScale = localScale;
                var collider = go.GetComponent<Collider>();
                if (collider != null)
                {
                    UnityEngine.Object.DestroyImmediate(collider);
                }

                var material = new Material(Shader.Find("Unlit/Color"));
                material.color = color;
                material.SetInt("_Cull", (int)CullMode.Off);
                material.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha);
                material.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
                material.SetInt("_ZWrite", 0);
                material.DisableKeyword("_ALPHATEST_ON");
                material.EnableKeyword("_ALPHABLEND_ON");
                material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
                material.renderQueue = (int)RenderQueue.Transparent + 80;
                var renderer = go.GetComponent<MeshRenderer>();
                renderer.sharedMaterial = material;
                renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                renderer.receiveShadows = false;
                return go;
            }

            private static TextMesh CreateText(string name, Transform parent, Vector3 localPosition, float characterSize, Color color, TextAnchor anchor)
            {
                var go = new GameObject(name);
                go.transform.SetParent(parent, false);
                go.transform.localPosition = localPosition;
                go.transform.localRotation = Quaternion.identity;
                var text = go.AddComponent<TextMesh>();
                text.text = "";
                text.characterSize = characterSize;
                text.fontSize = 96;
                text.anchor = anchor;
                text.alignment = TextAlignment.Left;
                text.color = color;
                var renderer = go.GetComponent<MeshRenderer>();
                if (renderer != null)
                {
                    renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                    renderer.receiveShadows = false;
                }

                return text;
            }
        }

        private sealed class RenderContext
        {
            public GameObject Root;
            public Camera Camera;
            public ScanMasterSimulationController Controller;
            public ScanMasterScanPath ScanPath;
            public ScanMasterScanTrail Trail;
            public Transform Turntable;
            public Transform ProbeMount;
            public ScanMasterZoneSurfaceOverlay ZoneOverlay;
            public CameraHud Hud;
        }

        private readonly struct ZoneCue
        {
            public readonly string Id;
            public readonly string Name;
            public readonly Color Color;
            public readonly float ScanRadiusMeters;
            public readonly float ScanHeightMeters;

            public ZoneCue(string id, string name, Color color, float scanRadiusMeters, float scanHeightMeters)
            {
                Id = id;
                Name = name;
                Color = color;
                ScanRadiusMeters = scanRadiusMeters;
                ScanHeightMeters = scanHeightMeters;
            }
        }
    }
}
