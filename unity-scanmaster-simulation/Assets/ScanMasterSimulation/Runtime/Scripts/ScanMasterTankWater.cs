using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    public sealed class ScanMasterTankWater : MonoBehaviour
    {
        [SerializeField] private Renderer waterRenderer;
        [SerializeField] private float waveAmplitude = 0.01f;
        [SerializeField] private float waveSpeed = 0.7f;
        [SerializeField] private Vector2 textureScroll = new Vector2(0.015f, 0.02f);

        private Vector3 startPosition;
        private MaterialPropertyBlock propertyBlock;
        private static readonly int MainTexSt = Shader.PropertyToID("_MainTex_ST");
        private static readonly int BaseMapSt = Shader.PropertyToID("_BaseMap_ST");

        private void Awake()
        {
            startPosition = transform.localPosition;
            propertyBlock = new MaterialPropertyBlock();
            if (waterRenderer == null)
            {
                waterRenderer = GetComponent<Renderer>();
            }
        }

        private void Update()
        {
            var local = startPosition;
            local.y += Mathf.Sin(Time.time * waveSpeed) * waveAmplitude;
            transform.localPosition = local;

            if (waterRenderer == null)
            {
                return;
            }

            waterRenderer.GetPropertyBlock(propertyBlock);
            var offset = textureScroll * Time.time;
            var st = new Vector4(1f, 1f, offset.x, offset.y);
            propertyBlock.SetVector(MainTexSt, st);
            propertyBlock.SetVector(BaseMapSt, st);
            waterRenderer.SetPropertyBlock(propertyBlock);
        }
    }
}

