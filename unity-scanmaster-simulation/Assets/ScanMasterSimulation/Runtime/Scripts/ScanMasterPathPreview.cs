using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    [RequireComponent(typeof(LineRenderer))]
    public sealed class ScanMasterPathPreview : MonoBehaviour
    {
        [SerializeField] private ScanMasterScanPath scanPath;
        [SerializeField] private int sampleCount = 160;
        [SerializeField] private float lineWidth = 0.006f;
        [SerializeField] private Color positiveColor = new Color(0f, 0.78f, 1f, 0.48f);
        [SerializeField] private Color negativeColor = new Color(1f, 0.62f, 0.08f, 0.5f);

        private LineRenderer lineRenderer;

        public void Configure(ScanMasterScanPath path)
        {
            scanPath = path;
            Refresh();
        }

        private void Awake()
        {
            Refresh();
        }

        private void LateUpdate()
        {
            Refresh();
        }

        private void Refresh()
        {
            if (scanPath == null)
            {
                return;
            }

            if (lineRenderer == null)
            {
                lineRenderer = GetComponent<LineRenderer>();
            }

            sampleCount = Mathf.Clamp(sampleCount, 16, 512);
            lineRenderer.useWorldSpace = true;
            lineRenderer.loop = false;
            lineRenderer.textureMode = LineTextureMode.Stretch;
            lineRenderer.alignment = LineAlignment.View;
            lineRenderer.positionCount = sampleCount;
            lineRenderer.startWidth = lineWidth;
            lineRenderer.endWidth = lineWidth;

            var color = scanPath.PositiveDirection ? positiveColor : negativeColor;
            lineRenderer.startColor = color;
            lineRenderer.endColor = new Color(color.r, color.g, color.b, color.a * 0.38f);

            for (var i = 0; i < sampleCount; i++)
            {
                var t = sampleCount == 1 ? 0f : i / (float)(sampleCount - 1);
                lineRenderer.SetPosition(i, scanPath.Evaluate(t).position);
            }
        }

        private void OnValidate()
        {
            sampleCount = Mathf.Clamp(sampleCount, 16, 512);
            lineWidth = Mathf.Max(0.001f, lineWidth);
        }
    }
}
