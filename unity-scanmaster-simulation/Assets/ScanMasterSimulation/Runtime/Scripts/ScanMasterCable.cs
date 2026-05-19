using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    [ExecuteAlways]
    [RequireComponent(typeof(LineRenderer))]
    public sealed class ScanMasterCable : MonoBehaviour
    {
        [SerializeField] private Transform start;
        [SerializeField] private Transform end;
        [SerializeField] private float sagMeters = 0.12f;
        [SerializeField] private float sideBowMeters = 0.16f;
        [SerializeField] private float widthMeters = 0.012f;
        [SerializeField] private int samples = 24;

        private LineRenderer lineRenderer;

        public void Configure(Transform startTransform, Transform endTransform, float sag, float sideBow, float width)
        {
            start = startTransform;
            end = endTransform;
            sagMeters = sag;
            sideBowMeters = sideBow;
            widthMeters = Mathf.Max(0.002f, width);
            Refresh();
        }

        private void LateUpdate()
        {
            Refresh();
        }

        private void Refresh()
        {
            if (start == null || end == null)
            {
                return;
            }

            if (lineRenderer == null)
            {
                lineRenderer = GetComponent<LineRenderer>();
            }

            samples = Mathf.Clamp(samples, 4, 64);
            lineRenderer.useWorldSpace = true;
            lineRenderer.positionCount = samples;
            lineRenderer.startWidth = widthMeters;
            lineRenderer.endWidth = widthMeters;
            lineRenderer.alignment = LineAlignment.View;

            var a = start.position;
            var d = end.position;
            var span = d - a;
            var side = Vector3.Cross(Vector3.up, span);
            if (side.sqrMagnitude < 0.0001f)
            {
                side = Vector3.right;
            }

            side.Normalize();
            var b = Vector3.Lerp(a, d, 0.34f) + side * sideBowMeters + Vector3.down * sagMeters;
            var c = Vector3.Lerp(a, d, 0.68f) + side * sideBowMeters * 0.55f + Vector3.down * sagMeters * 0.35f;

            for (var i = 0; i < samples; i++)
            {
                var t = i / (float)(samples - 1);
                lineRenderer.SetPosition(i, Bezier(a, b, c, d, t));
            }
        }

        private static Vector3 Bezier(Vector3 a, Vector3 b, Vector3 c, Vector3 d, float t)
        {
            var u = 1f - t;
            return u * u * u * a + 3f * u * u * t * b + 3f * u * t * t * c + t * t * t * d;
        }

        private void OnValidate()
        {
            widthMeters = Mathf.Max(0.002f, widthMeters);
            samples = Mathf.Clamp(samples, 4, 64);
            Refresh();
        }
    }
}
