using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    public sealed class ScanMasterCameraOrbit : MonoBehaviour
    {
        [SerializeField] private Transform target;
        [SerializeField] private float distance = 4.1f;
        [SerializeField] private float yaw = -38f;
        [SerializeField] private float pitch = 24f;
        [SerializeField] private Vector3 focusOffset = Vector3.zero;
        [SerializeField] private float rotateSpeed = 120f;
        [SerializeField] private float zoomSpeed = 0.65f;
        [SerializeField] private float minDistance = 1.5f;
        [SerializeField] private float maxDistance = 7f;
        [SerializeField] private float guidedBlendSpeed = 1.65f;
        [SerializeField] private bool cinematicDrift = true;
        [SerializeField] private float driftYawDegrees = 1.6f;
        [SerializeField] private float driftPitchDegrees = 0.55f;
        [SerializeField] private float driftSpeed = 0.28f;

        private float targetDistance;
        private float targetYaw;
        private float targetPitch;
        private Vector3 targetFocusOffset;
        private bool hasGuidedTarget;

        public void SetGuidedView(float guidedYaw, float guidedPitch, float guidedDistance, Vector3 guidedFocusOffset)
        {
            targetYaw = guidedYaw;
            targetPitch = Mathf.Clamp(guidedPitch, -5f, 70f);
            targetDistance = Mathf.Clamp(guidedDistance, minDistance, maxDistance);
            targetFocusOffset = guidedFocusOffset;
            hasGuidedTarget = true;
        }

        private void LateUpdate()
        {
            if (target == null)
            {
                return;
            }

            if (ScanMasterInput.GetMouseButton(1))
            {
                var delta = ScanMasterInput.GetMouseDelta();
                yaw += delta.x * rotateSpeed * Time.deltaTime;
                pitch -= delta.y * rotateSpeed * Time.deltaTime;
                pitch = Mathf.Clamp(pitch, -5f, 70f);
                targetYaw = yaw;
                targetPitch = pitch;
                targetDistance = distance;
                targetFocusOffset = focusOffset;
            }

            var scroll = ScanMasterInput.GetScrollY();
            if (!Mathf.Approximately(scroll, 0f))
            {
                distance = Mathf.Clamp(distance - scroll * zoomSpeed, minDistance, maxDistance);
                targetDistance = distance;
            }

            if (hasGuidedTarget)
            {
                var blend = 1f - Mathf.Exp(-guidedBlendSpeed * Time.unscaledDeltaTime);
                yaw = Mathf.LerpAngle(yaw, targetYaw, blend);
                pitch = Mathf.Lerp(pitch, targetPitch, blend);
                distance = Mathf.Lerp(distance, targetDistance, blend);
                focusOffset = Vector3.Lerp(focusOffset, targetFocusOffset, blend);
            }

            var displayYaw = yaw;
            var displayPitch = pitch;
            if (cinematicDrift)
            {
                displayYaw += Mathf.Sin(Time.unscaledTime * driftSpeed) * driftYawDegrees;
                displayPitch += Mathf.Sin(Time.unscaledTime * driftSpeed * 0.73f + 1.1f) * driftPitchDegrees;
            }

            var rotation = Quaternion.Euler(displayPitch, displayYaw, 0f);
            var focus = target.position + focusOffset;
            transform.position = focus + rotation * new Vector3(0f, 0f, -distance);
            transform.rotation = rotation;
        }

        private void OnValidate()
        {
            minDistance = Mathf.Max(0.1f, minDistance);
            maxDistance = Mathf.Max(minDistance, maxDistance);
            guidedBlendSpeed = Mathf.Max(0.1f, guidedBlendSpeed);
            driftYawDegrees = Mathf.Max(0f, driftYawDegrees);
            driftPitchDegrees = Mathf.Max(0f, driftPitchDegrees);
            driftSpeed = Mathf.Max(0f, driftSpeed);
        }
    }
}
