using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    public sealed class ScanMasterPartSelector : MonoBehaviour
    {
        [SerializeField] private GameObject stage1Part;
        [SerializeField] private GameObject stage2Part;
        [SerializeField] private GameObject stage1Guide;
        [SerializeField] private GameObject stage2Guide;
        [SerializeField] private ScanMasterScanPath scanPath;
        [SerializeField] private int activeStage = 1;
        [SerializeField] private KeyCode stage1Key = KeyCode.Alpha1;
        [SerializeField] private KeyCode stage2Key = KeyCode.Alpha2;

        public int ActiveStage => activeStage;

        private void Start()
        {
            SelectStage(activeStage);
        }

        private void Update()
        {
            if (ScanMasterInput.GetKeyDown(stage1Key))
            {
                SelectStage(1);
            }

            if (ScanMasterInput.GetKeyDown(stage2Key))
            {
                SelectStage(2);
            }
        }

        public void SelectStage(int stage)
        {
            activeStage = stage == 2 ? 2 : 1;

            if (stage1Part != null)
            {
                stage1Part.SetActive(activeStage == 1);
            }

            if (stage2Part != null)
            {
                stage2Part.SetActive(activeStage == 2);
            }

            if (stage1Guide != null)
            {
                stage1Guide.SetActive(activeStage == 1);
            }

            if (stage2Guide != null)
            {
                stage2Guide.SetActive(activeStage == 2);
            }

            if (scanPath != null)
            {
                scanPath.ScanRadiusMeters = activeStage == 1 ? 0.18f : 0.16f;
                scanPath.ScanLengthMeters = activeStage == 1 ? 0.16f : 0.14f;
                scanPath.Revolutions = activeStage == 1 ? 1.5f : 1.25f;
                scanPath.StartHeightMeters = activeStage == 1 ? 0.32f : 0.30f;
                scanPath.ProbeStandOffMeters = 0.04f;
            }
        }
    }
}
