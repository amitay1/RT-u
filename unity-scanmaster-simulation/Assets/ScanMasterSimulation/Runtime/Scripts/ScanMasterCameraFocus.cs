using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    public sealed class ScanMasterCameraFocus : MonoBehaviour
    {
        [SerializeField] private Transform partCenter;
        [SerializeField] private Transform probeMount;
        [SerializeField] private float probeWeight;
        [SerializeField] private float blendSpeed = 1.4f;

        private float targetProbeWeight;

        public void Configure(Transform part, Transform probe)
        {
            partCenter = part;
            probeMount = probe;
            Refresh(true);
        }

        public void SetProbeWeight(float weight)
        {
            targetProbeWeight = Mathf.Clamp01(weight);
        }

        private void LateUpdate()
        {
            Refresh(false);
        }

        private void Refresh(bool snap)
        {
            var partPosition = partCenter != null ? partCenter.position : Vector3.zero;
            var probePosition = probeMount != null ? probeMount.position : partPosition;

            if (snap)
            {
                probeWeight = targetProbeWeight;
            }
            else
            {
                var blend = 1f - Mathf.Exp(-blendSpeed * Time.unscaledDeltaTime);
                probeWeight = Mathf.Lerp(probeWeight, targetProbeWeight, blend);
            }

            transform.position = Vector3.Lerp(partPosition, probePosition, probeWeight);
        }

        private void OnValidate()
        {
            probeWeight = Mathf.Clamp01(probeWeight);
            targetProbeWeight = Mathf.Clamp01(targetProbeWeight);
            blendSpeed = Mathf.Max(0.1f, blendSpeed);
        }
    }
}
