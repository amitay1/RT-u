using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    [ExecuteAlways]
    public sealed class ScanMasterLinkBeam : MonoBehaviour
    {
        [SerializeField] private Transform start;
        [SerializeField] private Transform end;
        [SerializeField] private float thickness = 0.045f;

        public void Configure(Transform startTransform, Transform endTransform, float beamThickness)
        {
            start = startTransform;
            end = endTransform;
            thickness = Mathf.Max(0.005f, beamThickness);
            Refresh();
        }

        public void RefreshNow()
        {
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

            var delta = end.position - start.position;
            var length = delta.magnitude;
            if (length < 0.001f)
            {
                return;
            }

            transform.position = start.position + delta * 0.5f;
            transform.rotation = Quaternion.LookRotation(delta.normalized, Vector3.up);
            transform.localScale = new Vector3(thickness, thickness, length);
        }

        private void OnValidate()
        {
            thickness = Mathf.Max(0.005f, thickness);
            Refresh();
        }
    }
}
