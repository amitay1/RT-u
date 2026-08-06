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
        private static volatile bool delayCallChainArmed;

        static ScanMasterMcpExtensions()
        {
            // Subscribe to MULTIPLE editor callbacks so the Pump keeps running
            // even when EditorApplication.update gets throttled (e.g. when the
            // Unity window loses focus). Each callback drains the queue.
            EditorApplication.update += Pump;
            // Run in background — keeps Update() firing in play mode even
            // without window focus.
            Application.runInBackground = true;
            // Cleanly stop on domain-reload (avoids zombie listener threads)
            AssemblyReloadEvents.beforeAssemblyReload += OnBeforeReload;
            EditorApplication.quitting += OnEditorQuitting;
            // Kick off the delayCall chain — this is the redundant pump that
            // re-arms itself every editor tick. Even if EditorApplication.update
            // is throttled, delayCall fires whenever the editor processes any
            // event (mouse move, network packet, etc.).
            ScheduleDelayCallPump();
            StartServer();
        }

        private static void OnBeforeReload()
        {
            Debug.Log("MCP Extensions: assembly reload — stopping listener");
            StopServer();
        }

        private static void OnEditorQuitting()
        {
            StopServer();
        }

        private static void ScheduleDelayCallPump()
        {
            if (delayCallChainArmed) return;
            delayCallChainArmed = true;
            EditorApplication.delayCall += DelayCallPump;
        }

        private static void DelayCallPump()
        {
            delayCallChainArmed = false;
            try { Pump(); }
            finally
            {
                // Re-arm — keep the chain alive
                if (running) ScheduleDelayCallPump();
            }
        }

        [MenuItem("Scan Master/MCP/Start Extensions")]
        public static void StartServer()
        {
            if (running)
            {
                Debug.Log("Scan Master MCP Extensions already running on :" + Port);
                return;
            }
            // Retry binding with backoff — port may briefly be in TIME_WAIT
            // after a domain reload.
            const int maxAttempts = 5;
            for (int attempt = 1; attempt <= maxAttempts; attempt++)
            {
                try
                {
                    listener = new TcpListener(IPAddress.Loopback, Port);
                    // SO_REUSEADDR — allow re-binding even if previous socket
                    // is still in TIME_WAIT.
                    listener.Server.SetSocketOption(SocketOptionLevel.Socket,
                        SocketOptionName.ReuseAddress, true);
                    listener.Start();
                    running = true;
                    listenerThread = new Thread(ListenLoop)
                    {
                        IsBackground = true,
                        Name = "ScanMasterMcpExtensions"
                    };
                    listenerThread.Start();
                    Debug.Log($"Scan Master MCP Extensions listening on http://127.0.0.1:{Port} (attempt {attempt})");
                    return;
                }
                catch (SocketException ex)
                {
                    Debug.LogWarning($"MCP Extensions bind attempt {attempt} failed: {ex.Message}");
                    if (attempt < maxAttempts) Thread.Sleep(250);
                }
                catch (Exception ex)
                {
                    running = false;
                    Debug.LogWarning("Scan Master MCP Extensions failed: " + ex.Message);
                    return;
                }
            }
            running = false;
            Debug.LogError($"Scan Master MCP Extensions: failed to bind port {Port} after {maxAttempts} attempts");
        }

        [MenuItem("Scan Master/MCP/Stop Extensions")]
        public static void StopServer()
        {
            running = false;
            try { listener?.Stop(); } catch (Exception) { }
            listener = null;
            // Wait briefly for listener thread to actually exit (releases port)
            try
            {
                if (listenerThread != null && listenerThread.IsAlive)
                    listenerThread.Join(500);
            }
            catch (Exception) { }
            listenerThread = null;
            // Drain pending queue so callers don't hang forever
            while (Pending.TryDequeue(out var p))
            {
                p.ResponseJson = Resp(false, "Bridge stopped", "{}");
                p.HttpStatus = 503;
                p.Done.Set();
            }
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
                case "add_component": return DoAddComponent(cmd);
                case "invoke_method": return DoInvokeMethod(cmd);
                case "take_snapshot": return DoTakeSnapshot(cmd);
                case "get_telemetry": return DoGetTelemetry();
                case "start_recording": return DoStartRecording(cmd);
                case "stop_recording": return DoStopRecording();
                case "get_recording_state": return DoGetRecordingState();
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

            var cam = Camera.main ?? UnityEngine.Object.FindAnyObjectByType<Camera>();
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
            var cam = Camera.main ?? UnityEngine.Object.FindAnyObjectByType<Camera>();
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
                var cam = Camera.main ?? UnityEngine.Object.FindAnyObjectByType<Camera>();
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

        // -- Add a component (by full type name) to a GameObject in the scene
        private static string DoAddComponent(ExtCommand cmd)
        {
            var go = string.IsNullOrWhiteSpace(cmd.path)
                ? null
                : GameObject.Find(cmd.path);
            if (go == null) return Resp(false, "GameObject not found: " + cmd.path, "{}");
            var typeName = cmd.objectName;
            if (string.IsNullOrWhiteSpace(typeName))
                return Resp(false, "Missing type name (objectName)", "{}");
            Type t = null;
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                t = asm.GetType(typeName, false);
                if (t != null) break;
                t = asm.GetType("ScanMaster.UnitySimulation." + typeName, false);
                if (t != null) break;
            }
            if (t == null) return Resp(false, "Type not found: " + typeName, "{}");
            // Don't double-add
            var existing = go.GetComponent(t);
            if (existing != null) return Resp(true, "Component already present",
                "{\"existing\":true,\"type\":\"" + Escape(t.FullName) + "\"}");
            var comp = go.AddComponent(t);
            UnityEditor.EditorUtility.SetDirty(go);
            UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(go.scene);
            return Resp(true, "Component added",
                "{\"type\":\"" + Escape(comp.GetType().FullName) + "\",\"sceneDirty\":true}");
        }

        // -- Invoke a public method on a component (no args, or 1 float)
        private static string DoInvokeMethod(ExtCommand cmd)
        {
            var go = string.IsNullOrWhiteSpace(cmd.path)
                ? null
                : GameObject.Find(cmd.path);
            if (go == null) return Resp(false, "GameObject not found: " + cmd.path, "{}");
            var typeName = cmd.objectName;
            Type t = null;
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                t = asm.GetType(typeName, false);
                if (t != null) break;
                t = asm.GetType("ScanMaster.UnitySimulation." + typeName, false);
                if (t != null) break;
            }
            if (t == null) return Resp(false, "Type not found: " + typeName, "{}");
            var comp = go.GetComponent(t);
            if (comp == null) return Resp(false, "Component not on object", "{}");
            var method = t.GetMethod(cmd.name, BindingFlags.Public | BindingFlags.Instance);
            if (method == null) return Resp(false, "Method not found: " + cmd.name, "{}");
            method.Invoke(comp, null);
            return Resp(true, "Method invoked", "{}");
        }

        // -- Recording (PNG sequence)
        private static string DoStartRecording(ExtCommand cmd)
        {
            // Ensure recorder GO + component
            var seqObj = GameObject.Find("Scan Master Immersion Simulation");
            if (seqObj == null) return Resp(false, "Sequencer root not found", "{}");

            var recType = FindRuntimeType("ScanMasterSequenceRecorder");
            if (recType == null) return Resp(false, "Recorder type not loaded yet", "{}");

            var rec = seqObj.GetComponent(recType);
            if (rec == null) rec = seqObj.AddComponent(recType);

            var fps = cmd.width > 0 ? cmd.width : 30;       // reuse width slot as fps
            var w = cmd.height > 0 ? cmd.height : 1920;     // reuse height slot as image w
            var h = cmd.supersampling > 0 ? cmd.supersampling : 1080;
            var dur = cmd.value > 0 ? cmd.value : ScanMasterEducationalSequencer.StoryDurationSeconds;
            var dir = string.IsNullOrWhiteSpace(cmd.path) ? "Recording" : cmd.path;

            var m = recType.GetMethod("StartRecording",
                new[] { typeof(string), typeof(int), typeof(int), typeof(int), typeof(float) });
            if (m == null) return Resp(false, "StartRecording(...) method missing", "{}");
            m.Invoke(rec, new object[] { dir, fps, w, h, dur });

            return Resp(true, "Recording started",
                "{\"fps\":" + fps + ",\"width\":" + w + ",\"height\":" + h +
                ",\"duration\":" + dur + ",\"dir\":\"" + Escape(dir) + "\"}");
        }

        private static string DoStopRecording()
        {
            var recType = FindRuntimeType("ScanMasterSequenceRecorder");
            if (recType == null) return Resp(false, "Recorder type not loaded", "{}");
            var rec = UnityEngine.Object.FindAnyObjectByType(recType);
            if (rec == null) return Resp(false, "Recorder not in scene", "{}");
            recType.GetMethod("StopRecording")?.Invoke(rec, null);
            return Resp(true, "Recording stopped", "{}");
        }

        private static string DoGetRecordingState()
        {
            var recType = FindRuntimeType("ScanMasterSequenceRecorder");
            if (recType == null) return Resp(true, "No recorder loaded",
                "{\"recording\":false,\"frame\":0,\"elapsed\":0,\"total\":0}");
            var rec = UnityEngine.Object.FindAnyObjectByType(recType);
            if (rec == null) return Resp(true, "No recorder in scene",
                "{\"recording\":false,\"frame\":0,\"elapsed\":0,\"total\":0}");
            bool isRec = (bool)(recType.GetProperty("IsRecording")?.GetValue(rec) ?? false);
            int frame = (int)(recType.GetProperty("FrameNumber")?.GetValue(rec) ?? 0);
            float elapsed = (float)(recType.GetProperty("ElapsedSeconds")?.GetValue(rec) ?? 0f);
            float total = (float)(recType.GetProperty("TotalDurationSeconds")?.GetValue(rec) ?? 0f);
            string outDir = (recType.GetProperty("OutputDir")?.GetValue(rec) as string) ?? "";
            return Resp(true, "Recording state",
                "{\"recording\":" + (isRec ? "true" : "false") +
                ",\"frame\":" + frame +
                ",\"elapsed\":" + elapsed.ToString("0.##", CultureInfo.InvariantCulture) +
                ",\"total\":" + total.ToString("0.##", CultureInfo.InvariantCulture) +
                ",\"dir\":\"" + Escape(outDir) + "\"}");
        }

        private static Type FindRuntimeType(string typeName)
        {
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                var t = asm.GetType("ScanMaster.UnitySimulation." + typeName, false);
                if (t != null) return t;
                t = asm.GetType(typeName, false);
                if (t != null) return t;
            }
            return null;
        }

        // -- Take a screenshot AND return full diagnostic state in one atomic call
        // This lets the caller correlate a single PNG with exactly what the
        // sequencer / camera / props looked like at that instant.
        private static string DoTakeSnapshot(ExtCommand cmd)
        {
            // First grab the screenshot (sets DoScreenshot's output path)
            var ssRespJson = DoScreenshot(cmd);
            var telemetry = BuildTelemetryJson();
            // Merge: parse out the screenshot data part and embed telemetry
            // (simple string surgery — keep response shape compatible)
            return Resp(true, "Snapshot captured",
                "{\"screenshot\":" + ssRespJson + ",\"telemetry\":" + telemetry + "}");
        }

        // -- Get full diagnostic snapshot of the running simulation
        private static string DoGetTelemetry()
        {
            return Resp(true, "Telemetry", BuildTelemetryJson());
        }

        // Build a fat JSON blob covering everything useful for debugging
        private static string BuildTelemetryJson()
        {
            var sb = new StringBuilder();
            sb.Append('{');
            // Editor state
            sb.Append("\"isPlaying\":").Append(EditorApplication.isPlaying ? "true" : "false").Append(',');
            sb.Append("\"isPaused\":").Append(EditorApplication.isPaused ? "true" : "false").Append(',');
            sb.Append("\"timeScale\":").Append(Time.timeScale.ToString("0.###", CultureInfo.InvariantCulture)).Append(',');
            sb.Append("\"unscaledTime\":").Append(Time.unscaledTime.ToString("0.##", CultureInfo.InvariantCulture)).Append(',');

            // Camera
            var cam = Camera.main ?? UnityEngine.Object.FindAnyObjectByType<Camera>();
            if (cam != null)
            {
                var p = cam.transform.position;
                var r = cam.transform.eulerAngles;
                sb.Append("\"camera\":{");
                sb.Append("\"posX\":").Append(p.x.ToString("0.###", CultureInfo.InvariantCulture)).Append(',');
                sb.Append("\"posY\":").Append(p.y.ToString("0.###", CultureInfo.InvariantCulture)).Append(',');
                sb.Append("\"posZ\":").Append(p.z.ToString("0.###", CultureInfo.InvariantCulture)).Append(',');
                sb.Append("\"rotX\":").Append(r.x.ToString("0.#", CultureInfo.InvariantCulture)).Append(',');
                sb.Append("\"rotY\":").Append(r.y.ToString("0.#", CultureInfo.InvariantCulture)).Append(',');
                sb.Append("\"rotZ\":").Append(r.z.ToString("0.#", CultureInfo.InvariantCulture)).Append(',');
                sb.Append("\"fov\":").Append(cam.fieldOfView.ToString("0.#", CultureInfo.InvariantCulture));
                sb.Append("},");
            }

            // Sequencer state
            var seq = FindRuntimeComponent("ScanMasterEducationalSequencer");
            if (seq != null)
            {
                var t = seq.GetType();
                int sceneIdx = (int)(t.GetProperty("CurrentSceneIndex")?.GetValue(seq) ?? -1);
                float elapsed = (float)(t.GetProperty("SceneElapsed")?.GetValue(seq) ?? 0f);
                bool isRun = (bool)(t.GetProperty("IsRunning")?.GetValue(seq) ?? false);
                bool autoAdv = (bool)(t.GetProperty("AutoAdvance")?.GetValue(seq) ?? false);
                float speed = (float)(t.GetProperty("GlobalSpeed")?.GetValue(seq) ?? 0f);
                int subIdx = (int)(t.GetProperty("CurrentSubShotIndex")?.GetValue(seq) ?? -1);
                int subCnt = (int)(t.GetProperty("CurrentSubShotCount")?.GetValue(seq) ?? 0);

                // Get scene id + duration from the Story[] array
                string sceneId = "?";
                string sceneTitle = "?";
                float sceneDur = 0f;
                var storyField = t.GetField("Story", BindingFlags.NonPublic | BindingFlags.Static);
                if (storyField != null)
                {
                    var arr = (Array)storyField.GetValue(null);
                    if (sceneIdx >= 0 && sceneIdx < arr.Length)
                    {
                        var entry = arr.GetValue(sceneIdx);
                        var et = entry.GetType();
                        sceneId = (et.GetField("id")?.GetValue(entry) as string) ?? "?";
                        sceneTitle = (et.GetField("title")?.GetValue(entry) as string) ?? "?";
                        sceneDur = (float)(et.GetField("duration")?.GetValue(entry) ?? 0f);
                    }
                }

                sb.Append("\"sequencer\":{");
                sb.Append("\"running\":").Append(isRun ? "true" : "false").Append(',');
                sb.Append("\"autoAdvance\":").Append(autoAdv ? "true" : "false").Append(',');
                sb.Append("\"globalSpeed\":").Append(speed.ToString("0.##", CultureInfo.InvariantCulture)).Append(',');
                sb.Append("\"sceneIndex\":").Append(sceneIdx).Append(',');
                sb.Append("\"sceneId\":\"").Append(Escape(sceneId)).Append("\",");
                sb.Append("\"sceneTitle\":\"").Append(Escape(sceneTitle)).Append("\",");
                sb.Append("\"sceneDuration\":").Append(sceneDur.ToString("0.##", CultureInfo.InvariantCulture)).Append(',');
                sb.Append("\"sceneElapsed\":").Append(elapsed.ToString("0.##", CultureInfo.InvariantCulture)).Append(',');
                sb.Append("\"sceneProgress\":").Append((sceneDur > 0 ? (elapsed / sceneDur) : 0f).ToString("0.###", CultureInfo.InvariantCulture)).Append(',');
                sb.Append("\"subShotIndex\":").Append(subIdx).Append(',');
                sb.Append("\"subShotCount\":").Append(subCnt);
                sb.Append("},");
            }

            // Active "Edu_" props
            sb.Append("\"activeProps\":[");
            bool firstProp = true;
            foreach (var go in GameObject.FindObjectsByType<GameObject>())
            {
                if (go == null || !go.name.StartsWith("Edu_")) continue;
                if (!go.activeInHierarchy) continue;
                if (!firstProp) sb.Append(',');
                firstProp = false;
                sb.Append('"').Append(Escape(go.name)).Append('"');
            }
            sb.Append("],");

            // Probe + scan center positions
            var probeMount = GameObject.Find("Probe Mount");
            if (probeMount != null)
            {
                var pp = probeMount.transform.position;
                sb.Append("\"probeMount\":{")
                  .Append("\"x\":").Append(pp.x.ToString("0.###", CultureInfo.InvariantCulture)).Append(',')
                  .Append("\"y\":").Append(pp.y.ToString("0.###", CultureInfo.InvariantCulture)).Append(',')
                  .Append("\"z\":").Append(pp.z.ToString("0.###", CultureInfo.InvariantCulture))
                  .Append("},");
            }

            sb.Append("\"sceneName\":\"").Append(Escape(SceneManager.GetActiveScene().name)).Append("\"");
            sb.Append('}');
            return sb.ToString();
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
            var seq = FindRuntimeComponent("ScanMasterEducationalSequencer");
            if (seq != null)
            {
                var t = seq.GetType();
                int sceneIdx = (int)(t.GetProperty("CurrentSceneIndex")?.GetValue(seq) ?? -1);
                float elapsed = (float)(t.GetProperty("SceneElapsed")?.GetValue(seq) ?? 0f);
                bool isRun = (bool)(t.GetProperty("IsRunning")?.GetValue(seq) ?? false);
                bool autoAdv = (bool)(t.GetProperty("AutoAdvance")?.GetValue(seq) ?? false);
                float speed = (float)(t.GetProperty("GlobalSpeed")?.GetValue(seq) ?? 0f);
                sb.Append("\"seqScene\":").Append(sceneIdx).Append(',');
                sb.Append("\"seqElapsed\":").Append(elapsed.ToString("0.##", CultureInfo.InvariantCulture)).Append(',');
                sb.Append("\"seqRunning\":").Append(isRun ? "true" : "false").Append(',');
                sb.Append("\"seqAuto\":").Append(autoAdv ? "true" : "false").Append(',');
                sb.Append("\"seqSpeed\":").Append(speed).Append(',');
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
                return UnityEngine.Object.FindAnyObjectByType(t);
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
            public string objectName;   // type name for add_component / invoke_method
            public string name;         // method name for invoke_method
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
