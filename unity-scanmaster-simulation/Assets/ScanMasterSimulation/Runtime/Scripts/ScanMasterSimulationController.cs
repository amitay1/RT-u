using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    public sealed class ScanMasterSimulationController : MonoBehaviour
    {
        [Header("Robot axes")]
        [SerializeField] private ScanMasterRobotAxis xAxis;
        [SerializeField] private ScanMasterRobotAxis yAxis;
        [SerializeField] private ScanMasterRobotAxis zAxis;
        [SerializeField] private Transform probeMount;

        [Header("Scanning")]
        [SerializeField] private ScanMasterScanPath scanPath;
        [SerializeField] private ScanMasterProbeBeam probeBeam;
        [SerializeField] private ScanMasterScanTrail scanTrail;
        [SerializeField] private ScanMasterTurntable turntable;
        [SerializeField] private bool playOnStart = true;
        [SerializeField] private bool loop = true;
        [SerializeField] private bool driveProbeMountWorldPose = true;
        [SerializeField] private float scanDurationSeconds = 22f;
        [SerializeField] private float guidedSeekSeconds = 2.2f;
        [SerializeField] private float scanTurntableRpm = 2.5f;
        [SerializeField] private float idleTurntableRpm = 0.45f;

        [Header("Keyboard")]
        [SerializeField] private KeyCode playPauseKey = KeyCode.Space;
        [SerializeField] private KeyCode resetKey = KeyCode.R;

        private float progress;
        private float guidedTargetProgress;
        private bool guidedSeeking;
        private bool playing;

        public bool IsPlaying => playing;
        public float Progress => progress;

        public void SetPlaying(bool value)
        {
            playing = value;
            SetActiveVisuals(value);
        }

        public void SetProgress(float normalized, bool snap = true, bool resetTrail = true)
        {
            var target = Mathf.Clamp01(normalized);
            if (scanTrail != null && resetTrail)
            {
                scanTrail.ResetTrail();
            }

            if (snap)
            {
                progress = target;
                guidedTargetProgress = target;
                guidedSeeking = false;
                ApplyPose(progress, true);
                return;
            }

            guidedTargetProgress = target;
            guidedSeeking = true;
        }

        private void Start()
        {
            playing = playOnStart;
            if (scanTrail != null)
            {
                scanTrail.ResetTrail();
            }

            ApplyPose(0f, true);
        }

        private void Update()
        {
            HandleKeyboard();

            if (!playing || scanPath == null)
            {
                if (guidedSeeking && scanPath != null)
                {
                    var seekDuration = Mathf.Max(0.1f, guidedSeekSeconds);
                    progress = Mathf.MoveTowards(progress, guidedTargetProgress, Time.deltaTime / seekDuration);
                    ApplyPose(progress, false);
                    if (Mathf.Approximately(progress, guidedTargetProgress))
                    {
                        guidedSeeking = false;
                    }
                }

                SetActiveVisuals(false);
                return;
            }

            guidedSeeking = false;
            var duration = Mathf.Max(0.1f, scanDurationSeconds);
            progress += Time.deltaTime / duration;
            if (progress >= 1f)
            {
                if (loop)
                {
                    progress %= 1f;
                    if (scanPath != null)
                    {
                        scanPath.PositiveDirection = !scanPath.PositiveDirection;
                    }

                    if (scanTrail != null)
                    {
                        scanTrail.ResetTrail();
                    }
                }
                else
                {
                    progress = 1f;
                    playing = false;
                }
            }

            ApplyPose(progress, false);
            SetActiveVisuals(true);
        }

        public void Play()
        {
            SetPlaying(true);
        }

        public void Pause()
        {
            SetPlaying(false);
        }

        public void ResetScan()
        {
            SetProgress(0f, true);
        }

        private void HandleKeyboard()
        {
            if (ScanMasterInput.GetKeyDown(playPauseKey))
            {
                playing = !playing;
            }

            if (ScanMasterInput.GetKeyDown(resetKey))
            {
                ResetScan();
            }
        }

        private void ApplyPose(float normalized, bool snap)
        {
            if (scanPath == null)
            {
                return;
            }

            var pose = scanPath.Evaluate(normalized);
            var local = transform.InverseTransformPoint(pose.position);

            if (xAxis != null)
            {
                xAxis.SetTarget(local.x, snap);
            }

            if (yAxis != null)
            {
                yAxis.SetTarget(local.z, snap);
            }

            if (zAxis != null)
            {
                zAxis.SetTarget(local.y, snap);
            }

            if (probeMount != null)
            {
                if (driveProbeMountWorldPose)
                {
                    probeMount.SetPositionAndRotation(pose.position, pose.rotation);
                }
                else
                {
                    probeMount.rotation = pose.rotation;
                }
            }

            if (scanTrail != null)
            {
                scanTrail.AddPoint(pose.position, snap);
            }
        }

        private void SetActiveVisuals(bool active)
        {
            if (probeBeam != null)
            {
                probeBeam.SetScanActive(active);
            }

            if (turntable != null)
            {
                turntable.RotateWhenPlaying = true;
                turntable.Rpm = active ? scanTurntableRpm : idleTurntableRpm;
            }
        }

        private void OnValidate()
        {
            scanDurationSeconds = Mathf.Max(0.1f, scanDurationSeconds);
            guidedSeekSeconds = Mathf.Max(0.1f, guidedSeekSeconds);
            scanTurntableRpm = Mathf.Max(0f, scanTurntableRpm);
            idleTurntableRpm = Mathf.Max(0f, idleTurntableRpm);
        }
    }
}
