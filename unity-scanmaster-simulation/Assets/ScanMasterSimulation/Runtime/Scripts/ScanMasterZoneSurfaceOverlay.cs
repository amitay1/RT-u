using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace ScanMaster.UnitySimulation
{
    [DisallowMultipleComponent]
    [RequireComponent(typeof(MeshFilter))]
    public sealed class ScanMasterZoneSurfaceOverlay : MonoBehaviour
    {
        [SerializeField] private bool showAllZones = true;
        [SerializeField] private string activeZone = "E";
        [SerializeField] private float inactiveAlpha = 0.12f;
        [SerializeField] private float activeAlpha = 0.62f;
        [SerializeField] private float surfaceOffsetMillimeters = 0.65f;
        [SerializeField] private bool pulseActiveZone = true;

        private readonly Dictionary<string, MeshRenderer> zoneRenderers = new Dictionary<string, MeshRenderer>();
        private readonly Dictionary<string, Material> zoneMaterials = new Dictionary<string, Material>();
        private bool built;

        private static readonly ZoneSpec[] Zones =
        {
            new ZoneSpec("E", "Upper Web Transition", new Color(1.0f, 0.25f, 0.42f), 120f, 205f, -22f, 14f),
            new ZoneSpec("A", "Upper Chamfer", new Color(1.0f, 0.78f, 0.08f), 100f, 150f, -18f, 30f),
            new ZoneSpec("B", "Upper Land", new Color(0.05f, 0.95f, 0.45f), 82f, 122f, -2f, 38f),
            new ZoneSpec("C", "Bore Entry Chamfer", new Color(0.0f, 0.78f, 1.0f), 70f, 96f, 16f, 56f),
            new ZoneSpec("D", "Bore ID", new Color(0.68f, 0.38f, 1.0f), 58f, 72f, 48f, 116f),
        };

        public string ActiveZone => activeZone;

        private void Awake()
        {
            BuildIfNeeded();
            RefreshVisibility();
        }

        private void OnEnable()
        {
            BuildIfNeeded();
            RefreshVisibility();
        }

        private void Update()
        {
            if (!pulseActiveZone || string.IsNullOrEmpty(activeZone))
            {
                return;
            }

            RefreshVisibility();
        }

        public void SetActiveZone(string zoneId)
        {
            activeZone = zoneId ?? "";
            showAllZones = true;
            BuildIfNeeded();
            RefreshVisibility();
        }

        public void SetVisible(bool value)
        {
            showAllZones = value;
            RefreshVisibility();
        }

        public void SetOnlyActive(string zoneId)
        {
            activeZone = zoneId ?? "";
            showAllZones = false;
            BuildIfNeeded();
            RefreshVisibility();
        }

        public void Rebuild()
        {
            for (var i = transform.childCount - 1; i >= 0; i--)
            {
                var child = transform.GetChild(i);
                if (child.name.StartsWith("Zone Surface Overlay "))
                {
                    DestroyImmediate(child.gameObject);
                }
            }

            zoneRenderers.Clear();
            zoneMaterials.Clear();
            built = false;
            BuildIfNeeded();
            RefreshVisibility();
        }

        private void BuildIfNeeded()
        {
            if (built)
            {
                return;
            }

            built = true;
            var filter = GetComponent<MeshFilter>();
            var source = filter != null ? filter.sharedMesh : null;
            if (source == null)
            {
                return;
            }

            var sourceVertices = source.vertices;
            var sourceTriangles = source.triangles;
            if (sourceVertices == null || sourceVertices.Length == 0 || sourceTriangles == null || sourceTriangles.Length == 0)
            {
                return;
            }

            for (var i = 0; i < Zones.Length; i++)
            {
                BuildZone(sourceVertices, sourceTriangles, Zones[i]);
            }
        }

        private void BuildZone(Vector3[] sourceVertices, int[] sourceTriangles, ZoneSpec zone)
        {
            var vertices = new List<Vector3>();
            var normals = new List<Vector3>();
            var indices = new List<int>();

            for (var i = 0; i < sourceTriangles.Length; i += 3)
            {
                var a = sourceVertices[sourceTriangles[i]];
                var b = sourceVertices[sourceTriangles[i + 1]];
                var c = sourceVertices[sourceTriangles[i + 2]];
                var center = (a + b + c) / 3f;
                if (!zone.Contains(center))
                {
                    continue;
                }

                var normal = Vector3.Cross(b - a, c - a).normalized;
                if (normal.sqrMagnitude < 0.1f)
                {
                    normal = Vector3.up;
                }

                var offset = normal * surfaceOffsetMillimeters;
                var baseIndex = vertices.Count;
                vertices.Add(a + offset);
                vertices.Add(b + offset);
                vertices.Add(c + offset);
                normals.Add(normal);
                normals.Add(normal);
                normals.Add(normal);
                indices.Add(baseIndex);
                indices.Add(baseIndex + 1);
                indices.Add(baseIndex + 2);
            }

            if (vertices.Count == 0)
            {
                return;
            }

            var mesh = new Mesh
            {
                name = "Zone_" + zone.Id + "_Surface_Mesh",
                indexFormat = vertices.Count > 65535 ? IndexFormat.UInt32 : IndexFormat.UInt16
            };
            mesh.SetVertices(vertices);
            mesh.SetNormals(normals);
            mesh.SetTriangles(indices, 0);
            mesh.RecalculateBounds();

            var go = new GameObject("Zone Surface Overlay " + zone.Id + " - " + zone.Name);
            go.transform.SetParent(transform, false);
            var mf = go.AddComponent<MeshFilter>();
            mf.sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>();
            var material = CreateZoneMaterial(zone);
            mr.sharedMaterial = material;
            mr.shadowCastingMode = ShadowCastingMode.Off;
            mr.receiveShadows = false;

            zoneRenderers[zone.Id] = mr;
            zoneMaterials[zone.Id] = material;
        }

        private static Material CreateZoneMaterial(ZoneSpec zone)
        {
            var material = new Material(Shader.Find("Standard"));
            material.name = "SM_Zone_" + zone.Id + "_Overlay_Runtime";
            material.color = new Color(zone.Color.r, zone.Color.g, zone.Color.b, 0.4f);
            material.SetFloat("_Mode", 3f);
            material.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha);
            material.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
            material.SetInt("_ZWrite", 0);
            material.DisableKeyword("_ALPHATEST_ON");
            material.EnableKeyword("_ALPHABLEND_ON");
            material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
            material.EnableKeyword("_EMISSION");
            material.SetFloat("_Metallic", 0f);
            material.SetFloat("_Glossiness", 0.88f);
            material.renderQueue = (int)RenderQueue.Transparent + 35;
            return material;
        }

        private void RefreshVisibility()
        {
            foreach (var zone in Zones)
            {
                if (!zoneRenderers.TryGetValue(zone.Id, out var renderer) || renderer == null)
                {
                    continue;
                }

                var isActive = string.Equals(zone.Id, activeZone, System.StringComparison.OrdinalIgnoreCase);
                renderer.enabled = showAllZones || isActive;
                if (!zoneMaterials.TryGetValue(zone.Id, out var material) || material == null)
                {
                    continue;
                }

                var alpha = isActive ? activeAlpha : inactiveAlpha;
                if (isActive && pulseActiveZone)
                {
                    alpha += Mathf.Sin(Time.time * 5.0f) * 0.08f;
                }

                alpha = Mathf.Clamp01(alpha);
                var color = new Color(zone.Color.r, zone.Color.g, zone.Color.b, alpha);
                material.color = color;
                material.SetColor("_EmissionColor", zone.Color * (isActive ? 0.85f : 0.22f));
            }
        }

        private readonly struct ZoneSpec
        {
            public readonly string Id;
            public readonly string Name;
            public readonly Color Color;
            private readonly float minRadius;
            private readonly float maxRadius;
            private readonly float minZ;
            private readonly float maxZ;

            public ZoneSpec(string id, string name, Color color, float minRadius, float maxRadius, float minZ, float maxZ)
            {
                Id = id;
                Name = name;
                Color = color;
                this.minRadius = minRadius;
                this.maxRadius = maxRadius;
                this.minZ = minZ;
                this.maxZ = maxZ;
            }

            public bool Contains(Vector3 localPoint)
            {
                var radius = Mathf.Sqrt(localPoint.x * localPoint.x + localPoint.y * localPoint.y);
                return radius >= minRadius && radius <= maxRadius && localPoint.z >= minZ && localPoint.z <= maxZ;
            }
        }
    }
}
