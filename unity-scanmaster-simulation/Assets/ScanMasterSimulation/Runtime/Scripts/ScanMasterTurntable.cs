using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    public sealed class ScanMasterTurntable : MonoBehaviour
    {
        [SerializeField] private bool rotateWhenPlaying = true;
        [SerializeField] private float rpm = 2.5f;
        [SerializeField] private float rpmBlendSpeed = 2.4f;
        [SerializeField] private Vector3 localAxis = Vector3.up;

        private float currentRpm;

        public bool RotateWhenPlaying
        {
            get => rotateWhenPlaying;
            set => rotateWhenPlaying = value;
        }

        public float Rpm
        {
            get => rpm;
            set => rpm = value;
        }

        private void Update()
        {
            var targetRpm = rotateWhenPlaying ? rpm : 0f;
            var blend = 1f - Mathf.Exp(-rpmBlendSpeed * Time.deltaTime);
            currentRpm = Mathf.Lerp(currentRpm, targetRpm, blend);
            if (Mathf.Approximately(currentRpm, 0f))
            {
                return;
            }

            var degreesPerSecond = currentRpm * 360f / 60f;
            transform.Rotate(localAxis.normalized, degreesPerSecond * Time.deltaTime, Space.Self);
        }

        private void OnValidate()
        {
            rpmBlendSpeed = Mathf.Max(0.1f, rpmBlendSpeed);
        }
    }
}
