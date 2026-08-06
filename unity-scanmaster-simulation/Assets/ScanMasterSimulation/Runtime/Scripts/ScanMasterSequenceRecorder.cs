// ============================================================================
// ScanMasterSequenceRecorder
//
// Deterministic frame-by-frame screenshot recorder for ScanMasterEducationalSequencer.
//
// How it works:
//   1. Call StartRecording(fps, dir) → sets Time.captureFramerate so each Update
//      ticks exactly 1/fps seconds (regardless of real time spent).
//   2. Switches the Sequencer into RecordingMode so it uses Time.time (which
//      advances 1/fps per frame in capture mode) instead of wall-clock time.
//   3. Each LateUpdate, ScreenCapture.CaptureScreenshot writes a PNG to disk.
//   4. After totalDurationSeconds the recorder auto-stops and exits Play mode.
//
// Output: <project>/<dir>/frame_000000.png … frame_NNNNNN.png at <fps> fps.
// Combine with ffmpeg after.
// ============================================================================
using System.IO;
using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    // Sequencer is 2000 — recorder MUST be higher so it runs AFTER the sequencer's
    // LateUpdate has positioned the camera. With 1000 (lower than 2000) the recorder
    // was capturing the PREVIOUS frame's camera state — a one-frame lag where, on
    // the scene-change frame, the recording showed the OLD scene's camera/props.
    [DefaultExecutionOrder(3000)]  // run AFTER sequencer's LateUpdate so we capture the final frame
    public sealed class ScanMasterSequenceRecorder : MonoBehaviour
    {
        [SerializeField] private int fps = 30;
        [SerializeField] private int width = 1920;
        [SerializeField] private int height = 1080;
        [SerializeField] private string outputDirName = "Recording";
        [SerializeField] private float totalDurationSeconds = 0f;     // 0 = match sequencer story length
        [SerializeField] private int captureWarmupFrames = 1;
        [SerializeField] private bool autoExitPlayMode = true;        // hands-off

        private bool recording;
        private int frameNum;
        private string outputDir;
        private float recordingStartTime;
        private ScanMasterEducationalSequencer sequencer;
        private int warmupFramesRemaining;

        public bool IsRecording => recording;
        public int FrameNumber => frameNum;
        public float ElapsedSeconds => recording ? (Time.time - recordingStartTime) : 0f;
        public float TotalDurationSeconds => totalDurationSeconds;
        public string OutputDir => outputDir;

        public void StartRecording()
        {
            StartRecording(outputDirName, fps, width, height, ResolveDuration(totalDurationSeconds));
        }

        public void StartRecording(string dirName, int targetFps, int w, int h, float duration)
        {
            sequencer = FindAnyObjectByType<ScanMasterEducationalSequencer>();
            if (sequencer == null)
            {
                Debug.LogError("Recorder: no ScanMasterEducationalSequencer in scene");
                return;
            }

            fps = Mathf.Clamp(targetFps, 1, 120);
            width = w;
            height = h;
            totalDurationSeconds = ResolveDuration(duration);
            autoExitPlayMode = true;                     // <-- hands-off
            outputDirName = string.IsNullOrWhiteSpace(dirName) ? "Recording" : dirName;
            outputDir = Path.Combine(Application.dataPath, "..", outputDirName);
            Directory.CreateDirectory(outputDir);

            // Clear previous PNGs in dir
            foreach (var f in Directory.GetFiles(outputDir, "frame_*.png"))
            {
                try { File.Delete(f); } catch { }
            }

            // Enable deterministic frame timing
            Time.captureFramerate = fps;
            // Keep Unity ticking even if user alt-tabs out
            Application.runInBackground = true;

            // Restart sequencer in recording mode so its timer matches our frames
            sequencer.RecordingMode = true;
            sequencer.Run();

            recording = true;
            frameNum = 0;
            warmupFramesRemaining = Mathf.Max(0, captureWarmupFrames);
            recordingStartTime = Time.time;

            int expectedFrames = Mathf.CeilToInt(totalDurationSeconds * fps);
            Debug.Log($"Recorder: STARTED -> {fps}fps - {width}x{height} - {totalDurationSeconds:F1}s - ~{expectedFrames} frames - {outputDir}");
            Debug.Log($"Recorder: will AUTO-STOP at {totalDurationSeconds:F1}s and EXIT PLAY MODE.");
        }

        public void StopRecording()
        {
            if (!recording) return;
            recording = false;
            Time.captureFramerate = 0;
            if (sequencer != null) sequencer.RecordingMode = false;
            float actualSec = frameNum / (float)fps;
            Debug.Log($"=================================================");
            Debug.Log($"  Recorder: DONE — {frameNum} frames @ {fps}fps = {actualSec:F1}s");
            Debug.Log($"  Output dir: {outputDir}");
            Debug.Log($"  Next: python combine_unity_recording.py \"{outputDir}\" {fps}");
            Debug.Log($"=================================================");

            if (autoExitPlayMode)
            {
#if UNITY_EDITOR
                // Defer the play-mode exit by a frame so the final screenshot
                // has time to flush to disk.
                UnityEditor.EditorApplication.delayCall += () =>
                {
                    UnityEditor.EditorApplication.isPlaying = false;
                };
#endif
            }
        }

        private void LateUpdate()
        {
            if (!recording) return;

            if (warmupFramesRemaining > 0)
            {
                warmupFramesRemaining--;
                recordingStartTime = Time.time;
                return;
            }

            CaptureFrameToFile(Path.Combine(outputDir, $"frame_{frameNum:D6}.png"));
            frameNum++;

            // Auto-stop when duration reached
            if (ElapsedSeconds >= totalDurationSeconds)
            {
                StopRecording();
            }
        }

        private static float ResolveDuration(float requestedDuration)
        {
            if (requestedDuration > 0.01f) return requestedDuration;
            return Mathf.Max(1f, ScanMasterEducationalSequencer.StoryDurationSeconds);
        }

        // Render the main camera into a RenderTexture and write PNG manually.
        // Avoids the ScreenCapture module dependency.
        private RenderTexture renderTex;
        private Texture2D readTex;

        private void CaptureFrameToFile(string path)
        {
            var cam = Camera.main;
            if (cam == null) return;
            if (renderTex == null || renderTex.width != width || renderTex.height != height)
            {
                if (renderTex != null) renderTex.Release();
                renderTex = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32);
                renderTex.antiAliasing = 4;
                if (readTex != null) Destroy(readTex);
                readTex = new Texture2D(width, height, TextureFormat.RGB24, false);
            }

            var prevTarget = cam.targetTexture;
            cam.targetTexture = renderTex;
            cam.Render();
            var prevActive = RenderTexture.active;
            RenderTexture.active = renderTex;
            readTex.ReadPixels(new Rect(0, 0, width, height), 0, 0);
            readTex.Apply();
            RenderTexture.active = prevActive;
            cam.targetTexture = prevTarget;

            byte[] png = readTex.EncodeToPNG();
            File.WriteAllBytes(path, png);
        }

        private void OnDestroy()
        {
            if (renderTex != null) renderTex.Release();
            renderTex = null;
            if (readTex != null) Destroy(readTex);
            readTex = null;
        }

        private void OnDisable()
        {
            if (recording) StopRecording();
        }
    }
}
