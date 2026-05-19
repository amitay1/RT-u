using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    public sealed class ScanMasterScanPath : MonoBehaviour
    {
        [SerializeField] private Transform center;
        [SerializeField] private float scanRadiusMeters = 0.18f;
        [SerializeField] private float scanLengthMeters = 0.16f;
        [SerializeField] private float revolutions = 1.5f;
        [SerializeField] private float startHeightMeters = 0.32f;
        [SerializeField] private float probeStandOffMeters = 0.04f;
        [SerializeField] private bool positiveDirection = true;
        [SerializeField] private bool showPathGizmo = true;
        [SerializeField] private Color gizmoColor = new Color(0f, 0.75f, 1f, 0.8f);

        public float ScanRadiusMeters
        {
            get => scanRadiusMeters;
            set => scanRadiusMeters = Mathf.Max(0.01f, value);
        }

        public float ScanLengthMeters
        {
            get => scanLengthMeters;
            set => scanLengthMeters = Mathf.Max(0.01f, value);
        }

        public float Revolutions
        {
            get => revolutions;
            set => revolutions = Mathf.Max(0.1f, value);
        }

        public bool PositiveDirection
        {
            get => positiveDirection;
            set => positiveDirection = value;
        }

        public float StartHeightMeters
        {
            get => startHeightMeters;
            set => startHeightMeters = value;
        }

        public float ProbeStandOffMeters
        {
            get => probeStandOffMeters;
            set => probeStandOffMeters = Mathf.Max(0.01f, value);
        }

        public bool ShowPathGizmo
        {
            get => showPathGizmo;
            set => showPathGizmo = value;
        }

        public Pose Evaluate(float normalized)
        {
            var t = Mathf.Clamp01(normalized);
            var direction = positiveDirection ? 1f : -1f;
            var angle = t * revolutions * Mathf.PI * 2f * direction;
            var origin = center != null ? center.position : transform.position;
            var vertical = Mathf.Lerp(-scanLengthMeters * 0.5f, scanLengthMeters * 0.5f, t);
            var radial = new Vector3(Mathf.Cos(angle), 0f, Mathf.Sin(angle));
            var position = origin + radial * (scanRadiusMeters + probeStandOffMeters) + Vector3.up * (startHeightMeters + vertical);

            var lookRotation = Quaternion.LookRotation(-radial, Vector3.up);
            var probeRotation = lookRotation * Quaternion.Euler(90f, 0f, 0f);
            return new Pose(position, probeRotation);
        }

        private void OnDrawGizmos()
        {
            if (!showPathGizmo)
            {
                return;
            }

            Gizmos.color = gizmoColor;
            const int steps = 96;
            var previous = Evaluate(0f).position;
            for (var i = 1; i <= steps; i++)
            {
                var current = Evaluate(i / (float)steps).position;
                Gizmos.DrawLine(previous, current);
                previous = current;
            }
        }

        private void OnValidate()
        {
            scanRadiusMeters = Mathf.Max(0.01f, scanRadiusMeters);
            scanLengthMeters = Mathf.Max(0.01f, scanLengthMeters);
            revolutions = Mathf.Max(0.1f, revolutions);
            probeStandOffMeters = Mathf.Max(0.01f, probeStandOffMeters);
        }
    }
}
