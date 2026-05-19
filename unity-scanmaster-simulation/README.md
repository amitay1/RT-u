# Scan Master Unity Simulation

Unity project scaffold for an immersion UT simulation of the Scan Master robot, tank, probe, turntable, and the two bundled P&W V2500 STL parts.

## Unity Version

This workspace was generated and validated with Unity `6000.4.7f1`, which is installed on this machine.

For a locked production baseline, Unity 6.3 LTS is still the conservative target. The project does not intentionally use Unity 6.4-only APIs, so you can recreate the generated scene from the menu in a Unity 6.3 LTS install if you want an LTS-only project.

## What Is Included

- Two P&W source STL files copied into `Assets/ScanMasterSimulation/Models/PW/Source`
- Generated Unity `Mesh` assets and prefabs for both binary STL files
- Editor STL importer that can rebuild the generated mesh assets
- Generated demo scene with immersion tank, gantry robot, turntable, probe, ultrasonic beam, materials, prefabs, and camera
- Runtime scripts for axis motion, scan path playback, part switching, probe beam visualization, water animation, and turntable rotation
- JSON config files for parts, scan plans, and robot/tank limits
- Training Mode overlay with guided inspection steps, procedure data, synthetic C-scan strip, zone markers, and live scan trace

## Open And Build

1. Open Unity Hub.
2. Add this folder as a project:
   `unity-scanmaster-simulation`
3. Open it with Unity `6000.4.7f1` or Unity 6.3 LTS.
4. The demo scene is already generated. If you need to rebuild it, run:
   `Scan Master > Build Simulation Scene`
5. Open the scene:
   `Assets/ScanMasterSimulation/Scenes/ScanMasterImmersionDemo.unity`
6. Press Play.

## Demo Controls

- `Space`: play or pause the scan
- `R`: reset scan progress
- `1`: show the 0765 model, provisional Stage 1 mapping
- `2`: show the 0784 model, provisional Stage 2 mapping
- `Left/Right` or `B/N`: move through Training Mode steps
- `H`: hide or show the Training Mode overlay
- `Tab`: hide or show the procedure data panel
- Right mouse drag: orbit camera
- Mouse wheel: zoom camera

## Important Assumptions

The repository contains two STL files named `Engine V2500-A5-0765-Model.stl` and `Engine V2500-A5-0784-Model.stl`. There is no explicit metadata inside the binary STL headers that maps them to `2A5001` or `2A4802`.

The config currently uses this working mapping:

- `0765` -> `2A5001` / `NDIP-1226` / Stage 1
- `0784` -> `2A4802` / `NDIP-1227` / Stage 2

If your source data says the reverse, update `Assets/ScanMasterSimulation/Config/scanmaster_parts.json` and adjust labels in `ScanMasterSceneBuilder.cs`.

## Safety Boundary

This is a visualization and training scaffold. It is not a certified inspection procedure, robot controller, or acceptance/rejection authority. Production inspection still requires the approved NDIP revision, qualified personnel, verified calibration, and local quality sign-off.
