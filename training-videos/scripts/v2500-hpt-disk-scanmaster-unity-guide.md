# V2500 HPT Disk Immersion UT - Unity Training Simulation Script

TITLE:        V2500 HPT Disk Immersion UT Scan Workflow
ID:           V2500-UNITY-01
SERIES:       ScanMaster Simulation
DURATION:     8-10 minutes
PREREQUISITE: Basic immersion UT, DAC/TCG, C-scan review
TABS LINKED: Unity simulation, Scan Plan, Calibration, Equipment, Report
LAST UPDATED: 2026-05-19

## Source Anchors

- `public/standards/MRO/NDIP 1226 Procedure for Immersion UT of V2500 1st HPT Disk - Rev F.pdf`
- `public/standards/MRO/NDIP 1227 Procedure for Immersion UT of V2500 2nd HPT Disk - Rev D.pdf`
- `public/standards/MRO/2A5001 Gating Scheme.xlsx`
- `public/standards/MRO/2A4802 Gating Scheme.xlsx`
- `unity-scanmaster-simulation/Assets/ScanMasterSimulation/Config/scanmaster_scan_plans.json`

This script is a training storyboard. It must not be used as inspection authority. Production inspection requires the current approved NDIP, qualified personnel, valid calibration and quality sign-off.

## 1. COLD OPEN (0:00 - 0:10)

| Time | Voiceover | Visual |
|------|-----------|--------|
| 0:00 | A complex HPT disk does not fail because the scan looked difficult. It fails because one required surface was missed. | Dark tank. Disk silhouette. One orange synthetic indication appears in the C-scan strip. |
| 0:06 | This training shows how to build the scan plan so no required bore surface is skipped. | Title card over rotating V2500 HPT disk. |

## 2. TITLE CARD + OUTCOME (0:10 - 0:35)

| Time | Voiceover | Visual |
|------|-----------|--------|
| 0:10 | Welcome to ScanMaster Training. In this lesson we will set up the V2500 HPT disk bore inspection in immersion, align the probe and mirror, and run the simulated scan. | Unity scene opens. Training Mode panel appears. |
| 0:22 | By the end, the operator should understand the workflow, the scan surfaces, the motion limits, and the checks that protect the data. | Highlight the robot, tank, disk, probe, live trace and procedure panel. |

## 3. SAFETY AND AUTHORITY (0:35 - 1:00)

| Time | Voiceover | Visual |
|------|-----------|--------|
| 0:35 | The simulation teaches the workflow. It does not replace the approved NDIP or the judgment of qualified Level II and Level III personnel. | Overlay: "Training aid only - verify against approved procedure." |
| 0:48 | Any mismatch between the training model and the approved procedure stops the job until it is resolved. | Pause scan. Red outline around procedure data panel. |

## 4. PART IDENTIFICATION (1:00 - 1:40)

| Time | Voiceover | Visual |
|------|-----------|--------|
| 1:00 | Start by proving the part identity. Stage 1 uses part number 2A5001. Stage 2 uses part number 2A4802. | Press `1`, then `2`. Show part labels and stage-specific zone guide. |
| 1:18 | Record serial number, heat code, engine data, time and cycles. Mark the zero-degree start position before scanning. | Camera moves to disk rim. Add zero-degree marker callout. |

## 5. EQUIPMENT SETUP (1:40 - 2:30)

| Time | Voiceover | Visual |
|------|-----------|--------|
| 1:40 | Use the approved immersion system, angle calibration block, 5 MHz 8 inch focus transducer and 45-degree mirror. | Highlight transducer `IAE2P16679` and mirror `IAE2P16678`. |
| 2:00 | Seat the mirror, mount the disk on the chuck riser, and avoid metal-to-metal contact. | Close-up of low profile chuck and support pads. |
| 2:16 | Remove air bubbles from the probe face, the entry surfaces and under-web areas before calibration or scan. | Animated bubbles disappear from water surface and disk underside. |

## 6. CALIBRATION (2:30 - 3:35)

| Time | Voiceover | Visual |
|------|-----------|--------|
| 2:30 | Normalize on the calibration block, set the 8 inch water path and optimize incidence for a 45-degree shear wave. | Probe moves over a calibration block placeholder. |
| 2:52 | Build the DAC so the reference FBH response is at 80 percent full screen height. | A-scan graphic rises to 80% FSH line. |
| 3:12 | Apply the required gain offsets, including curvature and calibration-block corrections from approved data. | Procedure panel shows "DAC, curvature, post-cal required." |

## 7. BORE OFFSET AND SURFACE PLAN (3:35 - 4:45)

| Time | Voiceover | Visual |
|------|-----------|--------|
| 3:35 | Move from calibration to the bore. Normalize on the inspection surface before starting the scan. | Probe snaps to the bore scan path. |
| 3:52 | For Stage 1, the bore offset is 0.943 inch at a nominal radius of 2.910 inch. | Select Stage 1. Procedure panel shows offset. |
| 4:08 | For Stage 2, the bore offset is 0.898 inch at a nominal radius of 2.773 inch. | Select Stage 2. Procedure panel updates. |
| 4:24 | The scan plan must cover the required zone labels. Stage 1 uses E, A, B, C, D. Stage 2 uses M, N, O, P, K, L. | Zone markers appear around the disk. |

## 8. RUNNING THE SCAN (4:45 - 6:10)

| Time | Voiceover | Visual |
|------|-----------|--------|
| 4:45 | Press Play. The robot positions the probe, the turntable rotates, and the live trace shows coverage. | Unity enters Play Mode. Probe, beam and live trace move. |
| 5:05 | Every required surface must be scanned in both circumferential shear directions: positive 45 and negative 45. | Procedure panel flips mode after loop. |
| 5:28 | The scan increment and index increment must not exceed 0.020 inch. The video should make gaps visible, because gaps are how coverage is lost. | C-scan strip shows dense coverage, then a "gap" mistake overlay. |
| 5:52 | Minimum radial volumetric coverage is 2.6 inches. The scan is not complete just because the turntable made one revolution. | Highlight radial coverage arrow and zone guide. |

## 9. C-SCAN REVIEW (6:10 - 7:15)

| Time | Voiceover | Visual |
|------|-----------|--------|
| 6:10 | Review the C-scan and TOF data by surface, not as one generic picture. | C-scan strip segments by zone. |
| 6:28 | Edge signals, interface movement, roughness and coupling loss must be separated from true indications. | Overlay compares edge signal, interface signal and synthetic flaw marker. |
| 6:52 | A questionable area is re-scanned. The operator does not explain away bad data. | Pause, rewind a zone, and run the scan again. |

## 10. POST CALIBRATION AND REPORT (7:15 - 8:30)

| Time | Voiceover | Visual |
|------|-----------|--------|
| 7:15 | Return to the calibration block and document the post-calibration response. | Probe moves back to calibration block placeholder. |
| 7:36 | Save the data file and record the inspection system, transducer, calibration block, disk identity, surface, index, depth, circumferential location and amplitude or TOF result. | Report checklist fills in. |
| 8:05 | The final product is not just a scan animation. It is a traceable inspection record. | Show Unity simulation next to Scan Master report screen placeholder. |

## 11. COMMON MISTAKES (8:30 - 9:25)

| Time | Voiceover | Visual |
|------|-----------|--------|
| 8:30 | Mistake one: starting the bore scan before bubbles are removed. | False noisy C-scan appears. |
| 8:52 | Mistake two: using a pretty path that does not follow the approved surfaces and increments. | Trace with a missed zone turns red. |
| 9:12 | Mistake three: treating edge or interface signals as a simple accept/reject call without procedure review. | Warning box over C-scan review. |

## 12. RECAP (9:25 - 10:00)

| Time | Voiceover | Visual |
|------|-----------|--------|
| 9:25 | Identify the disk, build the approved setup, calibrate to the reference response, scan every required zone in both directions, verify the C-scan, post-calibrate and report. | Six-step recap over the completed scene. |
| 9:48 | That is the difference between a model demonstration and a training tool an inspector can follow. | Final orbit shot of disk, probe beam and live trace. |
