using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    public sealed class ScanMasterScanCueMarker : MonoBehaviour
    {
        [SerializeField] private ScanMasterSimulationController controller;
        [SerializeField] private ScanMasterScanPath scanPath;
        [SerializeField] private float normalizedPosition = 0.68f;
        [SerializeField] private float baseScale = 0.045f;
        [SerializeField] private Color idleColor = new Color(1f, 0.62f, 0.08f, 0.45f);
        [SerializeField] private Color activeColor = new Color(1f, 0.1f, 0.02f, 0.95f);

        private Renderer markerRenderer;

        public void Configure(ScanMasterSimulationController simulationController, ScanMasterScanPath path)
        {
            controller = simulationController;
            scanPath = path;
            Refresh();
        }

        private void Awake()
        {
            markerRenderer = GetComponent<Renderer>();
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

            if (markerRenderer == null)
            {
                markerRenderer = GetComponent<Renderer>();
            }

            var pose = scanPath.Evaluate(normalizedPosition);
            transform.position = pose.position + Vector3.up * 0.012f;

            var progress = controller != null ? controller.Progress : 0f;
            var distance = Mathf.Abs(Mathf.DeltaAngle(progress * 360f, normalizedPosition * 360f)) / 360f;
            var hot = distance < 0.035f;
            var pulse = hot ? 1f + Mathf.Sin(Time.time * 15f) * 0.22f : 0.72f;
            transform.localScale = Vector3.one * baseScale * pulse;

            if (markerRenderer != null)
            {
                markerRenderer.material.color = hot ? activeColor : idleColor;
            }
        }

        private void OnValidate()
        {
            normalizedPosition = Mathf.Clamp01(normalizedPosition);
            baseScale = Mathf.Max(0.005f, baseScale);
        }
    }
}
