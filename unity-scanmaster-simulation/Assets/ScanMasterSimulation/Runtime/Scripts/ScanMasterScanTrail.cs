using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    [RequireComponent(typeof(LineRenderer))]
    public sealed class ScanMasterScanTrail : MonoBehaviour
    {
        [SerializeField] private int maxSamples = 240;
        [SerializeField] private float minPointDistance = 0.006f;
        [SerializeField] private float trailWidth = 0.01f;
        [SerializeField] private Color trailColor = new Color(0f, 1f, 0.45f, 0.9f);

        private LineRenderer lineRenderer;
        private Vector3[] points;
        private int count;

        public void ResetTrail()
        {
            EnsureReady();
            count = 0;
            lineRenderer.positionCount = 0;
        }

        public void AddPoint(Vector3 point, bool force = false)
        {
            EnsureReady();

            if (!force && count > 0 && Vector3.Distance(points[count - 1], point) < minPointDistance)
            {
                return;
            }

            if (count >= points.Length)
            {
                for (var i = 1; i < points.Length; i++)
                {
                    points[i - 1] = points[i];
                }

                count = points.Length - 1;
            }

            points[count] = point;
            count++;
            lineRenderer.positionCount = count;
            for (var i = 0; i < count; i++)
            {
                lineRenderer.SetPosition(i, points[i]);
            }
        }

        private void Awake()
        {
            EnsureReady();
        }

        private void EnsureReady()
        {
            if (lineRenderer == null)
            {
                lineRenderer = GetComponent<LineRenderer>();
            }

            maxSamples = Mathf.Max(8, maxSamples);
            if (points == null || points.Length != maxSamples)
            {
                points = new Vector3[maxSamples];
                count = Mathf.Min(count, points.Length);
            }

            lineRenderer.useWorldSpace = true;
            lineRenderer.textureMode = LineTextureMode.Stretch;
            lineRenderer.alignment = LineAlignment.View;
            lineRenderer.startWidth = trailWidth;
            lineRenderer.endWidth = trailWidth;
            lineRenderer.startColor = trailColor;
            lineRenderer.endColor = new Color(trailColor.r, trailColor.g, trailColor.b, trailColor.a * 0.35f);
            lineRenderer.positionCount = count;
        }

        private void OnValidate()
        {
            maxSamples = Mathf.Max(8, maxSamples);
            minPointDistance = Mathf.Max(0.001f, minPointDistance);
            trailWidth = Mathf.Max(0.001f, trailWidth);
            EnsureReady();
        }
    }
}
