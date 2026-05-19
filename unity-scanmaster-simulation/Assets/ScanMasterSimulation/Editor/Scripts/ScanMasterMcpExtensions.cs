// =========================================================================
// ScanMasterMcpExtensions
//
// Extends the existing ScanMasterMcpBridge with the additional commands the
// external video-capture pipeline needs to drive the simulation:
//
//   screenshot         { path, width?, height?, gameView?, supersampling? }
//   drive_step         { index, autoPlay?, autoDirectScene? }
//   set_part_stage     { stage: 1|2 }
//   set_scan_progress  { progress: 0..1, snap?: bool }
//   set_play           { playing: bool }
//   set_guide_visible  { showGuide?, showProcedureData? }
//   set_camera         { yaw, pitch, distance, focusX, focusY, focusZ }
//   set_time_scale     { value }
//   list_steps         (returns titles + camera params of all 17 steps)
//
// Implementation notes:
//   * The original ScanMasterMcpBridge has its switch hardcoded — rather than
//     fork it we register additional commands by patching its dispatch table
//     via Reflection-friendly entry points (we expose a static
//     HandleExtendedCommand the bridge could call). Because the existing
//     bridge cannot be modified without re-compile (and we want zero risk to
//     the running server), this file ALSO exposes its own minimal listener on
//     port 17778 — the capture pipeline uses both ports.
//
//     Port 17777 → original commands (status, list_scene_objects, …)
//     Port 17778 → extended commands defined here.
//
//   * Both servers share the editor main thread via the same pumping pattern.
// =========================================================================
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace ScanMaster.UnitySimulation.Editor
{
    [InitializeOnLoad]
    public static class ScanMasterMcpExtensions
    {
        private const int Port = 17778;
        private const int RequestTimeoutMs = 60000;

        private static readonly ConcurrentQueue<PendingExtCmd> Pending = new ConcurrentQueue<PendingExtCmd>();
        private static TcpListener listener;
        private static Thread listenerThread;
        private static volatile bool running;

        static ScanMasterMcpExtensions()
        {
            EditorApplication.update += Pump;
            StartServer();
        }

        [MenuItem("Scan Master/MCP/Start Extensions")]
        public static void StartServer()
        {
            if (running)
            {
                Debug.Log("Scan Master MCP Extensions already running on :" + Port);
                return;
            }
            try
            {
                listener = new TcpListener(IPAddress.Loopback, Port);
                listener.Start();
                running = true;
                listenerThread = new Thread(ListenLoop)
                {
                    IsBackground = true,
                    Name = "ScanMasterMcpExtensions"
                };
                listenerThread.Start();
                Debug.Log("Scan Master MCP Extensions listening on http://127.0.0.1:" + Port);
            }
            catch (Exception ex)
            {
                running = false;
                Debug.LogWarning("Scan Master MCP Extensions failed: " + ex.Message);
            }
        }

        [MenuItem("Scan Master/MCP/Stop Extensions")]
        public static void StopServer()
        {
            running = false;
            try { listener?.Stop(); } catch (Exception) { }
            listener = null;
            listenerThread = null;
            Debug.Log("Scan Master MCP Extensions stopped.");
        }

        private static void ListenLoop()
        {
            while (running)
            {
                try
                {
                    using (var client = listener.AcceptTcpClient())
                    {
                        client.ReceiveTimeout = RequestTimeoutMs;
                        client.SendTimeout = RequestTimeoutMs;
                        HandleClient(client);
                    }
                }
                catch (SocketException) { if (running) Thread.Sleep(100); }
                catch (ObjectDisposedException) { break; }
                catch (Exception ex)
                {
                    Debug.LogWarning("MCP Extensions listener error: " + ex.Message);
                }
            }
        }

        private static void HandleClient(TcpClient client)
        {
            var stream = client.GetStream();
            if (!ReadHttpRequest(stream, out var method, out var path, out var body))
            {
                WriteHttp(stream, 400, "{\"ok\":false,\"message\":\"Bad request\"}");
                return;
            }
            if (method == "GET" && path == "/health")
            {
                WriteHttp(stream, 200, "{\"ok\":true,\"message\":\"MCP Extensions up\",\"data\":{\"url\":\"http://127.0.0.1:" + Port + "\"}}");
                return;
            }
            if (method != "POST" || path != "/command")
            {
                WriteHttp(stream, 404, "{\"ok\":false,\"message\":\"Unknown endpoint\"}");
                return;
            }
            var cmd = JsonUtility.FromJson<ExtCommand>(body);
            if (cmd == null || string.IsNullOrWhiteSpace(cmd.command))
            {
                WriteHttp(stream, 400, "{\"ok\":false,\"message\":\"Missing command\"}");
                return;
            }
            var p = new PendingExtCmd(cmd);
            Pending.Enqueue(p);
            if (!p.Done.WaitOne(RequestTimeoutMs))
            {
                WriteHttp(stream, 504, "{\"ok\":false,\"message\":\"Command timed out\"}");
                return;
            }
            WriteHttp(stream, p.HttpStatus, p.ResponseJson);
        }

        // ------------------- HTTP helpers (mirrored from main bridge) -------------------
        private static bool ReadHttpRequest(NetworkStream stream, out string method, out string path, out string body)
        {
            method = ""; path = ""; body = "";
            var buffer = new byte[8192];
            var bytes = new List<byte>(8192);
            var headerEnd = -1;
            while (headerEnd < 0)
            {
                var read = stream.Read(buffer, 0, buffer.Length);
                if (read <= 0) return false;
                for (var i = 0; i < read; i++) bytes.Add(buffer[i]);
                headerEnd = IndexOfHeaderEnd(bytes);
                if (bytes.Count > 128 * 1024) return false;
            }
            var headerText = Encoding.ASCII.GetString(bytes.GetRange(0, headerEnd).ToArray());
            var lines = headerText.Split(new[] { "\r\n" }, StringSplitOptions.None);
            if (lines.Length == 0) return false;
            var first = lines[0].Split(' ');
            if (first.Length < 2) return false;
            method = first[0].ToUpperInvariant();
            path = first[1];
            var contentLength = 0;
            for (var i = 1; i < lines.Length; i++)
            {
                var line = lines[i];
                var colon = line.IndexOf(':');
                if (colon <= 0) continue;
                var key = line.Substring(0, colon).Trim();
                var value = line.Substring(colon + 1).Trim();
                if (string.Equals(key, "Content-Length", StringComparison.OrdinalIgnoreCase))
                    int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out contentLength);
            }
            var bodyStart = headerEnd + 4;
            while (bytes.Count - bodyStart < contentLength)
            {
                var read = stream.Read(buffer, 0, buffer.Length);
                if (read <= 0) return false;
                for (var i = 0; i < read; i++) bytes.Add(buffer[i]);
            }
            if (contentLength > 0)
                body = Encoding.UTF8.GetString(bytes.GetRange(bodyStart, contentLength).ToArray());
            return true;
        }
        private static int IndexOfHeaderEnd(IReadOnlyList<byte> bytes)
        {
            for (var i = 3; i < bytes.Count; i++)
                if (bytes[i - 3] == '\r' && bytes[i - 2] == '\n' && bytes[i - 1] == '\r' && bytes[i] == '\n')
                    return i - 3;
            return -1;
        }
        private static void WriteHttp(Stream stream, int status, string json)
        {
            var payload = Encoding.UTF8.GetBytes(json);
            var header = "HTTP/1.1 " + status + " OK\r\n" +
                "Content-Type: application/json; charset=utf-8\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Content-Length: " + payload.Length.ToString(CultureInfo.InvariantCulture) + "\r\n" +
                "Connection: close\r\n\r\n";
            var hb = Encoding.ASCII.GetBytes(header);
            stream.Write(hb, 0, hb.Length);
            stream.Write(payload, 0, payload.Length);
        }

        // ------------------- Pump (editor main thread) -------------------
        private static void Pump()
        {
            while (Pending.TryDequeue(out var p))
            {
                try { p.ResponseJson = Execute(p.Cmd, out p.HttpStatus); }
                catch (Exception ex)
                {
                    p.HttpStatus = 500;
                    p.ResponseJson = Resp(false, ex.GetType().Name + ": " + ex.Message, "{}");
                }
                finally { p.Done.Set(); }
            }
        }

        // ------------------- Command dispatcher -------------------
        private static string Execute(ExtCommand cmd, out int httpStatus)
        {
            httpStatus = 200;
            switch (cmd.command)
            {
                case "screenshot": return DoScreenshot(cmd);
                case "drive_step": return DoDriveStep(cmd);
                case "set_part_stage": return DoSetPart(cmd);
                case "set_scan_progress": return DoSetProgress(cmd);
                case "set_play": return DoSetPlay(cmd);
                case "set_guide_visible": return DoSetGuideVisible(cmd);
                case "set_camera": return DoSetCamera(cmd);
                case "set_time_scale": return DoSetTimeScale(cmd);
                case "list_steps": return DoListSteps();
                case "get_state": return DoGetState();
                case "set_camera_transform": return DoSetCameraTransform(cmd);
                case "set_orbit_enabled": return DoSetOrbitEnabled(cmd);
                case "render_offline": return DoRenderOffline(cmd);
                case "set_lighting": return DoSetLighting(cmd);
                default:
                    httpStatus = 400;
                    return Resp(false, "Unknown command: " + cmd.command, "{}");
            }
        }

        // -- Screenshot
        private static string DoScreenshot(ExtCommand cmd)
        {
            var dst = string.IsNullOrWhiteSpace(cmd.path)
                ? Path.Combine(Application.dataPath, "..", "Builds", "frame.png")
                : cmd.path;
            var w = cmd.width <= 0 ? 1920 : cmd.width;
            var h = cmd.height <= 0 ? 1080 : cmd.height;
            var ss = cmd.supersampling <= 0 ? 1 : cmd.supersampling;
            var dir = Path.GetDirectoryName(dst);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);

            var cam = Camera.main ?? UnityEngine.Object.FindFirstObjectByType<Camera>();
            if (cam == null) return Resp(false, "No camera found", "{}");

            var rt = new RenderTexture(w * ss, h * ss, 24, RenderTextureFormat.ARGB32);
            rt.antiAliasing = 4;
            var prev = cam.targetTexture;
            cam.targetTexture = rt;
            cam.Render();
            RenderTexture.active = rt;
            var tex = new Texture2D(rt.width, rt.height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
            tex.Apply();
            cam.targetTexture = prev;
            RenderTexture.active = null;

            if (ss > 1)
            {
                var down = ResizeTexture(tex, w, h);
                UnityEngine.Object.DestroyImmediate(tex);
                tex = down;
            }
            File.WriteAllBytes(dst, tex.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(tex);
            rt.Release();
            UnityEngine.Object.DestroyImmediate(rt);

            return Resp(true, "Screenshot written", "{\"path\":\"" + Escape(dst) + "\",\"width\":" + w + ",\"height\":" + h + "}");
        }

        private static Texture2D ResizeTexture(Texture2D src, int newW, int newH)
        {
            var rt = RenderTexture.GetTemporary(newW, newH);
            rt.filterMode = FilterMode.Trilinear;
            Graphics.Blit(src, rt);
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var dst = new Texture2D(newW, newH, TextureFormat.RGB24, false);
            dst.ReadPixels(new Rect(0, 0, newW, newH), 0, 0);
            dst.Apply();
            RenderTexture.active = prev;
            RenderTexture.ReleaseTemporary(rt);
            return dst;
        }

        // -- TrainingGuide step
        private static string DoDriveStep(ExtCommand cmd)
        {
            var guide = FindRuntimeComponent("ScanMasterTrainingGuide");
            if (guide == null) return Resp(false, "TrainingGuide not in scene", "{}");
            // Reflection — TrainingGuide is in runtime assembly, not directly referenced here
            var setStep = guide.GetType().GetMethod("SetStep", BindingFlags.Public | BindingFlags.Instance);
            if (setStep == null) return Resp(false, "TrainingGuide.SetStep not found", "{}");
            setStep.Invoke(guide, new object[] { cmd.index });
            // Force play state to match
            if (cmd.autoPlayOverride)
            {
                var ctrl = FindRuntimeComponent("ScanMasterSimulationController");
                if (ctrl != null)
                {
                    var setPlaying = ctrl.GetType().GetMethod("SetPlaying", BindingFlags.Public | BindingFlags.Instance);
                    setPlaying?.Invoke(ctrl, new object[] { cmd.playing });
                }
            }
            return Resp(true, "Drove step", "{\"index\":" + cmd.index + "}");
        }

        // -- Part stage
        private static string DoSetPart(ExtCommand cmd)
        {
            var sel = FindRuntimeComponent("ScanMasterPartSelector");
            if (sel == null) return Resp(false, "PartSelector not in scene", "{}");
            var m = sel.GetType().GetMethod("SelectStage", BindingFlags.Public | BindingFlags.Instance);
            m?.Invoke(sel, new object[] { cmd.stage });
            return Resp(true, "Stage set", "{\"stage\":" + cmd.stage + "}");
        }

        private static string DoSetProgress(ExtCommand cmd)
        {
            var ctrl = FindRuntimeComponent("ScanMasterSimulationController");
            if (ctrl == null) return Resp(false, "Controller not in scene", "{}");
            var m = ctrl.GetType().GetMethod("SetProgress", BindingFlags.Public | BindingFlags.Instance);
            m?.Invoke(ctrl, new object[] { cmd.progress, cmd.snap, true });
            return Resp(true, "Progress set", "{\"progress\":" + cmd.progress.ToString("0.####", CultureInfo.InvariantCulture) + "}");
        }

        private static string DoSetPlay(ExtCommand cmd)
        {
            var ctrl = FindRuntimeComponent("ScanMasterSimulationController");
            if (ctrl == null) return Resp(false, "Controller not in scene", "{}");
            var m = ctrl.GetType().GetMethod("SetPlaying", BindingFlags.Public | BindingFlags.Instance);
            m?.Invoke(ctrl, new object[] { cmd.playing });
            return Resp(true, "Play state set", "{\"playing\":" + (cmd.playing ? "true" : "false") + "}");
        }

        private static string DoSetGuideVisible(ExtCommand cmd)
        {
            var guide = FindRuntimeComponent("ScanMasterTrainingGuide");
            if (guide == null) return Resp(false, "TrainingGuide not in scene", "{}");
            // Set the private serialized fields via reflection
            SetPrivateField(guide, "showGuide", cmd.showGuide);
            SetPrivateField(guide, "showProcedureData", cmd.showProcedureData);
            return Resp(true, "Guide visibility set",
                "{\"showGuide\":" + (cmd.showGuide ? "true" : "false") +
                ",\"showProcedureData\":" + (cmd.showProcedureData ? "true" : "false") + "}");
        }

        private static string DoSetCamera(ExtCommand cmd)
        {
            var orb = FindRuntimeComponent("ScanMasterCameraOrbit");
            if (orb == null) return Resp(false, "CameraOrbit not in scene", "{}");
            var m = orb.GetType().GetMethod("SetGuidedView", BindingFlags.Public | BindingFlags.Instance);
            m?.Invoke(orb, new object[] {
                cmd.yaw, cmd.pitch, cmd.distance,
                new Vector3(cmd.focusX, cmd.focusY, cmd.focusZ)
            });
            return Resp(true, "Camera set",
                "{\"yaw\":" + cmd.yaw + ",\"pitch\":" + cmd.pitch + ",\"distance\":" + cmd.distance + "}");
        }

        private static string DoSetTimeScale(ExtCommand cmd)
        {
            Time.timeScale = Mathf.Max(0f, cmd.value);
            return Resp(true, "Time scale set", "{\"timeScale\":" + Time.timeScale + "}");
        }

        private static string DoListSteps()
        {
            var guide = FindRuntimeComponent("ScanMasterTrainingGuide");
            if (guide == null) return Resp(false, "TrainingGuide not in scene", "{}");
            // Reflect into the private static Steps[] field
            var stepsField = guide.GetType().GetField("Steps", BindingFlags.NonPublic | BindingFlags.Static);
            if (stepsField == null) return Resp(false, "Steps[] field not found", "{}");
            var arr = (Array)stepsField.GetValue(null);
            var sb = new StringBuilder();
            sb.Append("{\"count\":").Append(arr.Length).Append(",\"steps\":[");
            for (var i = 0; i < arr.Length; i++)
            {
                if (i > 0) sb.Append(',');
                var step = arr.GetValue(i);
                var t = step.GetType();
                sb.Append('{');
                sb.Append("\"index\":").Append(i).Append(',');
                AppendStringProp(sb, "Title", step, t);
                AppendStringProp(sb, "Goal", step, t);
                AppendStringProp(sb, "Action", step, t);
                AppendStringProp(sb, "WatchPoint", step, t);
                AppendStringProp(sb, "SceneCue", step, t);
                AppendIntProp(sb, "Stage", step, t);
                AppendFloatProp(sb, "Progress", step, t);
                AppendBoolProp(sb, "PositiveDirection", step, t);
                AppendBoolProp(sb, "PlayScan", step, t);
                AppendFloatProp(sb, "CameraYaw", step, t);
                AppendFloatProp(sb, "CameraPitch", step, t);
                AppendFloatProp(sb, "CameraDistance", step, t);
                sb.Append("\"end\":true}");
            }
            sb.Append("]}");
            return Resp(true, "Steps", sb.ToString());
        }

        private static void AppendStringProp(StringBuilder sb, string name, object obj, Type t)
        {
            var p = t.GetProperty(name, BindingFlags.Public | BindingFlags.Instance | BindingFlags.NonPublic);
            var v = p != null ? p.GetValue(obj) as string : "";
            sb.Append('"').Append(LowerFirst(name)).Append("\":\"").Append(Escape(v ?? "")).Append("\",");
        }

        private static void AppendIntProp(StringBuilder sb, string name, object obj, Type t)
        {
            var p = t.GetProperty(name, BindingFlags.Public | BindingFlags.Instance | BindingFlags.NonPublic);
            var v = p != null ? Convert.ToInt32(p.GetValue(obj)) : 0;
            sb.Append('"').Append(LowerFirst(name)).Append("\":").Append(v).Append(',');
        }

        private static void AppendFloatProp(StringBuilder sb, string name, object obj, Type t)
        {
            var p = t.GetProperty(name, BindingFlags.Public | BindingFlags.Instance | BindingFlags.NonPublic);
            var v = p != null ? Convert.ToSingle(p.GetValue(obj)) : 0f;
            sb.Append('"').Append(LowerFirst(name)).Append("\":")
              .Append(v.ToString("0.####", CultureInfo.InvariantCulture)).Append(',');
        }

        private static void AppendBoolProp(StringBuilder sb, string name, object obj, Type t)
        {
            var p = t.GetProperty(name, BindingFlags.Public | BindingFlags.Instance | BindingFlags.NonPublic);
            var v = p != null && Convert.ToBoolean(p.GetValue(obj));
            sb.Append('"').Append(LowerFirst(name)).Append("\":").Append(v ? "true" : "false").Append(',');
        }

        private static string LowerFirst(string s)
        {
            if (string.IsNullOrEmpty(s)) return s;
            return char.ToLowerInvariant(s[0]) + s.Substring(1);
        }

        // -- Direct camera transform (bypasses CameraOrbit clamping & drift) --
        private static string DoSetCameraTransform(ExtCommand cmd)
        {
            var cam = Camera.main ?? UnityEngine.Object.FindFirstObjectByType<Camera>();
            if (cam == null) return Resp(false, "No camera found", "{}");
            cam.transform.SetPositionAndRotation(
                new Vector3(cmd.x, cmd.y, cmd.z),
                Quaternion.Euler(cmd.rx, cmd.ry, cmd.rz));
            if (cmd.fov > 0f) cam.fieldOfView = Mathf.Clamp(cmd.fov, 5f, 120f);
            return Resp(true, "Camera transform set",
                "{\"pos\":[" + cmd.x + "," + cmd.y + "," + cmd.z + "]," +
                "\"rot\":[" + cmd.rx + "," + cmd.ry + "," + cmd.rz + "]," +
                "\"fov\":" + cam.fieldOfView + "}");
        }

        private static string DoSetOrbitEnabled(ExtCommand cmd)
        {
            var orb = FindRuntimeComponent("ScanMasterCameraOrbit") as MonoBehaviour;
            if (orb == null) return Resp(false, "CameraOrbit not in scene", "{}");
            orb.enabled = cmd.enabled;
            return Resp(true, "Orbit enabled set", "{\"enabled\":" + (cmd.enabled ? "true" : "false") + "}");
        }

        // -- One-shot offline render: optionally set everything atomically and capture --
        private static string DoRenderOffline(ExtCommand cmd)
        {
            // Optional state setup before render
            if (cmd.setCamera)
            {
                var cam = Camera.main ?? UnityEngine.Object.FindFirstObjectByType<Camera>();
                if (cam != null)
                {
                    cam.transform.SetPositionAndRotation(
                        new Vector3(cmd.x, cmd.y, cmd.z),
                        Quaternion.Euler(cmd.rx, cmd.ry, cmd.rz));
                    if (cmd.fov > 0f) cam.fieldOfView = Mathf.Clamp(cmd.fov, 5f, 120f);
                }
            }
            if (cmd.setProgress)
            {
                var ctrl = FindRuntimeComponent("ScanMasterSimulationController");
                ctrl?.GetType().GetMethod("SetProgress", BindingFlags.Public | BindingFlags.Instance)
                    ?.Invoke(ctrl, new object[] { cmd.progress, true, true });
            }
            if (cmd.setStage)
            {
                var sel = FindRuntimeComponent("ScanMasterPartSelector");
                sel?.GetType().GetMethod("SelectStage", BindingFlags.Public | BindingFlags.Instance)
                    ?.Invoke(sel, new object[] { cmd.stage });
            }
            return DoScreenshot(cmd);
        }

        // -- Tweak scene lighting (Key Light intensity + ambient)
        private static string DoSetLighting(ExtCommand cmd)
        {
            var lightGO = GameObject.Find(string.IsNullOrWhiteSpace(cmd.path) ? "Key Light" : cmd.path);
            if (lightGO == null) return Resp(false, "Light not found: " + cmd.path, "{}");
            var light = lightGO.GetComponent<Light>();
            if (light == null) return Resp(false, "GameObject has no Light component", "{}");
            if (cmd.value > 0) light.intensity = cmd.value;
            return Resp(true, "Lighting updated", "{\"intensity\":" + light.intensity + "}");
        }

        private static string DoGetState()
        {
            var ctrl = FindRuntimeComponent("ScanMasterSimulationController");
            var sel = FindRuntimeComponent("ScanMasterPartSelector");
            var guide = FindRuntimeComponent("ScanMasterTrainingGuide");
            var sb = new StringBuilder();
            sb.Append('{');
            sb.Append("\"isPlaying\":").Append(EditorApplication.isPlaying ? "true" : "false").Append(',');
            sb.Append("\"isPaused\":").Append(EditorApplication.isPaused ? "true" : "false").Append(',');
            if (ctrl != null)
            {
                var t = ctrl.GetType();
                var progress = (float)(t.GetProperty("Progress")?.GetValue(ctrl) ?? 0f);
                var playing = (bool)(t.GetProperty("IsPlaying")?.GetValue(ctrl) ?? false);
                sb.Append("\"progress\":").Append(progress.ToString("0.####", CultureInfo.InvariantCulture)).Append(',');
                sb.Append("\"controllerPlaying\":").Append(playing ? "true" : "false").Append(',');
            }
            if (sel != null)
            {
                var t = sel.GetType();
                var stage = (int)(t.GetProperty("ActiveStage")?.GetValue(sel) ?? 0);
                sb.Append("\"activeStage\":").Append(stage).Append(',');
            }
            if (guide != null)
            {
                var t = guide.GetType();
                var idx = (int)(t.GetProperty("CurrentStepIndex")?.GetValue(guide) ?? -1);
                var count = (int)(t.GetProperty("StepCount")?.GetValue(guide) ?? 0);
                sb.Append("\"currentStep\":").Append(idx).Append(',');
                sb.Append("\"stepCount\":").Append(count).Append(',');
            }
            sb.Append("\"sceneName\":\"").Append(Escape(SceneManager.GetActiveScene().name)).Append("\"");
            sb.Append('}');
            return Resp(true, "State", sb.ToString());
        }

        // ------------------- Reflection helpers -------------------
        private static UnityEngine.Object FindRuntimeComponent(string typeName)
        {
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                var t = asm.GetType("ScanMaster.UnitySimulation." + typeName, false);
                if (t == null) continue;
                return UnityEngine.Object.FindFirstObjectByType(t);
            }
            return null;
        }

        private static void SetPrivateField(object obj, string name, object value)
        {
            var f = obj.GetType().GetField(name, BindingFlags.NonPublic | BindingFlags.Instance);
            f?.SetValue(obj, value);
        }

        private static void AppendStringField(StringBuilder sb, string name, object obj, Type t)
        {
            var f = t.GetField(name, BindingFlags.NonPublic | BindingFlags.Instance);
            if (f == null) f = t.GetField(name, BindingFlags.Public | BindingFlags.Instance);
            var v = f != null ? f.GetValue(obj) as string : "";
            sb.Append('"').Append(name).Append("\":\"").Append(Escape(v ?? "")).Append("\",");
        }

        private static void AppendIntField(StringBuilder sb, string name, object obj, Type t)
        {
            var f = t.GetField(name, BindingFlags.NonPublic | BindingFlags.Instance);
            if (f == null) f = t.GetField(name, BindingFlags.Public | BindingFlags.Instance);
            var v = f != null ? Convert.ToInt32(f.GetValue(obj)) : 0;
            sb.Append('"').Append(name).Append("\":").Append(v).Append(',');
        }

        private static void AppendFloatField(StringBuilder sb, string name, object obj, Type t)
        {
            var f = t.GetField(name, BindingFlags.NonPublic | BindingFlags.Instance);
            if (f == null) f = t.GetField(name, BindingFlags.Public | BindingFlags.Instance);
            var v = f != null ? Convert.ToSingle(f.GetValue(obj)) : 0f;
            sb.Append('"').Append(name).Append("\":").Append(v.ToString("0.####", CultureInfo.InvariantCulture)).Append(',');
        }

        private static string Resp(bool ok, string message, string data)
        {
            return "{\"ok\":" + (ok ? "true" : "false") +
                   ",\"message\":\"" + Escape(message) + "\"," +
                   "\"data\":" + (string.IsNullOrWhiteSpace(data) ? "{}" : data) + "}";
        }

        private static string Escape(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r")
                    .Replace("\n", "\\n").Replace("\t", "\\t");
        }

        [Serializable]
        private sealed class ExtCommand
        {
            public string command;
            public string path;
            public int width;
            public int height;
            public int supersampling = 1;
            public int index;
            public int stage = 1;
            public float progress;
            public bool snap = true;
            public bool playing;
            public bool autoPlayOverride;
            public bool showGuide;
            public bool showProcedureData;
            public float yaw;
            public float pitch;
            public float distance;
            public float focusX;
            public float focusY;
            public float focusZ;
            public float value;
            // Direct camera control + render_offline
            public float x;
            public float y;
            public float z;
            public float rx;
            public float ry;
            public float rz;
            public float fov;
            public bool enabled;
            public bool setCamera;
            public bool setProgress;
            public bool setStage;
        }

        private sealed class PendingExtCmd
        {
            public readonly ExtCommand Cmd;
            public readonly ManualResetEvent Done = new ManualResetEvent(false);
            public string ResponseJson = "{\"ok\":false,\"message\":\"No response\",\"data\":{}}";
            public int HttpStatus = 200;
            public PendingExtCmd(ExtCommand cmd) { Cmd = cmd; }
        }
    }
}
