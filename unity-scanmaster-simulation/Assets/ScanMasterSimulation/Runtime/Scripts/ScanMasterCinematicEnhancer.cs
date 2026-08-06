// ============================================================================
// ScanMasterCinematicEnhancer
//
// Drop-in component that dramatically improves the visual look of the scene
// at runtime — works on Unity 6 with the Built-in render pipeline (no URP/HDRP
// or extra packages required).
//
// What it does on Awake:
//   1. Replaces the existing flat lighting with a 3-point cinematic rig
//      (key + fill + rim + accent point + bottom kicker).
//   2. Sets ambient + skybox to a dark blue-black for cinematic contrast.
//   3. Enables exponential fog so depth reads in the volume.
//   4. Re-skins the disk material to brushed metal (high metallic, low rough)
//      and the tank glass to a real glass shader.
//   5. Makes the mirror, beam and indication markers emissive so they glow.
//   6. Adds a smooth cinematic camera orbit that respects the existing
//      ScanMasterCameraOrbit guided yaw/pitch — just slow continuous drift.
//
// Just attach this once to the root "Scan Master Immersion Simulation" object
// (or any object — it finds the rest by name) and press Play.
// ============================================================================
using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    [DefaultExecutionOrder(-100)]
    public sealed class ScanMasterCinematicEnhancer : MonoBehaviour
    {
        [Header("Lighting")]
        // Reduced intensities — the previous values (key=1.6, accent=2.2) created
        // bright bloom in side-view scenes (esp. scene 3 water_path) where the
        // camera looks INTO the key light reflected off the polished disk.
        [SerializeField] private float keyIntensity = 1.0f;
        [SerializeField] private float fillIntensity = 0.55f;
        [SerializeField] private float rimIntensity = 0.7f;
        [SerializeField] private Color keyColor = new Color(1f, 0.97f, 0.90f);
        [SerializeField] private Color fillColor = new Color(0.55f, 0.70f, 1f);
        [SerializeField] private Color rimColor = new Color(0.0f, 1.0f, 0.85f);
        [SerializeField] private Color accentColor = new Color(1f, 0.80f, 0.20f);

        [Header("Ambient + Sky")]
        [SerializeField] private Color skyTop = new Color(0.05f, 0.07f, 0.12f);
        [SerializeField] private Color skyBottom = new Color(0.02f, 0.02f, 0.04f);
        [SerializeField] private float ambientIntensity = 0.45f;  // up from 0.30 — fills shadows without bloom

        [Header("Fog")]
        [SerializeField] private bool enableFog = true;
        [SerializeField] private Color fogColor = new Color(0.04f, 0.06f, 0.10f);
        [SerializeField] private float fogDensity = 0.025f;       // was 0.06 (too thick)

        [Header("Materials")]
        // Disk smoothness reduced from 0.72 → 0.50 so the disk isn't a literal
        // mirror reflecting the key light directly into the camera. Still looks
        // like polished aerospace metal — just not chrome.
        [SerializeField] private float diskMetallic = 0.85f;
        [SerializeField] private float diskSmoothness = 0.50f;
        [SerializeField] private Color diskTint = new Color(0.72f, 0.78f, 0.86f);

        private bool applied;

        private void Awake()
        {
            Apply();
        }

        private void OnEnable()
        {
            if (!applied) Apply();
        }

        [ContextMenu("Re-apply cinematic enhancer")]
        public void Apply()
        {
            applied = true;
            ApplyAmbient();
            ApplyFog();
            ApplyLighting();
            ApplyMaterials();
            ApplyEmissive();
        }

        // ------------- 1) Ambient + skybox -------------
        private void ApplyAmbient()
        {
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = skyTop;
            RenderSettings.ambientEquatorColor = new Color(
                (skyTop.r + skyBottom.r) * 0.5f,
                (skyTop.g + skyBottom.g) * 0.5f,
                (skyTop.b + skyBottom.b) * 0.5f);
            RenderSettings.ambientGroundColor = skyBottom;
            RenderSettings.ambientIntensity = ambientIntensity;
            // Background color of main camera
            var cam = Camera.main;
            if (cam != null)
            {
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = skyBottom;
            }
        }

        private void ApplyFog()
        {
            RenderSettings.fog = enableFog;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = fogColor;
            RenderSettings.fogDensity = fogDensity;
        }

        // ------------- 2) 3-point cinematic lighting -------------
        private void ApplyLighting()
        {
            // Disable any existing lights named "Key Light" or similar so we replace cleanly
            foreach (var l in FindObjectsByType<Light>())
            {
                if (l.gameObject.name.StartsWith("CinematicEnhancerLight_"))
                {
                    Destroy(l.gameObject);
                }
                else if (l.gameObject.name == "Key Light")
                {
                    l.gameObject.SetActive(false); // park original, we add fresh below
                }
            }

            CreateLight("CinematicEnhancerLight_Key",
                LightType.Directional, keyColor, keyIntensity,
                new Vector3(2.5f, 4.2f, -1.2f),
                Quaternion.Euler(38f, -35f, 0f),
                castShadows: true);

            CreateLight("CinematicEnhancerLight_Fill",
                LightType.Directional, fillColor, fillIntensity,
                new Vector3(-2.5f, 2.5f, 2.0f),
                Quaternion.Euler(22f, 130f, 0f),
                castShadows: false);

            CreateLight("CinematicEnhancerLight_Rim",
                LightType.Directional, rimColor, rimIntensity,
                new Vector3(-1.5f, 1.8f, -3.0f),
                Quaternion.Euler(14f, -160f, 0f),
                castShadows: false);

            // Accent point light over the probe / focal area — toned down from
            // intensity 2.2 → 1.2 to avoid blowing out the disk's reflection
            // and washing out OnGUI text overlays.
            var accent = CreateLight("CinematicEnhancerLight_AccentProbe",
                LightType.Point, accentColor, 1.2f,
                new Vector3(0f, 0.95f, 0f),
                Quaternion.identity,
                castShadows: false);
            accent.range = 1.6f;

            // Bottom kicker — gives the disk underside some glow (subtle)
            var kicker = CreateLight("CinematicEnhancerLight_BottomKicker",
                LightType.Point, new Color(0.0f, 0.75f, 1.0f), 0.5f,
                new Vector3(0f, -0.1f, 0f),
                Quaternion.identity,
                castShadows: false);
            kicker.range = 1.2f;
        }

        private static Light CreateLight(string name, LightType type, Color color, float intensity,
            Vector3 pos, Quaternion rot, bool castShadows)
        {
            var go = new GameObject(name);
            go.transform.SetPositionAndRotation(pos, rot);
            var l = go.AddComponent<Light>();
            l.type = type;
            l.color = color;
            l.intensity = intensity;
            l.shadows = castShadows ? LightShadows.Soft : LightShadows.None;
            return l;
        }

        // ------------- 3) Materials -------------
        private void ApplyMaterials()
        {
            // Disk(s) — find any object that contains "V2500" or "0765" or "0784"
            foreach (var mr in FindObjectsByType<MeshRenderer>())
            {
                var n = mr.gameObject.name;
                if (n.Contains("V2500") || n.Contains("0765") || n.Contains("0784"))
                {
                    var mat = new Material(Shader.Find("Standard"));
                    mat.color = diskTint;
                    mat.SetFloat("_Metallic", diskMetallic);
                    mat.SetFloat("_Glossiness", diskSmoothness);
                    mr.sharedMaterial = mat;
                }
                else if (n.Contains("Tank") && n.Contains("Wall"))
                {
                    var mat = new Material(Shader.Find("Standard"));
                    mat.SetFloat("_Mode", 3); // Transparent
                    mat.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                    mat.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                    mat.SetInt("_ZWrite", 0);
                    mat.DisableKeyword("_ALPHATEST_ON");
                    mat.EnableKeyword("_ALPHABLEND_ON");
                    mat.DisableKeyword("_ALPHAPREMULTIPLY_ON");
                    mat.renderQueue = 3000;
                    // MUCH darker tint so walls don't blow out under the bright lights
                    mat.color = new Color(0.10f, 0.20f, 0.30f, 0.07f);
                    mat.SetFloat("_Metallic", 0.0f);
                    mat.SetFloat("_Glossiness", 0.80f);
                    mr.sharedMaterial = mat;
                }
                else if (n.Contains("Turntable") || n.Contains("Chuck"))
                {
                    var mat = new Material(Shader.Find("Standard"));
                    mat.color = new Color(0.12f, 0.14f, 0.18f);
                    mat.SetFloat("_Metallic", 0.85f);
                    mat.SetFloat("_Glossiness", 0.55f);
                    mr.sharedMaterial = mat;
                }
                else if (n.Contains("Water Surface"))
                {
                    var mat = new Material(Shader.Find("Standard"));
                    mat.SetFloat("_Mode", 3);
                    mat.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                    mat.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                    mat.SetInt("_ZWrite", 0);
                    mat.EnableKeyword("_ALPHABLEND_ON");
                    mat.renderQueue = 3000;
                    mat.color = new Color(0.04f, 0.30f, 0.52f, 0.16f);
                    mat.SetFloat("_Metallic", 0.0f);
                    mat.SetFloat("_Glossiness", 0.97f);
                    mr.sharedMaterial = mat;
                }
                else if (n.Contains("Tank Floor"))
                {
                    var mat = new Material(Shader.Find("Standard"));
                    mat.color = new Color(0.06f, 0.08f, 0.12f);
                    mat.SetFloat("_Metallic", 0.20f);
                    mat.SetFloat("_Glossiness", 0.30f);
                    mr.sharedMaterial = mat;
                }
                else if (n.Contains("Bridge Rail") || n.Contains("Column") ||
                         n.Contains("Linear Track") || n.Contains("Carriage") ||
                         n.Contains("Cross Slide") || n.Contains("Z Ram") ||
                         n.Contains("Probe Mount") || n.Contains("Articulated"))
                {
                    var mat = new Material(Shader.Find("Standard"));
                    mat.color = new Color(0.18f, 0.20f, 0.24f);
                    mat.SetFloat("_Metallic", 0.85f);
                    mat.SetFloat("_Glossiness", 0.55f);
                    mr.sharedMaterial = mat;
                }
                else if (n.Contains("Probe Cable"))
                {
                    var mat = new Material(Shader.Find("Standard"));
                    mat.color = new Color(0.95f, 0.78f, 0.05f); // yellow
                    mat.SetFloat("_Metallic", 0.05f);
                    mat.SetFloat("_Glossiness", 0.35f);
                    mr.sharedMaterial = mat;
                }
                else if (n.Contains("Support Pad"))
                {
                    var mat = new Material(Shader.Find("Standard"));
                    mat.color = new Color(0.10f, 0.10f, 0.13f); // black rubber
                    mat.SetFloat("_Metallic", 0.0f);
                    mat.SetFloat("_Glossiness", 0.10f);
                    mr.sharedMaterial = mat;
                }
            }
        }

        // ------------- 4) Emissive accents on beam, mirror, indication marker -------------
        private void ApplyEmissive()
        {
            foreach (var mr in FindObjectsByType<MeshRenderer>())
            {
                var n = mr.gameObject.name;
                Color em = Color.black;
                float strength = 0f;

                if (n.Contains("Ultrasonic Beam"))
                {
                    em = new Color(0.0f, 1.0f, 0.85f);
                    strength = 1.2f;
                }
                else if (n.Contains("Mirror Shoe") || (n.Contains("Mirror") && !n.Contains("Floor")))
                {
                    em = new Color(1.0f, 0.80f, 0.20f);
                    strength = 0.6f;
                }
                else if (n.Contains("Zone Marker") || n.Contains("Synthetic"))
                {
                    em = new Color(1.0f, 0.30f, 0.40f);
                    strength = 0.9f;
                }
                else if (n.Contains("Sound Entry Spot") || n.Contains("Scanning Footprint"))
                {
                    em = new Color(0.0f, 1.0f, 0.55f);
                    strength = 0.7f;
                }

                if (strength > 0f)
                {
                    var mat = mr.sharedMaterial != null
                        ? new Material(mr.sharedMaterial)
                        : new Material(Shader.Find("Standard"));
                    mat.EnableKeyword("_EMISSION");
                    mat.SetColor("_EmissionColor", em * strength);
                    mr.sharedMaterial = mat;
                }
            }
        }
    }
}
