using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    [RequireComponent(typeof(LineRenderer))]
    public sealed class ScanMasterProbeBeam : MonoBehaviour
    {
        [SerializeField] private bool showBeam = true;
        [SerializeField] private float waterPathMeters = 0.2032f;
        [SerializeField] private float materialPathMeters = 0.16f;
        [SerializeField] private float incidentAngleDegrees = 18.9f;
        [SerializeField] private float refractedAngleDegrees = 45f;
        [SerializeField] private float activeWidth = 0.018f;
        [SerializeField] private float footprintRadiusMeters = 0.035f;
        [SerializeField] private Transform soundEntryMarker;
        [SerializeField] private LineRenderer surfaceFootprint;
        [SerializeField] private Color idleColor = new Color(0.1f, 0.65f, 1f, 0.45f);
        [SerializeField] private Color activeColor = new Color(0f, 1f, 0.45f, 0.85f);

        private LineRenderer lineRenderer;
        private bool scanActive;

        public void SetScanActive(bool value)
        {
            scanActive = value;
            Refresh();
        }

        public void SetWaterPath(float meters)
        {
            waterPathMeters = Mathf.Max(0.01f, meters);
            Refresh();
        }

        private void Awake()
        {
            lineRenderer = GetComponent<LineRenderer>();
            ConfigureRenderer();
            Refresh();
        }

        private void LateUpdate()
        {
            Refresh();
        }

        private void ConfigureRenderer()
        {
            if (lineRenderer == null)
            {
                return;
            }

            lineRenderer.useWorldSpace = true;
            lineRenderer.positionCount = 3;
            lineRenderer.textureMode = LineTextureMode.Stretch;
            lineRenderer.alignment = LineAlignment.View;
        }

        private void Refresh()
        {
            if (lineRenderer == null)
            {
                lineRenderer = GetComponent<LineRenderer>();
                ConfigureRenderer();
            }

            lineRenderer.enabled = showBeam;
            if (!showBeam)
            {
                return;
            }

            var waterDirection = Quaternion.AngleAxis(incidentAngleDegrees, transform.right) * -transform.up;
            var hitPoint = transform.position + waterDirection.normalized * waterPathMeters;
            var materialDirection = Quaternion.AngleAxis(refractedAngleDegrees, transform.right) * -transform.up;
            var materialEnd = hitPoint + materialDirection.normalized * materialPathMeters;

            lineRenderer.positionCount = 3;
            lineRenderer.SetPosition(0, transform.position);
            lineRenderer.SetPosition(1, hitPoint);
            lineRenderer.SetPosition(2, materialEnd);
            lineRenderer.startWidth = activeWidth;
            lineRenderer.endWidth = activeWidth * 0.35f;

            var color = scanActive ? activeColor : idleColor;
            lineRenderer.startColor = color;
            lineRenderer.endColor = new Color(color.r, color.g, color.b, color.a * 0.25f);

            RefreshFootprint(hitPoint, color);
        }

        private void RefreshFootprint(Vector3 hitPoint, Color color)
        {
            if (soundEntryMarker != null)
            {
                soundEntryMarker.gameObject.SetActive(showBeam);
                soundEntryMarker.position = hitPoint;
                var pulse = scanActive ? 1f + Mathf.Sin(Time.time * 8f) * 0.18f : 0.75f;
                soundEntryMarker.localScale = Vector3.one * footprintRadiusMeters * pulse;
            }

            if (surfaceFootprint == null)
            {
                return;
            }

            const int segments = 48;
            surfaceFootprint.enabled = showBeam;
            surfaceFootprint.useWorldSpace = true;
            surfaceFootprint.loop = true;
            surfaceFootprint.positionCount = segments;
            surfaceFootprint.startWidth = activeWidth * 0.32f;
            surfaceFootprint.endWidth = activeWidth * 0.32f;
            surfaceFootprint.startColor = color;
            surfaceFootprint.endColor = color;
            for (var i = 0; i < segments; i++)
            {
                var angle = i / (float)segments * Mathf.PI * 2f;
                var point = hitPoint + new Vector3(Mathf.Cos(angle) * footprintRadiusMeters, 0.002f, Mathf.Sin(angle) * footprintRadiusMeters);
                surfaceFootprint.SetPosition(i, point);
            }
        }

        private void OnValidate()
        {
            waterPathMeters = Mathf.Max(0.01f, waterPathMeters);
            materialPathMeters = Mathf.Max(0.01f, materialPathMeters);
            activeWidth = Mathf.Max(0.001f, activeWidth);
            footprintRadiusMeters = Mathf.Max(0.005f, footprintRadiusMeters);
        }
    }
}
