using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace ScanMaster.UnitySimulation.Editor
{
    [InitializeOnLoad]
    public static class ScanMasterMcpBridge
    {
        private const int Port = 17777;
        private const int RequestTimeoutMs = 30000;

        private static readonly ConcurrentQueue<PendingRequest> PendingRequests = new ConcurrentQueue<PendingRequest>();
        private static TcpListener listener;
        private static Thread listenerThread;
        private static volatile bool running;
        private static volatile bool delayCallChainArmed;

        static ScanMasterMcpBridge()
        {
            // Multi-channel pump so requests don't stall when EditorApplication.update is throttled
            EditorApplication.update += PumpRequests;
            Application.runInBackground = true;
            AssemblyReloadEvents.beforeAssemblyReload += OnBeforeReload;
            EditorApplication.quitting += OnEditorQuitting;
            ScheduleDelayCallPump();
            StartServer();
        }

        private static void OnBeforeReload()
        {
            Debug.Log("MCP bridge: assembly reload — stopping listener");
            StopServer();
        }

        private static void OnEditorQuitting() => StopServer();

        private static void ScheduleDelayCallPump()
        {
            if (delayCallChainArmed) return;
            delayCallChainArmed = true;
            EditorApplication.delayCall += DelayCallPump;
        }

        private static void DelayCallPump()
        {
            delayCallChainArmed = false;
            try { PumpRequests(); }
            finally
            {
                if (running) ScheduleDelayCallPump();
            }
        }

        [MenuItem("Scan Master/MCP/Start Bridge")]
        public static void StartServer()
        {
            if (running)
            {
                Debug.Log("Scan Master MCP bridge is already running on 127.0.0.1:" + Port);
                return;
            }
            const int maxAttempts = 5;
            for (int attempt = 1; attempt <= maxAttempts; attempt++)
            {
                try
                {
                    listener = new TcpListener(IPAddress.Loopback, Port);
                    listener.Server.SetSocketOption(SocketOptionLevel.Socket,
                        SocketOptionName.ReuseAddress, true);
                    listener.Start();
                    running = true;
                    listenerThread = new Thread(ListenLoop)
                    {
                        IsBackground = true,
                        Name = "ScanMasterMcpBridge"
                    };
                    listenerThread.Start();
                    Debug.Log($"Scan Master MCP bridge listening on http://127.0.0.1:{Port} (attempt {attempt})");
                    return;
                }
                catch (SocketException ex)
                {
                    Debug.LogWarning($"MCP bridge bind attempt {attempt} failed: {ex.Message}");
                    if (attempt < maxAttempts) Thread.Sleep(250);
                }
                catch (Exception ex)
                {
                    running = false;
                    Debug.LogWarning("Scan Master MCP bridge failed: " + ex.Message);
                    return;
                }
            }
            running = false;
            Debug.LogError($"Scan Master MCP bridge: failed to bind port {Port} after {maxAttempts} attempts");
        }

        [MenuItem("Scan Master/MCP/Stop Bridge")]
        public static void StopServer()
        {
            running = false;
            try { listener?.Stop(); } catch (Exception) { }
            listener = null;
            try
            {
                if (listenerThread != null && listenerThread.IsAlive)
                    listenerThread.Join(500);
            }
            catch (Exception) { }
            listenerThread = null;
            // Drain pending queue so callers don't hang
            while (PendingRequests.TryDequeue(out var p))
            {
                p.ResponseJson = BuildResponse(false, "Bridge stopped", "{}");
                p.HttpStatus = 503;
                p.Done.Set();
            }
            Debug.Log("Scan Master MCP bridge stopped.");
        }

        [MenuItem("Scan Master/MCP/Status")]
        public static void LogStatus()
        {
            Debug.Log("Scan Master MCP bridge " + (running ? "running" : "stopped") + " on 127.0.0.1:" + Port);
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
                catch (SocketException)
                {
                    if (running)
                    {
                        Thread.Sleep(100);
                    }
                }
                catch (ObjectDisposedException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    Debug.LogWarning("Scan Master MCP bridge listener error: " + ex.Message);
                }
            }
        }

        private static void HandleClient(TcpClient client)
        {
            var stream = client.GetStream();
            var raw = ReadHttpRequest(stream, out var method, out var path, out var body);
            if (!raw)
            {
                WriteHttp(stream, 400, "{\"ok\":false,\"message\":\"Bad request\"}");
                return;
            }

            if (method == "GET" && path == "/health")
            {
                WriteHttp(stream, 200, BuildResponse(true, "Unity MCP bridge is reachable", BuildHealthData()));
                return;
            }

            if (method != "POST" || path != "/command")
            {
                WriteHttp(stream, 404, "{\"ok\":false,\"message\":\"Unknown endpoint\"}");
                return;
            }

            var request = JsonUtility.FromJson<McpCommandRequest>(body);
            if (request == null || string.IsNullOrWhiteSpace(request.command))
            {
                WriteHttp(stream, 400, "{\"ok\":false,\"message\":\"Missing command\"}");
                return;
            }

            var pending = new PendingRequest(request);
            PendingRequests.Enqueue(pending);

            if (!pending.Done.WaitOne(RequestTimeoutMs))
            {
                WriteHttp(stream, 504, "{\"ok\":false,\"message\":\"Unity editor command timed out\"}");
                return;
            }

            WriteHttp(stream, pending.HttpStatus, pending.ResponseJson);
        }

        private static bool ReadHttpRequest(NetworkStream stream, out string method, out string path, out string body)
        {
            method = "";
            path = "";
            body = "";

            var buffer = new byte[8192];
            var bytes = new List<byte>(8192);
            var headerEnd = -1;

            while (headerEnd < 0)
            {
                var read = stream.Read(buffer, 0, buffer.Length);
                if (read <= 0)
                {
                    return false;
                }

                for (var i = 0; i < read; i++)
                {
                    bytes.Add(buffer[i]);
                }

                headerEnd = IndexOfHeaderEnd(bytes);
                if (bytes.Count > 128 * 1024)
                {
                    return false;
                }
            }

            var headerText = Encoding.ASCII.GetString(bytes.GetRange(0, headerEnd).ToArray());
            var lines = headerText.Split(new[] { "\r\n" }, StringSplitOptions.None);
            if (lines.Length == 0)
            {
                return false;
            }

            var first = lines[0].Split(' ');
            if (first.Length < 2)
            {
                return false;
            }

            method = first[0].ToUpperInvariant();
            path = first[1];

            var contentLength = 0;
            for (var i = 1; i < lines.Length; i++)
            {
                var line = lines[i];
                var colon = line.IndexOf(':');
                if (colon <= 0)
                {
                    continue;
                }

                var key = line.Substring(0, colon).Trim();
                var value = line.Substring(colon + 1).Trim();
                if (string.Equals(key, "Content-Length", StringComparison.OrdinalIgnoreCase))
                {
                    int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out contentLength);
                }
            }

            var bodyStart = headerEnd + 4;
            while (bytes.Count - bodyStart < contentLength)
            {
                var read = stream.Read(buffer, 0, buffer.Length);
                if (read <= 0)
                {
                    return false;
                }

                for (var i = 0; i < read; i++)
                {
                    bytes.Add(buffer[i]);
                }
            }

            if (contentLength > 0)
            {
                body = Encoding.UTF8.GetString(bytes.GetRange(bodyStart, contentLength).ToArray());
            }

            return true;
        }

        private static int IndexOfHeaderEnd(IReadOnlyList<byte> bytes)
        {
            for (var i = 3; i < bytes.Count; i++)
            {
                if (bytes[i - 3] == '\r' && bytes[i - 2] == '\n' && bytes[i - 1] == '\r' && bytes[i] == '\n')
                {
                    return i - 3;
                }
            }

            return -1;
        }

        private static void WriteHttp(Stream stream, int status, string json)
        {
            var payload = Encoding.UTF8.GetBytes(json);
            var header =
                "HTTP/1.1 " + status + " OK\r\n" +
                "Content-Type: application/json; charset=utf-8\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Content-Length: " + payload.Length.ToString(CultureInfo.InvariantCulture) + "\r\n" +
                "Connection: close\r\n\r\n";
            var headerBytes = Encoding.ASCII.GetBytes(header);
            stream.Write(headerBytes, 0, headerBytes.Length);
            stream.Write(payload, 0, payload.Length);
        }

        private static void PumpRequests()
        {
            while (PendingRequests.TryDequeue(out var pending))
            {
                try
                {
                    pending.ResponseJson = Execute(pending.Request, out pending.HttpStatus);
                }
                catch (Exception ex)
                {
                    pending.HttpStatus = 500;
                    pending.ResponseJson = BuildResponse(false, ex.GetType().Name + ": " + ex.Message, "{}");
                }
                finally
                {
                    pending.Done.Set();
                }
            }
        }

        private static string Execute(McpCommandRequest request, out int httpStatus)
        {
            httpStatus = 200;
            switch (request.command)
            {
                case "status":
                    return BuildResponse(true, "Unity editor status", BuildStatusData());
                case "build_scanmaster_scene":
                    ScanMasterSceneBuilder.BuildSimulationScene();
                    return BuildResponse(true, "Scan Master scene rebuilt", BuildStatusData());
                case "open_scene":
                    Require(request.scenePath, "scenePath");
                    EditorSceneManager.OpenScene(request.scenePath);
                    return BuildResponse(true, "Scene opened", BuildStatusData());
                case "save_scene":
                    SaveActiveScene();
                    return BuildResponse(true, "Active scene saved", BuildStatusData());
                case "list_scene_objects":
                    return BuildResponse(true, "Scene objects listed", BuildSceneObjectsData());
                case "create_primitive":
                    return CreatePrimitive(request);
                case "set_transform":
                    return SetTransform(request);
                case "set_active":
                    return SetActive(request);
                case "delete_object":
                    return DeleteObject(request);
                case "enter_play_mode":
                    EditorApplication.isPaused = false;
                    EditorApplication.isPlaying = true;
                    return BuildResponse(true, "Entered play mode", BuildStatusData());
                case "exit_play_mode":
                    EditorApplication.isPlaying = false;
                    EditorApplication.isPaused = false;
                    return BuildResponse(true, "Exited play mode", BuildStatusData());
                case "unpause_editor":
                    EditorApplication.isPaused = false;
                    return BuildResponse(true, "Unity editor unpaused", BuildStatusData());
                case "execute_menu":
                    Require(request.menuItem, "menuItem");
                    var executed = EditorApplication.ExecuteMenuItem(request.menuItem);
                    return BuildResponse(executed, executed ? "Menu item executed" : "Menu item not found", "{\"menuItem\":\"" + Escape(request.menuItem) + "\"}");
                default:
                    httpStatus = 400;
                    return BuildResponse(false, "Unknown command: " + request.command, "{}");
            }
        }

        private static string CreatePrimitive(McpCommandRequest request)
        {
            var type = ParsePrimitiveType(request.type);
            var go = GameObject.CreatePrimitive(type);
            go.name = string.IsNullOrWhiteSpace(request.name) ? type.ToString() : request.name;
            ApplyTransform(go.transform, request);
            Selection.activeGameObject = go;
            EditorSceneManager.MarkSceneDirty(go.scene);
            return BuildResponse(true, "Primitive created", BuildObjectData(go));
        }

        private static string SetTransform(McpCommandRequest request)
        {
            var go = FindRequestedObject(request);
            ApplyTransform(go.transform, request);
            EditorUtility.SetDirty(go);
            EditorSceneManager.MarkSceneDirty(go.scene);
            return BuildResponse(true, "Transform updated", BuildObjectData(go));
        }

        private static string SetActive(McpCommandRequest request)
        {
            var go = FindRequestedObject(request);
            go.SetActive(request.active);
            EditorUtility.SetDirty(go);
            EditorSceneManager.MarkSceneDirty(go.scene);
            return BuildResponse(true, "Active state updated", BuildObjectData(go));
        }

        private static string DeleteObject(McpCommandRequest request)
        {
            var go = FindRequestedObject(request);
            var scene = go.scene;
            var path = GetPath(go.transform);
            UnityEngine.Object.DestroyImmediate(go);
            EditorSceneManager.MarkSceneDirty(scene);
            return BuildResponse(true, "Object deleted", "{\"deleted\":\"" + Escape(path) + "\"}");
        }

        private static void ApplyTransform(Transform transform, McpCommandRequest request)
        {
            if (request.hasPosition)
            {
                transform.position = new Vector3(request.x, request.y, request.z);
            }

            if (request.hasRotation)
            {
                transform.rotation = Quaternion.Euler(request.rx, request.ry, request.rz);
            }

            if (request.hasScale)
            {
                transform.localScale = new Vector3(request.sx, request.sy, request.sz);
            }
        }

        private static PrimitiveType ParsePrimitiveType(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return PrimitiveType.Cube;
            }

            switch (value.Trim().ToLowerInvariant())
            {
                case "sphere":
                    return PrimitiveType.Sphere;
                case "capsule":
                    return PrimitiveType.Capsule;
                case "cylinder":
                    return PrimitiveType.Cylinder;
                case "plane":
                    return PrimitiveType.Plane;
                case "quad":
                    return PrimitiveType.Quad;
                default:
                    return PrimitiveType.Cube;
            }
        }

        private static GameObject FindRequestedObject(McpCommandRequest request)
        {
            var query = !string.IsNullOrWhiteSpace(request.objectPath) ? request.objectPath : request.name;
            Require(query, "objectPath or name");

            foreach (var root in SceneManager.GetActiveScene().GetRootGameObjects())
            {
                var match = FindInHierarchy(root.transform, query);
                if (match != null)
                {
                    return match.gameObject;
                }
            }

            throw new InvalidOperationException("Object not found: " + query);
        }

        private static Transform FindInHierarchy(Transform root, string query)
        {
            var path = GetPath(root);
            if (string.Equals(path, query, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(root.name, query, StringComparison.OrdinalIgnoreCase))
            {
                return root;
            }

            for (var i = 0; i < root.childCount; i++)
            {
                var match = FindInHierarchy(root.GetChild(i), query);
                if (match != null)
                {
                    return match;
                }
            }

            return null;
        }

        private static void SaveActiveScene()
        {
            var scene = SceneManager.GetActiveScene();
            if (!scene.IsValid())
            {
                throw new InvalidOperationException("No valid active scene.");
            }

            if (string.IsNullOrWhiteSpace(scene.path))
            {
                throw new InvalidOperationException("Active scene has no path. Use open_scene or save manually first.");
            }

            EditorSceneManager.SaveScene(scene);
        }

        private static string BuildStatusData()
        {
            var scene = SceneManager.GetActiveScene();
            var roots = scene.IsValid() ? scene.GetRootGameObjects() : Array.Empty<GameObject>();
            return "{" +
                   "\"bridge\":\"running\"," +
                   "\"url\":\"http://127.0.0.1:" + Port + "\"," +
                   "\"unityVersion\":\"" + Escape(Application.unityVersion) + "\"," +
                   "\"isPlaying\":" + (EditorApplication.isPlaying ? "true" : "false") + "," +
                   "\"isPaused\":" + (EditorApplication.isPaused ? "true" : "false") + "," +
                   "\"isCompiling\":" + (EditorApplication.isCompiling ? "true" : "false") + "," +
                   "\"sceneName\":\"" + Escape(scene.name) + "\"," +
                   "\"scenePath\":\"" + Escape(scene.path) + "\"," +
                   "\"rootObjectCount\":" + roots.Length.ToString(CultureInfo.InvariantCulture) +
                   "}";
        }

        private static string BuildHealthData()
        {
            return "{" +
                   "\"bridge\":\"running\"," +
                   "\"url\":\"http://127.0.0.1:" + Port + "\"" +
                   "}";
        }

        private static string BuildSceneObjectsData()
        {
            var builder = new StringBuilder();
            builder.Append("{\"objects\":[");
            var first = true;
            foreach (var root in SceneManager.GetActiveScene().GetRootGameObjects())
            {
                AppendObjectRecursive(builder, root.transform, ref first);
            }

            builder.Append("]}");
            return builder.ToString();
        }

        private static void AppendObjectRecursive(StringBuilder builder, Transform transform, ref bool first)
        {
            if (!first)
            {
                builder.Append(',');
            }

            first = false;
            builder.Append(BuildObjectData(transform.gameObject));

            for (var i = 0; i < transform.childCount; i++)
            {
                AppendObjectRecursive(builder, transform.GetChild(i), ref first);
            }
        }

        private static string BuildObjectData(GameObject go)
        {
            var transform = go.transform;
            var components = go.GetComponents<Component>();
            var builder = new StringBuilder();
            builder.Append('{');
            builder.Append("\"name\":\"").Append(Escape(go.name)).Append("\",");
            builder.Append("\"path\":\"").Append(Escape(GetPath(transform))).Append("\",");
            builder.Append("\"activeSelf\":").Append(go.activeSelf ? "true" : "false").Append(',');
            builder.Append("\"position\":").Append(VectorJson(transform.position)).Append(',');
            builder.Append("\"rotation\":").Append(VectorJson(transform.rotation.eulerAngles)).Append(',');
            builder.Append("\"scale\":").Append(VectorJson(transform.localScale)).Append(',');
            builder.Append("\"components\":[");
            for (var i = 0; i < components.Length; i++)
            {
                if (i > 0)
                {
                    builder.Append(',');
                }

                builder.Append('"').Append(Escape(components[i] != null ? components[i].GetType().Name : "Missing")).Append('"');
            }

            builder.Append("]}");
            return builder.ToString();
        }

        private static string VectorJson(Vector3 v)
        {
            return "{" +
                   "\"x\":" + Float(v.x) + "," +
                   "\"y\":" + Float(v.y) + "," +
                   "\"z\":" + Float(v.z) +
                   "}";
        }

        private static string GetPath(Transform transform)
        {
            var names = new Stack<string>();
            var current = transform;
            while (current != null)
            {
                names.Push(current.name);
                current = current.parent;
            }

            return string.Join("/", names.ToArray());
        }

        private static string BuildResponse(bool ok, string message, string data)
        {
            return "{" +
                   "\"ok\":" + (ok ? "true" : "false") + "," +
                   "\"message\":\"" + Escape(message) + "\"," +
                   "\"data\":" + (string.IsNullOrWhiteSpace(data) ? "{}" : data) +
                   "}";
        }

        private static string Float(float value)
        {
            return value.ToString("0.#####", CultureInfo.InvariantCulture);
        }

        private static string Escape(string value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return "";
            }

            return value
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\r", "\\r")
                .Replace("\n", "\\n")
                .Replace("\t", "\\t");
        }

        private static void Require(string value, string fieldName)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new ArgumentException("Missing required field: " + fieldName);
            }
        }

        [Serializable]
        private sealed class McpCommandRequest
        {
            public string command;
            public string scenePath;
            public string objectPath;
            public string name;
            public string type;
            public string menuItem;
            public bool active;
            public bool hasPosition;
            public bool hasRotation;
            public bool hasScale;
            public float x;
            public float y;
            public float z;
            public float rx;
            public float ry;
            public float rz;
            public float sx = 1f;
            public float sy = 1f;
            public float sz = 1f;
        }

        private sealed class PendingRequest
        {
            public readonly McpCommandRequest Request;
            public readonly ManualResetEvent Done = new ManualResetEvent(false);
            public string ResponseJson = "{\"ok\":false,\"message\":\"No response\",\"data\":{}}";
            public int HttpStatus = 200;

            public PendingRequest(McpCommandRequest request)
            {
                Request = request;
            }
        }
    }
}
