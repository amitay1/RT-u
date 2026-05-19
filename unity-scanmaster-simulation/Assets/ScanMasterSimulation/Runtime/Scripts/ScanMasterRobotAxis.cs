using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    public sealed class ScanMasterRobotAxis : MonoBehaviour
    {
        [SerializeField] private Vector3 localAxis = Vector3.right;
        [SerializeField] private float minPosition = -1f;
        [SerializeField] private float maxPosition = 1f;
        [SerializeField] private float maxSpeed = 0.5f;
        [SerializeField] private float targetPosition;

        private Vector3 baseLocalPosition;
        private bool hasBasePosition;

        public float CurrentPosition { get; private set; }
        public float TargetPosition => targetPosition;

        private void Awake()
        {
            CaptureBasePosition();
            CurrentPosition = Mathf.Clamp(targetPosition, minPosition, maxPosition);
            Apply(CurrentPosition);
        }

        private void Update()
        {
            CaptureBasePosition();
            var next = Mathf.MoveTowards(CurrentPosition, targetPosition, maxSpeed * Time.deltaTime);
            if (!Mathf.Approximately(next, CurrentPosition))
            {
                CurrentPosition = next;
                Apply(CurrentPosition);
            }
        }

        public void Configure(Vector3 axis, float min, float max, float speed)
        {
            localAxis = axis.sqrMagnitude > 0.0001f ? axis.normalized : Vector3.right;
            minPosition = Mathf.Min(min, max);
            maxPosition = Mathf.Max(min, max);
            maxSpeed = Mathf.Max(0.01f, speed);
            SetTarget(targetPosition, true);
        }

        public void SetTarget(float position, bool snap = false)
        {
            CaptureBasePosition();
            targetPosition = Mathf.Clamp(position, minPosition, maxPosition);
            if (snap)
            {
                CurrentPosition = targetPosition;
                Apply(CurrentPosition);
            }
        }

        public void SetNormalized(float normalized, bool snap = false)
        {
            SetTarget(Mathf.Lerp(minPosition, maxPosition, Mathf.Clamp01(normalized)), snap);
        }

        private void CaptureBasePosition()
        {
            if (hasBasePosition)
            {
                return;
            }

            localAxis = localAxis.sqrMagnitude > 0.0001f ? localAxis.normalized : Vector3.right;
            baseLocalPosition = transform.localPosition;
            hasBasePosition = true;
        }

        private void Apply(float position)
        {
            transform.localPosition = baseLocalPosition + localAxis.normalized * position;
        }

        private void OnValidate()
        {
            if (localAxis.sqrMagnitude < 0.0001f)
            {
                localAxis = Vector3.right;
            }

            if (maxPosition < minPosition)
            {
                var tmp = maxPosition;
                maxPosition = minPosition;
                minPosition = tmp;
            }

            maxSpeed = Mathf.Max(0.01f, maxSpeed);
            targetPosition = Mathf.Clamp(targetPosition, minPosition, maxPosition);
        }
    }
}

