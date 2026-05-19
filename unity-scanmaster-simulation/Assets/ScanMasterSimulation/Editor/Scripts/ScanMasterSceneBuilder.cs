using System;
using System.Collections.Generic;
using System.IO;
using ScanMaster.UnitySimulation;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;

namespace ScanMaster.UnitySimulation.Editor
{
    public static class ScanMasterSceneBuilder
    {
        private const string Root = "Assets/ScanMasterSimulation";
        private const string SourceModelDir = Root + "/Models/PW/Source";
        private const string GeneratedModelDir = Root + "/Models/Generated";
        private const string MaterialDir = Root + "/Materials";
        private const string ScenePath = Root + "/Scenes/ScanMasterImmersionDemo.unity";

        private static readonly PartImportSpec[] Parts =
        {
            new PartImportSpec(
                "Engine V2500-A5-0765-Model.stl",
                "V2500_A5_0765_Mesh.asset",
                "PW_V2500_A5_0765_HPT_Disk.prefab",
                "P&W V2500-A5 0765 - provisional Stage 1",
                0.58f),
            new PartImportSpec(
                "Engine V2500-A5-0784-Model.stl",
                "V2500_A5_0784_Mesh.asset",
                "PW_V2500_A5_0784_HPT_Disk.prefab",
                "P&W V2500-A5 0784 - provisional Stage 2",
                0.52f)
        };

        [MenuItem("Scan Master/Build Simulation Scene")]
        public static void BuildSimulationScene()
        {
            EnsureFolders();
            var materials = EnsureMaterials();
            var meshes = ImportMeshes();
            CreatePartPrefabs(meshes, materials);
            CreateScene(meshes, materials);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            ShowCompletion("Simulation scene and generated assets are ready.");
        }

        [MenuItem("Scan Master/Reimport P&W STL Meshes")]
        public static void ReimportMeshes()
        {
            EnsureFolders();
            ImportMeshes();
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            ShowCompletion("P&W STL meshes were reimported.");
        }

        [MenuItem("Scan Master/Export Unity Package")]
        public static void ExportUnityPackage()
        {
            const string packagePath = "Builds/ScanMasterSimulation.unitypackage";
            Directory.CreateDirectory("Builds");
            AssetDatabase.ExportPackage(
                Root,
                packagePath,
                ExportPackageOptions.Recurse | ExportPackageOptions.IncludeDependencies);
            ShowCompletion("Unity package exported to " + packagePath);
        }

        private static void ShowCompletion(string message)
        {
            Debug.Log("Scan Master: " + message);
        }

        private static void EnsureFolders()
        {
            EnsureFolder("Assets", "ScanMasterSimulation");
            EnsureFolder(Root, "Models");
            EnsureFolder(Root + "/Models", "Generated");
            EnsureFolder(Root + "/Models", "PW");
            EnsureFolder(Root + "/Models/PW", "Source");
            EnsureFolder(Root, "Materials");
            EnsureFolder(Root, "Scenes");
            EnsureFolder(Root, "TrainingImages");
        }

        private static void EnsureFolder(string parent, string child)
        {
            var path = parent + "/" + child;
            if (!AssetDatabase.IsValidFolder(path))
            {
                AssetDatabase.CreateFolder(parent, child);
            }
        }

        private static MaterialSet EnsureMaterials()
        {
            return new MaterialSet
            {
                Steel = GetOrCreateMaterial("SM_NickelSteel.mat", new Color(0.58f, 0.61f, 0.64f), 0.45f, 0.75f),
                Robot = GetOrCreateMaterial("SM_RobotGraphite.mat", new Color(0.18f, 0.2f, 0.22f), 0.35f, 0.7f),
                Yellow = GetOrCreateMaterial("SM_SafetyYellow.mat", new Color(1f, 0.73f, 0.08f), 0.2f, 0.45f),
                Water = GetOrCreateMaterial("SM_Water.mat", new Color(0.16f, 0.58f, 0.86f, 0.22f), 0.03f, 0.55f, true),
                Glass = GetOrCreateMaterial("SM_TankGlass.mat", new Color(0.68f, 0.86f, 0.95f, 0.22f), 0.02f, 0.05f, true),
                Beam = GetOrCreateMaterial("SM_UltrasonicBeam.mat", new Color(0f, 0.9f, 0.55f, 0.75f), 0f, 0f, true),
                Dark = GetOrCreateMaterial("SM_DarkRubber.mat", new Color(0.04f, 0.045f, 0.05f), 0.6f, 0.45f)
            };
        }

        private static Material GetOrCreateMaterial(string fileName, Color color, float metallic, float smoothness, bool transparent = false)
        {
            var path = MaterialDir + "/" + fileName;
            var material = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (material == null)
            {
                material = new Material(Shader.Find("Standard"));
                AssetDatabase.CreateAsset(material, path);
            }

            material.shader = Shader.Find("Standard");
            material.color = color;
            material.SetFloat("_Metallic", metallic);
            material.SetFloat("_Glossiness", smoothness);

            if (transparent)
            {
                material.SetFloat("_Mode", 3f);
                material.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha);
                material.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
                material.SetInt("_ZWrite", 0);
                material.DisableKeyword("_ALPHATEST_ON");
                material.EnableKeyword("_ALPHABLEND_ON");
                material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
                material.renderQueue = (int)RenderQueue.Transparent;
            }
            else
            {
                material.SetFloat("_Mode", 0f);
                material.SetInt("_SrcBlend", (int)BlendMode.One);
                material.SetInt("_DstBlend", (int)BlendMode.Zero);
                material.SetInt("_ZWrite", 1);
                material.DisableKeyword("_ALPHATEST_ON");
                material.DisableKeyword("_ALPHABLEND_ON");
                material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
                material.renderQueue = -1;
            }

            EditorUtility.SetDirty(material);
            return material;
        }

        private static Dictionary<string, Mesh> ImportMeshes()
        {
            var result = new Dictionary<string, Mesh>(StringComparer.OrdinalIgnoreCase);
            foreach (var part in Parts)
            {
                var sourcePath = SourceModelDir + "/" + part.SourceFile;
                var assetPath = GeneratedModelDir + "/" + part.MeshAssetFile;
                if (!File.Exists(sourcePath))
                {
                    Debug.LogWarning("Missing STL source file: " + sourcePath);
                    continue;
                }

                var mesh = StlMeshImporter.LoadBinaryStl(sourcePath, Path.GetFileNameWithoutExtension(part.SourceFile));
                mesh.name = Path.GetFileNameWithoutExtension(part.MeshAssetFile);
                mesh.RecalculateBounds();

                var existing = AssetDatabase.LoadAssetAtPath<Mesh>(assetPath);
                if (existing != null)
                {
                    EditorUtility.CopySerialized(mesh, existing);
                    EditorUtility.SetDirty(existing);
                    result[part.SourceFile] = existing;
                }
                else
                {
                    AssetDatabase.CreateAsset(mesh, assetPath);
                    result[part.SourceFile] = mesh;
                }
            }

            return result;
        }

        private static void CreatePartPrefabs(Dictionary<string, Mesh> meshes, MaterialSet materials)
        {
            foreach (var part in Parts)
            {
                if (!meshes.TryGetValue(part.SourceFile, out var mesh))
                {
                    continue;
                }

                var root = new GameObject(Path.GetFileNameWithoutExtension(part.PrefabFile));
                var meshObject = CreateMeshObject("Disk Mesh", mesh, materials.Steel, root.transform);
                FitRendererToMaxSize(meshObject.GetComponent<Renderer>(), part.FitDiameterMeters);
                AddZoneRings(root.transform, part.FitDiameterMeters, materials.Beam);

                var prefabPath = GeneratedModelDir + "/" + part.PrefabFile;
                PrefabUtility.SaveAsPrefabAsset(root, prefabPath);
                UnityEngine.Object.DestroyImmediate(root);
            }
        }

        private static void CreateScene(Dictionary<string, Mesh> meshes, MaterialSet materials)
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            scene.name = "ScanMasterImmersionDemo";

            CreateLighting();

            var root = new GameObject("Scan Master Immersion Simulation");
            var tank = CreateTank(root.transform, materials);
            var turntable = CreateTurntable(root.transform, materials);
            var partRoot = new GameObject("P&W Parts").transform;
            partRoot.SetParent(turntable.transform, false);
            partRoot.localPosition = new Vector3(0f, 0.11f, 0f);

            GameObject stage1 = null;
            GameObject stage2 = null;

            if (meshes.TryGetValue(Parts[0].SourceFile, out var stage1Mesh))
            {
                stage1 = CreateMeshObject("P&W V2500-A5 0765 / Stage 1", stage1Mesh, materials.Steel, partRoot);
                FitRendererToMaxSize(stage1.GetComponent<Renderer>(), Parts[0].FitDiameterMeters);
                PlaceRendererBottomAt(stage1.GetComponent<Renderer>(), 0.18f);
            }

            if (meshes.TryGetValue(Parts[1].SourceFile, out var stage2Mesh))
            {
                stage2 = CreateMeshObject("P&W V2500-A5 0784 / Stage 2", stage2Mesh, materials.Steel, partRoot);
                FitRendererToMaxSize(stage2.GetComponent<Renderer>(), Parts[1].FitDiameterMeters);
                PlaceRendererBottomAt(stage2.GetComponent<Renderer>(), 0.18f);
                stage2.SetActive(false);
            }

            var robotRoot = CreateRobot(root.transform, materials, out var xAxis, out var yAxis, out var zAxis, out var probeMount, out var probeBeam);

            var scanPathObject = new GameObject("Bore Scan Path");
            scanPathObject.transform.SetParent(root.transform, false);
            scanPathObject.transform.localPosition = Vector3.zero;
            var scanPath = scanPathObject.AddComponent<ScanMasterScanPath>();
            SetPrivate(scanPath, "center", turntable.transform);
            scanPath.ScanRadiusMeters = 0.18f;
            scanPath.ScanLengthMeters = 0.16f;
            scanPath.Revolutions = 1.5f;
            scanPath.StartHeightMeters = 0.32f;
            scanPath.ProbeStandOffMeters = 0.04f;
            scanPath.ShowPathGizmo = false;
            CreatePlannedScanPath(root.transform, scanPath, materials);
            var scanTrail = CreateLiveScanTrail(root.transform, materials);
            var stage1Guide = CreateTrainingZoneGuide(root.transform, "Stage 1 Training Zone Guide", new[] { "E", "A", "B", "C", "D" }, 0.37f, 0.48f, materials.Beam);
            var stage2Guide = CreateTrainingZoneGuide(root.transform, "Stage 2 Training Zone Guide", new[] { "M", "N", "O", "P", "K", "L" }, 0.34f, 0.46f, materials.Beam);
            stage2Guide.SetActive(false);

            var controller = robotRoot.AddComponent<ScanMasterSimulationController>();
            SetPrivate(controller, "xAxis", xAxis);
            SetPrivate(controller, "yAxis", yAxis);
            SetPrivate(controller, "zAxis", zAxis);
            SetPrivate(controller, "probeMount", probeMount);
            SetPrivate(controller, "scanPath", scanPath);
            SetPrivate(controller, "probeBeam", probeBeam);
            SetPrivate(controller, "scanTrail", scanTrail);
            SetPrivate(controller, "playOnStart", false);
            SetPrivate(controller, "loop", false);
            SetPrivate(controller, "driveProbeMountWorldPose", true);
            SetPrivate(controller, "scanDurationSeconds", 42f);
            SetPrivate(controller, "guidedSeekSeconds", 2.8f);
            SetPrivate(controller, "scanTurntableRpm", 2.2f);
            SetPrivate(controller, "idleTurntableRpm", 0.42f);
            SetPrivate(controller, "turntable", turntable.GetComponent<ScanMasterTurntable>());
            CreateTrainingCueMarker(root.transform, controller, scanPath, materials);
            ApplyProbePreviewPose(robotRoot.transform, scanPath, xAxis, yAxis, zAxis, probeMount, probeBeam);
            foreach (var link in robotRoot.GetComponentsInChildren<ScanMasterLinkBeam>())
            {
                link.RefreshNow();
            }

            var selector = root.AddComponent<ScanMasterPartSelector>();
            SetPrivate(selector, "stage1Part", stage1);
            SetPrivate(selector, "stage2Part", stage2);
            SetPrivate(selector, "stage1Guide", stage1Guide);
            SetPrivate(selector, "stage2Guide", stage2Guide);
            SetPrivate(selector, "scanPath", scanPath);

            var trainingGuide = root.AddComponent<ScanMasterTrainingGuide>();
            SetPrivate(trainingGuide, "controller", controller);
            SetPrivate(trainingGuide, "partSelector", selector);
            SetPrivate(trainingGuide, "scanPath", scanPath);
            SetPrivate(trainingGuide, "autoDirectScene", true);
            SetPrivate(trainingGuide, "autoPlayTutorial", true);
            SetPrivate(trainingGuide, "loopTutorial", true);
            SetPrivate(trainingGuide, "setupStepSeconds", 6.5f);
            SetPrivate(trainingGuide, "scanStepSeconds", 12f);
            SetPrivate(trainingGuide, "wizardMenuImage", LoadTrainingTexture("step-03-scanmaster-wizard-menu.png"));
            SetPrivate(trainingGuide, "setupToolboxImage", LoadTrainingTexture("step-04-setup-toolbox-instrument.png"));
            SetPrivate(trainingGuide, "setupHighlightedImage", LoadTrainingTexture("step-08-setup-toolbox-highlighted.png"));
            SetPrivate(trainingGuide, "ascanCalibrationImage", LoadTrainingTexture("step-10-ascan-first-fbh-peak.png"));
            SetPrivate(trainingGuide, "tcgOneNodeImage", LoadTrainingTexture("step-10-tcg-list-one-node.png"));
            SetPrivate(trainingGuide, "ascanSecondPeakImage", LoadTrainingTexture("step-11-ascan-second-fbh-peak.png"));
            SetPrivate(trainingGuide, "tcgTwoNodesImage", LoadTrainingTexture("step-11-tcg-list-two-nodes.png"));
            SetPrivate(trainingGuide, "ascanThirdPeakImage", LoadTrainingTexture("step-12-ascan-third-fbh-peak.png"));
            SetPrivate(trainingGuide, "tcgThreeNodesImage", LoadTrainingTexture("step-12-tcg-list-three-nodes-scroll.png"));
            SetPrivate(trainingGuide, "ascanBackwallTcgImage", LoadTrainingTexture("step-13-ascan-backwall-tcg-points.png"));
            SetPrivate(trainingGuide, "saveSetupImage", LoadTrainingTexture("step-13-save-tcg-uprdb-navigator.png"));

            var cameraFocus = CreateCameraFocus(root.transform, turntable.transform, probeMount);
            var cameraOrbit = CreateCamera(root.transform, cameraFocus.transform);
            SetPrivate(trainingGuide, "cameraOrbit", cameraOrbit);
            SetPrivate(trainingGuide, "cameraFocus", cameraFocus);
            Selection.activeObject = root;

            EditorSceneManager.SaveScene(scene, ScenePath);
        }

        private static void CreateLighting()
        {
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.68f, 0.74f, 0.8f);
            RenderSettings.ambientEquatorColor = new Color(0.38f, 0.42f, 0.46f);
            RenderSettings.ambientGroundColor = new Color(0.16f, 0.17f, 0.18f);

            var sun = new GameObject("Key Light");
            var light = sun.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.25f;
            sun.transform.rotation = Quaternion.Euler(45f, -35f, 0f);
        }

        private static GameObject CreateTank(Transform parent, MaterialSet materials)
        {
            var tank = new GameObject("Immersion Tank");
            tank.transform.SetParent(parent, false);

            CreateCube("Tank Floor", tank.transform, new Vector3(3.2f, 0.08f, 2.2f), new Vector3(0f, -0.04f, 0f), materials.Dark);
            CreateCube("Tank Back Wall", tank.transform, new Vector3(3.2f, 1.1f, 0.06f), new Vector3(0f, 0.51f, 1.1f), materials.Glass);
            CreateCube("Tank Front Wall", tank.transform, new Vector3(3.2f, 1.1f, 0.06f), new Vector3(0f, 0.51f, -1.1f), materials.Glass);
            CreateCube("Tank Left Wall", tank.transform, new Vector3(0.06f, 1.1f, 2.2f), new Vector3(-1.6f, 0.51f, 0f), materials.Glass);
            CreateCube("Tank Right Wall", tank.transform, new Vector3(0.06f, 1.1f, 2.2f), new Vector3(1.6f, 0.51f, 0f), materials.Glass);

            var water = CreateCube("Water Surface", tank.transform, new Vector3(3.08f, 0.012f, 2.08f), new Vector3(0f, 0.73f, 0f), materials.Water);
            var waterCollider = water.GetComponent<Collider>();
            if (waterCollider != null)
            {
                UnityEngine.Object.DestroyImmediate(waterCollider);
            }

            var waterRenderer = water.GetComponent<Renderer>();
            if (waterRenderer != null)
            {
                waterRenderer.shadowCastingMode = ShadowCastingMode.Off;
                waterRenderer.receiveShadows = false;
            }

            water.AddComponent<ScanMasterTankWater>();
            return tank;
        }

        private static GameObject CreateTurntable(Transform parent, MaterialSet materials)
        {
            var root = new GameObject("Turntable");
            root.transform.SetParent(parent, false);
            root.transform.localPosition = new Vector3(0f, 0.08f, 0f);

            var cylinder = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            cylinder.name = "Low Profile Rotary Chuck";
            cylinder.transform.SetParent(root.transform, false);
            cylinder.transform.localScale = new Vector3(0.42f, 0.035f, 0.42f);
            cylinder.GetComponent<Renderer>().sharedMaterial = materials.Robot;

            CreateSupportPads(root.transform, materials);

            root.AddComponent<ScanMasterTurntable>();
            return root;
        }

        private static GameObject CreateRobot(
            Transform parent,
            MaterialSet materials,
            out ScanMasterRobotAxis xAxis,
            out ScanMasterRobotAxis yAxis,
            out ScanMasterRobotAxis zAxis,
            out Transform probeMount,
            out ScanMasterProbeBeam probeBeam)
        {
            var robotRoot = new GameObject("Scan Master Robot");
            robotRoot.transform.SetParent(parent, false);
            robotRoot.transform.localPosition = Vector3.zero;

            CreateCube("Left Column", robotRoot.transform, new Vector3(0.16f, 1.6f, 0.16f), new Vector3(-1.35f, 0.78f, 0.95f), materials.Robot);
            CreateCube("Right Column", robotRoot.transform, new Vector3(0.16f, 1.6f, 0.16f), new Vector3(1.35f, 0.78f, 0.95f), materials.Robot);
            CreateCube("Bridge Rail", robotRoot.transform, new Vector3(2.9f, 0.16f, 0.18f), new Vector3(0f, 1.5f, 0.95f), materials.Robot);
            CreateCube("X Linear Track", robotRoot.transform, new Vector3(2.65f, 0.06f, 0.08f), new Vector3(0f, 1.38f, 0.95f), materials.Yellow);

            var xCarriage = CreateCube("X Carriage", robotRoot.transform, new Vector3(0.28f, 0.22f, 0.24f), new Vector3(0f, 1.34f, 0.95f), materials.Robot);
            xAxis = xCarriage.AddComponent<ScanMasterRobotAxis>();
            xAxis.Configure(Vector3.right, -1.25f, 1.25f, 0.55f);

            var yCarriage = CreateCube("Y Cross Slide", xCarriage.transform, new Vector3(0.22f, 0.14f, 0.5f), new Vector3(0f, -0.05f, -0.28f), materials.Robot);
            yAxis = yCarriage.AddComponent<ScanMasterRobotAxis>();
            yAxis.Configure(Vector3.forward, -0.82f, 0.82f, 0.45f);

            var zCarriage = CreateCube("Z Ram", yCarriage.transform, new Vector3(0.12f, 0.78f, 0.12f), new Vector3(0f, -0.45f, 0f), materials.Yellow);
            zAxis = zCarriage.AddComponent<ScanMasterRobotAxis>();
            zAxis.Configure(Vector3.up, -0.78f, 0.05f, 0.35f);

            probeMount = new GameObject("Probe Mount").transform;
            probeMount.SetParent(zCarriage.transform, false);
            probeMount.localPosition = new Vector3(0f, -0.45f, 0f);

            var armLink = CreateCube("Articulated Probe Arm", robotRoot.transform, Vector3.one, Vector3.zero, materials.Steel);
            var armLinkCollider = armLink.GetComponent<Collider>();
            if (armLinkCollider != null)
            {
                UnityEngine.Object.DestroyImmediate(armLinkCollider);
            }

            armLink.AddComponent<ScanMasterLinkBeam>().Configure(yCarriage.transform, probeMount, 0.055f);

            var cableStart = new GameObject("Probe Cable Gantry Anchor").transform;
            cableStart.SetParent(yCarriage.transform, false);
            cableStart.localPosition = new Vector3(-0.11f, 0.08f, -0.18f);

            var cableEnd = new GameObject("Probe Cable Probe Anchor").transform;
            cableEnd.SetParent(probeMount, false);
            cableEnd.localPosition = new Vector3(-0.09f, 0.02f, -0.055f);

            var cableObject = new GameObject("Yellow Probe Cable");
            cableObject.transform.SetParent(robotRoot.transform, false);
            var cableLine = cableObject.AddComponent<LineRenderer>();
            cableLine.sharedMaterial = materials.Yellow;
            cableObject.AddComponent<ScanMasterCable>().Configure(cableStart, cableEnd, 0.14f, 0.22f, 0.012f);

            CreateCylinder("Upper Rotary Collar", probeMount, new Vector3(0.075f, 0.028f, 0.075f), new Vector3(0f, 0.12f, 0f), materials.Steel);
            CreateCylinder("Knurled Wrist Ring", probeMount, new Vector3(0.088f, 0.04f, 0.088f), new Vector3(0f, 0.068f, 0f), materials.Steel);
            CreateCylinder("Lower Rotary Collar", probeMount, new Vector3(0.07f, 0.024f, 0.07f), new Vector3(0f, 0.022f, 0f), materials.Steel);

            var probeHousing = CreateCube("Black Probe Housing", probeMount, new Vector3(0.16f, 0.13f, 0.14f), new Vector3(0f, -0.07f, 0f), materials.Robot);
            DestroyCollider(probeHousing);

            CreateProbeHousingScrews(probeHousing.transform, materials.Steel);

            var probeBody = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            probeBody.name = "IAE2P16679 Immersion Probe";
            probeBody.transform.SetParent(probeMount, false);
            probeBody.transform.localPosition = new Vector3(0f, -0.175f, 0f);
            probeBody.transform.localScale = new Vector3(0.032f, 0.07f, 0.032f);
            probeBody.GetComponent<Renderer>().sharedMaterial = materials.Steel;

            var mirror = CreateCube("IAE2P16678 45 Degree Mirror Shoe", probeMount, new Vector3(0.13f, 0.04f, 0.045f), new Vector3(0.045f, -0.235f, 0f), materials.Yellow);
            mirror.transform.localRotation = Quaternion.Euler(0f, 0f, -45f);
            DestroyCollider(mirror);

            var beamObject = new GameObject("Ultrasonic Beam");
            beamObject.transform.SetParent(probeMount, false);
            beamObject.transform.localPosition = new Vector3(0f, -0.265f, 0f);
            var lineRenderer = beamObject.AddComponent<LineRenderer>();
            lineRenderer.sharedMaterial = materials.Beam;
            probeBeam = beamObject.AddComponent<ScanMasterProbeBeam>();
            SetPrivate(probeBeam, "waterPathMeters", 0.105f);
            SetPrivate(probeBeam, "materialPathMeters", 0.19f);
            SetPrivate(probeBeam, "activeWidth", 0.014f);

            var soundEntry = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            soundEntry.name = "Sound Entry Spot";
            soundEntry.transform.SetParent(robotRoot.transform, false);
            soundEntry.GetComponent<Renderer>().sharedMaterial = materials.Beam;
            DestroyCollider(soundEntry);
            SetPrivate(probeBeam, "soundEntryMarker", soundEntry.transform);

            var footprintObject = new GameObject("Scanning Footprint Ring");
            footprintObject.transform.SetParent(robotRoot.transform, false);
            var footprintLine = footprintObject.AddComponent<LineRenderer>();
            footprintLine.sharedMaterial = materials.Beam;
            SetPrivate(probeBeam, "surfaceFootprint", footprintLine);

            return robotRoot;
        }

        private static void CreateProbeHousingScrews(Transform housing, Material material)
        {
            var positions = new[]
            {
                new Vector3(-0.065f, 0.04f, -0.073f),
                new Vector3(0.065f, 0.04f, -0.073f),
                new Vector3(-0.065f, -0.04f, -0.073f),
                new Vector3(0.065f, -0.04f, -0.073f)
            };

            for (var i = 0; i < positions.Length; i++)
            {
                var screw = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                screw.name = "Probe Housing Screw " + (i + 1);
                screw.transform.SetParent(housing, false);
                screw.transform.localPosition = positions[i];
                screw.transform.localScale = new Vector3(0.018f, 0.018f, 0.006f);
                screw.GetComponent<Renderer>().sharedMaterial = material;
                DestroyCollider(screw);
            }
        }

        private static void CreateSupportPads(Transform parent, MaterialSet materials)
        {
            const int padCount = 6;
            for (var i = 0; i < padCount; i++)
            {
                var angle = i / (float)padCount * Mathf.PI * 2f;
                var pad = CreateCube(
                    "Soft Support Pad " + (i + 1),
                    parent,
                    new Vector3(0.12f, 0.024f, 0.045f),
                    new Vector3(Mathf.Cos(angle) * 0.19f, 0.06f, Mathf.Sin(angle) * 0.19f),
                    materials.Dark);
                pad.transform.localRotation = Quaternion.Euler(0f, -angle * Mathf.Rad2Deg, 0f);
            }
        }

        private static GameObject CreateMeshObject(string name, Mesh mesh, Material material, Transform parent)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var filter = go.AddComponent<MeshFilter>();
            filter.sharedMesh = mesh;
            var renderer = go.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = material;
            return go;
        }

        private static GameObject CreateCube(string name, Transform parent, Vector3 scale, Vector3 position, Material material)
        {
            var cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cube.name = name;
            cube.transform.SetParent(parent, false);
            cube.transform.localPosition = position;
            cube.transform.localScale = scale;
            cube.GetComponent<Renderer>().sharedMaterial = material;
            return cube;
        }

        private static GameObject CreateCylinder(string name, Transform parent, Vector3 scale, Vector3 position, Material material)
        {
            var cylinder = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            cylinder.name = name;
            cylinder.transform.SetParent(parent, false);
            cylinder.transform.localPosition = position;
            cylinder.transform.localScale = scale;
            cylinder.GetComponent<Renderer>().sharedMaterial = material;
            return cylinder;
        }

        private static void DestroyCollider(GameObject gameObject)
        {
            var collider = gameObject.GetComponent<Collider>();
            if (collider != null)
            {
                UnityEngine.Object.DestroyImmediate(collider);
            }
        }

        private static void FitRendererToMaxSize(Renderer renderer, float maxSizeMeters)
        {
            if (renderer == null)
            {
                return;
            }

            var bounds = renderer.bounds;
            var max = Mathf.Max(bounds.size.x, Mathf.Max(bounds.size.y, bounds.size.z));
            if (max <= 0.0001f)
            {
                return;
            }

            var scale = maxSizeMeters / max;
            renderer.transform.localScale *= scale;
            renderer.transform.localRotation = Quaternion.Euler(-90f, 0f, 0f);
            renderer.transform.localPosition = Vector3.zero;

            var shiftedBounds = renderer.bounds;
            var targetCenter = renderer.transform.parent != null ? renderer.transform.parent.position : Vector3.zero;
            renderer.transform.position += targetCenter - shiftedBounds.center;
        }

        private static void PlaceRendererBottomAt(Renderer renderer, float worldY)
        {
            if (renderer == null)
            {
                return;
            }

            var deltaY = worldY - renderer.bounds.min.y;
            renderer.transform.position += Vector3.up * deltaY;
        }

        private static void CreatePlannedScanPath(Transform parent, ScanMasterScanPath scanPath, MaterialSet materials)
        {
            var preview = new GameObject("Planned Bore Scan Path");
            preview.transform.SetParent(parent, false);
            var line = preview.AddComponent<LineRenderer>();
            line.sharedMaterial = materials.Beam;
            line.useWorldSpace = true;
            line.loop = false;
            line.textureMode = LineTextureMode.Stretch;
            line.alignment = LineAlignment.View;
            line.positionCount = 128;
            line.startWidth = 0.006f;
            line.endWidth = 0.006f;
            line.startColor = new Color(0f, 0.78f, 1f, 0.42f);
            line.endColor = new Color(0f, 0.78f, 1f, 0.18f);

            for (var i = 0; i < line.positionCount; i++)
            {
                line.SetPosition(i, scanPath.Evaluate(i / (float)(line.positionCount - 1)).position);
            }

            preview.AddComponent<ScanMasterPathPreview>().Configure(scanPath);
        }

        private static ScanMasterScanTrail CreateLiveScanTrail(Transform parent, MaterialSet materials)
        {
            var trace = new GameObject("Live Scan Trace");
            trace.transform.SetParent(parent, false);
            var line = trace.AddComponent<LineRenderer>();
            line.sharedMaterial = materials.Beam;
            return trace.AddComponent<ScanMasterScanTrail>();
        }

        private static void CreateTrainingCueMarker(
            Transform parent,
            ScanMasterSimulationController controller,
            ScanMasterScanPath scanPath,
            MaterialSet materials)
        {
            var marker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            marker.name = "Synthetic Training Indication Marker";
            marker.transform.SetParent(parent, false);
            marker.GetComponent<Renderer>().sharedMaterial = materials.Yellow;
            DestroyCollider(marker);
            marker.AddComponent<ScanMasterScanCueMarker>().Configure(controller, scanPath);
        }

        private static GameObject CreateTrainingZoneGuide(Transform parent, string name, string[] labels, float radius, float height, Material material)
        {
            var guide = new GameObject(name);
            guide.transform.SetParent(parent, false);

            for (var i = 0; i < labels.Length; i++)
            {
                var normalized = labels.Length == 1 ? 0.5f : i / (float)(labels.Length - 1);
                var angle = Mathf.Lerp(145f, 35f, normalized) * Mathf.Deg2Rad;
                var localPosition = new Vector3(Mathf.Cos(angle) * radius, height + normalized * 0.035f, Mathf.Sin(angle) * radius);

                var marker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                marker.name = "Zone Marker " + labels[i];
                marker.transform.SetParent(guide.transform, false);
                marker.transform.localPosition = localPosition;
                marker.transform.localScale = new Vector3(0.035f, 0.035f, 0.035f);
                marker.GetComponent<Renderer>().sharedMaterial = material;
                var collider = marker.GetComponent<Collider>();
                if (collider != null)
                {
                    UnityEngine.Object.DestroyImmediate(collider);
                }

                var textObject = new GameObject("Zone Label " + labels[i]);
                textObject.transform.SetParent(guide.transform, false);
                textObject.transform.localPosition = localPosition + new Vector3(0f, 0.055f, 0f);
                textObject.transform.localRotation = Quaternion.Euler(60f, 0f, 0f);
                var text = textObject.AddComponent<TextMesh>();
                text.text = labels[i];
                text.characterSize = 0.07f;
                text.anchor = TextAnchor.MiddleCenter;
                text.alignment = TextAlignment.Center;
                var textRenderer = textObject.GetComponent<MeshRenderer>();
                if (textRenderer != null)
                {
                    textRenderer.sharedMaterial = material;
                }
            }

            return guide;
        }

        private static void ApplyProbePreviewPose(
            Transform robotRoot,
            ScanMasterScanPath scanPath,
            ScanMasterRobotAxis xAxis,
            ScanMasterRobotAxis yAxis,
            ScanMasterRobotAxis zAxis,
            Transform probeMount,
            ScanMasterProbeBeam probeBeam)
        {
            var pose = scanPath.Evaluate(0f);
            var local = robotRoot.InverseTransformPoint(pose.position);
            xAxis.SetTarget(local.x, true);
            yAxis.SetTarget(local.z, true);
            zAxis.SetTarget(local.y, true);
            probeMount.SetPositionAndRotation(pose.position, pose.rotation);
            probeBeam.SetScanActive(true);
        }

        private static void AddZoneRings(Transform parent, float diameter, Material material)
        {
            for (var i = 0; i < 3; i++)
            {
                var ring = new GameObject("Inspection Zone Ring " + (i + 1));
                ring.transform.SetParent(parent, false);
                var line = ring.AddComponent<LineRenderer>();
                line.sharedMaterial = material;
                line.useWorldSpace = false;
                line.loop = true;
                line.positionCount = 96;
                line.startWidth = 0.005f;
                line.endWidth = 0.005f;
                var radius = diameter * (0.41f - i * 0.06f);
                for (var p = 0; p < line.positionCount; p++)
                {
                    var angle = p / (float)line.positionCount * Mathf.PI * 2f;
                    line.SetPosition(p, new Vector3(Mathf.Cos(angle) * radius, 0f, Mathf.Sin(angle) * radius));
                }

                ring.name = "Inspection Zone Ring " + (i + 1);
            }
        }

        private static ScanMasterCameraOrbit CreateCamera(Transform parent, Transform target)
        {
            var cameraObject = new GameObject("Main Camera");
            cameraObject.tag = "MainCamera";
            cameraObject.transform.SetParent(parent, false);
            cameraObject.transform.position = new Vector3(2.55f, 1.65f, -2.65f);
            cameraObject.transform.rotation = Quaternion.Euler(28f, -41f, 0f);
            var camera = cameraObject.AddComponent<Camera>();
            camera.nearClipPlane = 0.02f;
            camera.farClipPlane = 100f;
            camera.fieldOfView = 42f;

            var orbit = cameraObject.AddComponent<ScanMasterCameraOrbit>();
            SetPrivate(orbit, "target", target);
            return orbit;
        }

        private static ScanMasterCameraFocus CreateCameraFocus(Transform parent, Transform partCenter, Transform probeMount)
        {
            var focusObject = new GameObject("Training Camera Focus");
            focusObject.transform.SetParent(parent, false);
            var focus = focusObject.AddComponent<ScanMasterCameraFocus>();
            focus.Configure(partCenter, probeMount);
            return focus;
        }

        private static Texture2D LoadTrainingTexture(string fileName)
        {
            var path = Root + "/TrainingImages/" + fileName;
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
            return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        }

        private static void SetPrivate<TTarget, TValue>(TTarget target, string fieldName, TValue value)
            where TTarget : class
        {
            var field = typeof(TTarget).GetField(fieldName, System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic);
            if (field == null)
            {
                throw new MissingFieldException(typeof(TTarget).Name, fieldName);
            }

            field.SetValue(target, value);
            UnityEngine.Object unityObject = target as UnityEngine.Object;
            if (unityObject != null)
            {
                EditorUtility.SetDirty(unityObject);
            }
        }

        private readonly struct PartImportSpec
        {
            public PartImportSpec(string sourceFile, string meshAssetFile, string prefabFile, string displayName, float fitDiameterMeters)
            {
                SourceFile = sourceFile;
                MeshAssetFile = meshAssetFile;
                PrefabFile = prefabFile;
                DisplayName = displayName;
                FitDiameterMeters = fitDiameterMeters;
            }

            public string SourceFile { get; }
            public string MeshAssetFile { get; }
            public string PrefabFile { get; }
            public string DisplayName { get; }
            public float FitDiameterMeters { get; }
        }

        private sealed class MaterialSet
        {
            public Material Steel;
            public Material Robot;
            public Material Yellow;
            public Material Water;
            public Material Glass;
            public Material Beam;
            public Material Dark;
        }
    }

    internal static class StlMeshImporter
    {
        public static Mesh LoadBinaryStl(string path, string meshName)
        {
            using var stream = File.OpenRead(path);
            using var reader = new BinaryReader(stream);

            if (stream.Length < 84)
            {
                throw new InvalidDataException("STL file is too small: " + path);
            }

            reader.ReadBytes(80);
            var triangleCount = reader.ReadUInt32();
            var vertexCount = checked((int)triangleCount * 3);
            var vertices = new Vector3[vertexCount];
            var normals = new Vector3[vertexCount];
            var indices = new int[vertexCount];

            for (uint i = 0; i < triangleCount; i++)
            {
                var normal = ReadVector(reader);
                var baseIndex = checked((int)i * 3);
                vertices[baseIndex] = ReadVector(reader);
                vertices[baseIndex + 1] = ReadVector(reader);
                vertices[baseIndex + 2] = ReadVector(reader);

                normals[baseIndex] = normal;
                normals[baseIndex + 1] = normal;
                normals[baseIndex + 2] = normal;
                indices[baseIndex] = baseIndex;
                indices[baseIndex + 1] = baseIndex + 1;
                indices[baseIndex + 2] = baseIndex + 2;
                reader.ReadUInt16();
            }

            var mesh = new Mesh
            {
                name = meshName,
                indexFormat = vertexCount > 65535 ? IndexFormat.UInt32 : IndexFormat.UInt16
            };
            mesh.vertices = vertices;
            mesh.triangles = indices;
            mesh.normals = normals;
            mesh.RecalculateBounds();

            if (HasWeakNormals(normals))
            {
                mesh.RecalculateNormals();
            }

            return mesh;
        }

        private static bool HasWeakNormals(IReadOnlyList<Vector3> normals)
        {
            for (var i = 0; i < normals.Count; i += 97)
            {
                if (normals[i].sqrMagnitude < 0.25f)
                {
                    return true;
                }
            }

            return false;
        }

        private static Vector3 ReadVector(BinaryReader reader)
        {
            return new Vector3(reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle());
        }
    }
}
