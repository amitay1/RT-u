// ============================================================================
// ScanMasterRecordMenu
//
// Adds Scan Master recording menu items to Unity Editor that match the
// educational story length. Click during Play to begin a deterministic PNG-sequence
// capture of the educational sequencer.
//
// Independent of the MCP bridge — works even when the bridge is unresponsive.
// ============================================================================
using UnityEditor;
using UnityEngine;

namespace ScanMaster.UnitySimulation.Editor
{
    public static class ScanMasterRecordMenu
    {
        // All start-recording items auto-stop at the sequencer story length
        // and auto-exit Play Mode so you can walk away.

        [MenuItem("Scan Master/Recording/Start 30fps - 1920x1080 - story (auto-stop)")]
        public static void StartDefault()
        {
            StartRecording(fps: 30, width: 1920, height: 1080,
                duration: ScanMasterEducationalSequencer.StoryDurationSeconds, dir: "Recordings/V2500_Unity_v1");
        }

        [MenuItem("Scan Master/Recording/Start 60fps - 1920x1080 - story (auto-stop)")]
        public static void StartFast()
        {
            StartRecording(fps: 60, width: 1920, height: 1080,
                duration: ScanMasterEducationalSequencer.StoryDurationSeconds, dir: "Recordings/V2500_Unity_60fps");
        }

        [MenuItem("Scan Master/Recording/Start 30fps - 1280x720 - story (auto-stop)")]
        public static void StartLowRes()
        {
            StartRecording(fps: 30, width: 1280, height: 720,
                duration: ScanMasterEducationalSequencer.StoryDurationSeconds, dir: "Recordings/V2500_Unity_720p");
        }

        [MenuItem("Scan Master/Recording/Stop")]
        public static void Stop()
        {
            var rec = Object.FindAnyObjectByType<ScanMasterSequenceRecorder>();
            if (rec == null)
            {
                Debug.LogWarning("Recorder: no ScanMasterSequenceRecorder in scene");
                return;
            }
            rec.StopRecording();
        }

        [MenuItem("Scan Master/Recording/Start 30fps - 1920x1080 - story (auto-stop)", true)]
        [MenuItem("Scan Master/Recording/Start 60fps - 1920x1080 - story (auto-stop)", true)]
        [MenuItem("Scan Master/Recording/Start 30fps - 1280x720 - story (auto-stop)", true)]
        public static bool ValidateStart()
        {
            return EditorApplication.isPlaying;
        }

        private static void StartRecording(int fps, int width, int height, float duration, string dir)
        {
            if (!EditorApplication.isPlaying)
            {
                Debug.LogWarning("Recorder: enter Play Mode first.");
                return;
            }

            // Find the sequencer's root + attach recorder
            var seqObj = GameObject.Find("Scan Master Immersion Simulation");
            if (seqObj == null)
            {
                Debug.LogError("Recorder: 'Scan Master Immersion Simulation' GameObject not found.");
                return;
            }

            var rec = seqObj.GetComponent<ScanMasterSequenceRecorder>();
            if (rec == null) rec = seqObj.AddComponent<ScanMasterSequenceRecorder>();

            rec.StartRecording(dir, fps, width, height, duration);
            Debug.Log($"Recorder: started -> {dir} at {fps}fps {width}x{height} for {duration:F1}s");
        }
    }
}
