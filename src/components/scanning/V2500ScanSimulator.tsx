/**
 * V2500ScanSimulator — interactive 3D simulator of a Pratt & Whitney V2500
 * Stage 1 HPT disk immersion ultrasonic scan.
 *
 * Mirrors the visuals of the MP4 tutorial (scene_3d/render_3d_scene.html) but
 * implemented with @react-three/fiber so it lives inside Scan-Master.
 *
 * Source of truth for geometry: src/rules/pw/pwScanPlans.ts (NDIP-1226 Rev F).
 *
 * Features:
 *   - Stylized V2500 disk (LatheGeometry from a profile derived from the rule)
 *   - Immersion tank, water surface, turntable, probe + 45° mirror
 *   - 5 scan zone markers (E / A / B / C / D)
 *   - Controls: Zone select, ±45° angle toggle, play/pause/scrub,
 *               camera presets (overhead / cross / closeup / wide), reset
 *   - Live status: zone, angle, scan progress, faux C-scan strip building up
 */
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Html, Environment } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, Plus, Minus } from "lucide-react";
import {
  getV2500PassCount,
  PW_V2500_SIGNAL_RULES,
  PW_V2500_STAGE1_SCAN_PLAN,
} from "@/rules/pw/pwScanPlans";
import { PW_HPT_TRANSDUCER_SETUP } from "@/rules/pw/pwTransducers";

// ─────────────────────────── Constants (NDIP-1226 Rev F) ───────────────────────────
const BORE_RADIUS = PW_V2500_STAGE1_SCAN_PLAN.boreRadius; // inches
const WATER_PATH = PW_V2500_STAGE1_SCAN_PLAN.waterPath; // inches
const MAX_SCAN_INC = PW_V2500_STAGE1_SCAN_PLAN.maxScanIncrement; // inches per rev
const MAX_INDEX_INC = PW_V2500_STAGE1_SCAN_PLAN.maxIndexIncrement; // inches per rev
const INCIDENT_ANGLE = PW_HPT_TRANSDUCER_SETUP.incidentAngle;
const REFRACTED_ANGLE = PW_HPT_TRANSDUCER_SETUP.refractedAngle;
const PASS_COUNT = getV2500PassCount(PW_V2500_STAGE1_SCAN_PLAN);
const ZONES = ["E", "A", "B", "C", "D"] as const;
type ZoneId = (typeof ZONES)[number];

const ZONE_COLORS: Record<ZoneId, string> = {
  E: "#ff4d6d",
  A: "#ffcc00",
  B: "#00ff88",
  C: "#00e5ff",
  D: "#ff00ff",
};

const ZONE_INFO: Record<ZoneId, { name: string; band: [number, number] }> = {
  // band = [yMin, yMax] in disk-local space (inches)
  E: { name: "Upper Web Transition", band: [+0.7, +1.3] },
  A: { name: "Upper Chamfer", band: [+0.4, +0.7] },
  B: { name: "Upper Land", band: [+0.05, +0.4] },
  C: { name: "Bore Entry Chamfer", band: [-0.4, +0.05] },
  D: { name: "Bore ID", band: [-1.1, -0.4] },
};

type CamPreset = "wide" | "closeup" | "overhead" | "cross";

const CAM_PRESETS: Record<CamPreset, { pos: [number, number, number]; look: [number, number, number]; fov: number }> = {
  wide: { pos: [14, 6, 14], look: [0, 0, 0], fov: 35 },
  closeup: { pos: [7, 2.5, 7], look: [0, 0, 0], fov: 30 },
  overhead: { pos: [0.001, 16, 0.001], look: [0, 0, 0], fov: 35 },
  cross: { pos: [0.001, 0.5, 16], look: [0, 0, 0], fov: 28 },
};

// ─────────────────────────── Disk profile ───────────────────────────
// Approximates the V2500 HPT cross-section: bore at center, hub, web, rim.
// Each [r, y] point in inches. Revolved around Y to form the disk.
const DISK_PROFILE: [number, number][] = [
  [BORE_RADIUS, -1.10],
  [BORE_RADIUS, -0.40],
  [BORE_RADIUS + 0.20, -0.30],
  [BORE_RADIUS + 0.60, +0.00],
  [BORE_RADIUS + 0.80, +0.20],
  [BORE_RADIUS + 1.30, +0.45],
  [BORE_RADIUS + 1.80, +0.70],
  [BORE_RADIUS + 2.40, +0.95],
  [BORE_RADIUS + 3.20, +1.10],
  [BORE_RADIUS + 4.20, +1.05],
  [BORE_RADIUS + 5.20, +0.95],
  [BORE_RADIUS + 6.40, +0.80],
  [BORE_RADIUS + 6.60, +0.50],
  [BORE_RADIUS + 6.50, +0.00],
  [BORE_RADIUS + 6.45, -0.50],
  [BORE_RADIUS + 6.55, -1.00],
  [BORE_RADIUS + 6.30, -1.15],
  [BORE_RADIUS + 1.50, -1.20],
  [BORE_RADIUS + 0.40, -1.18],
  [BORE_RADIUS, -1.10],
];

// ─────────────────────────── Helpers ───────────────────────────
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function zoneY(zone: ZoneId) {
  const [a, b] = ZONE_INFO[zone].band;
  return (a + b) / 2;
}

// ─────────────────────────── 3D sub-components ───────────────────────────
// URL of the real V2500 1st Stage HPT Disk STL (part 2A5001 per NDIP-1226).
// File is served from public/standards/MRO/ at Scan-Master runtime.
const V2500_STAGE1_STL_URL = "/standards/MRO/Engine V2500-A5-0765-Model.stl";

/**
 * Loads the actual V2500 STL geometry, re-centers it, scales it from STL
 * units (millimetres) into the local scene unit (inches), and orients it so
 * the bore axis is along +Y (matching the LatheGeometry profile).
 *
 * On failure (e.g. STL file missing or 404) falls back to the procedural
 * LatheGeometry profile so the simulator stays usable.
 */
function DiskFromSTL() {
  // useLoader memoises the geometry per URL
  const geom = useLoader(STLLoader, V2500_STAGE1_STL_URL) as THREE.BufferGeometry;
  const prepared = useMemo(() => {
    const g = geom.clone();
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const center = new THREE.Vector3();
    bb.getCenter(center);
    g.translate(-center.x, -center.y, -center.z);
    // STL exported in mm. 1 inch = 25.4 mm.
    const scale = 1 / 25.4;
    g.scale(scale, scale, scale);
    // Re-orient: the STL appears to have its axis along Z. Rotate so axis = Y.
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [geom]);
  return (
    <mesh geometry={prepared} castShadow receiveShadow>
      <meshStandardMaterial
        color="#9aa8c0"
        metalness={0.85}
        roughness={0.3}
        envMapIntensity={1.2}
      />
    </mesh>
  );
}

/** Procedural-profile fallback when the STL can't load. */
function DiskFallback() {
  const points = useMemo(
    () => DISK_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
    []
  );
  const geom = useMemo(() => new THREE.LatheGeometry(points, 96), [points]);
  return (
    <mesh geometry={geom} castShadow receiveShadow>
      <meshStandardMaterial
        color="#9aa8c0"
        metalness={0.85}
        roughness={0.3}
        envMapIntensity={1.2}
      />
    </mesh>
  );
}

/**
 * Tiny error boundary that swaps the real STL disk for the procedural
 * fallback if anything explodes (404, parse error, GPU OOM, …).
 */
class DiskErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[V2500ScanSimulator] STL load failed, using fallback:", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Suspense-boundary'd disk: real STL with procedural fallback. */
function Disk() {
  return (
    <DiskErrorBoundary fallback={<DiskFallback />}>
      <Suspense fallback={<DiskFallback />}>
        <DiskFromSTL />
      </Suspense>
    </DiskErrorBoundary>
  );
}

function Tank() {
  return (
    <group>
      {/* Tank base */}
      <mesh position={[0, -2.0, 0]} receiveShadow>
        <cylinderGeometry args={[12, 12, 0.2, 64]} />
        <meshStandardMaterial color="#222a3a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Tank walls (low-opacity glass) */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[12, 12, 7, 64, 1, true]} />
        <meshPhysicalMaterial
          color="#88aaff"
          transmission={0.8}
          roughness={0.05}
          thickness={0.1}
          opacity={0.25}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Water surface */}
      <mesh position={[0, 3.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[11.6, 64]} />
        <meshPhysicalMaterial
          color="#0066aa"
          transmission={0.7}
          roughness={0.15}
          thickness={0.05}
          opacity={0.55}
          transparent
        />
      </mesh>
    </group>
  );
}

function Turntable() {
  return (
    <mesh position={[0, -1.7, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[10, 10, 0.4, 64]} />
      <meshStandardMaterial color="#1a2230" metalness={0.7} roughness={0.5} />
    </mesh>
  );
}

interface ProbeProps {
  zone: ZoneId;
  angle: number; // signed degrees: +45 or -45
  diskRotation: number; // radians
}

function Probe({ zone, angle, diskRotation }: ProbeProps) {
  // Probe sits above the water at fixed water-path; mirror reflects beam toward zone.
  const y = zoneY(zone) + WATER_PATH * 0.35; // visual scaling
  const r = BORE_RADIUS + 0.5 + ZONES.indexOf(zone) * 0.2;
  // Position circumferentially based on disk rotation (or fixed, with disk rotating
  // beneath). We put the probe at angle 0 in world and let the disk spin.
  const x = r;
  const z = 0;
  // Mirror angle (signed)
  const mirRotZ = (angle * Math.PI) / 180 / 2;
  return (
    <group position={[x, y, z]}>
      {/* Probe body — cylinder pointing down */}
      <mesh castShadow>
        <cylinderGeometry args={[0.18, 0.18, 1.4, 24]} />
        <meshStandardMaterial color="#e8eaf0" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Probe top connector */}
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.22, 0.18, 0.3, 24]} />
        <meshStandardMaterial color="#444a58" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Mirror — small disc tilted at half the refracted angle */}
      <mesh position={[0, -0.8, 0]} rotation={[0, 0, mirRotZ]}>
        <cylinderGeometry args={[0.25, 0.25, 0.05, 24]} />
        <meshStandardMaterial
          color="#ffd24d"
          metalness={0.95}
          roughness={0.05}
          emissive="#332200"
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* Beam line */}
      <mesh
        position={[-Math.sin(mirRotZ * 2) * 1.2, -0.8 - Math.cos(mirRotZ * 2) * 1.2, 0]}
        rotation={[0, 0, mirRotZ * 2 + Math.PI / 2]}
      >
        <cylinderGeometry args={[0.015, 0.015, 2.4, 8]} />
        <meshBasicMaterial
          color={angle > 0 ? "#00e5ff" : "#ff00ff"}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Light wash for the probe */}
      <pointLight color="#ffd24d" intensity={1.2} distance={3} decay={2} />
      {/* HTML callout */}
      <Html position={[0, 1.4, 0]} center>
        <div
          style={{
            background: "rgba(7,9,15,0.85)",
            color: "#00e5ff",
            border: "1px solid #00e5ff",
            padding: "2px 8px",
            borderRadius: 4,
            fontFamily: "Segoe UI, Arial, sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
            whiteSpace: "nowrap",
            transform: `translateY(-2px)`,
            pointerEvents: "none",
          }}
        >
          PROBE · {angle > 0 ? "+45°" : "−45°"} · ZONE {zone}
        </div>
      </Html>
      {/* used to silence unused-var if rotation isn't applied here */}
      <group rotation={[0, diskRotation * 0, 0]} />
    </group>
  );
}

function ZoneRings({ active }: { active: ZoneId }) {
  return (
    <>
      {ZONES.map((z) => {
        const [yMin, yMax] = ZONE_INFO[z].band;
        const y = (yMin + yMax) / 2;
        const isActive = z === active;
        const r = BORE_RADIUS + 0.1 + ZONES.indexOf(z) * 0.05;
        return (
          <mesh
            key={z}
            position={[0, y, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[r - 0.04, r + 0.04, 96]} />
            <meshBasicMaterial
              color={ZONE_COLORS[z]}
              transparent
              opacity={isActive ? 0.95 : 0.35}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </>
  );
}

interface SceneProps {
  zone: ZoneId;
  angle: number;
  scanT: number; // 0..1 progress
  camPreset: CamPreset;
}

function Scene({ zone, angle, scanT, camPreset }: SceneProps) {
  const diskRef = useRef<THREE.Group>(null!);
  const cameraTargetRef = useRef(new THREE.Vector3());

  // Animate disk rotation based on scanT (one full revolution per zone pass)
  useFrame((state) => {
    if (diskRef.current) {
      diskRef.current.rotation.y = scanT * Math.PI * 2;
    }
    // Smoothly move camera to the active preset
    const preset = CAM_PRESETS[camPreset];
    const cam = state.camera;
    const targetPos = new THREE.Vector3(...preset.pos);
    cam.position.lerp(targetPos, 0.05);
    cameraTargetRef.current.lerp(new THREE.Vector3(...preset.look), 0.05);
    cam.lookAt(cameraTargetRef.current);
    if ("fov" in cam) {
      (cam as THREE.PerspectiveCamera).fov = lerp(
        (cam as THREE.PerspectiveCamera).fov,
        preset.fov,
        0.05
      );
      (cam as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  });

  return (
    <>
      {/* Lighting */}
      <hemisphereLight args={["#cce6ff", "#1a2230", 0.9]} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={2.0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-6, 4, -8]} intensity={0.8} color="#00e5ff" />
      <Environment preset="warehouse" />

      <Tank />
      <Turntable />
      <group ref={diskRef}>
        <Disk />
        <ZoneRings active={zone} />
      </group>
      <Probe zone={zone} angle={angle} diskRotation={scanT * Math.PI * 2} />

      {/* Floor grid */}
      <gridHelper args={[40, 40, "#1a2230", "#10141e"]} position={[0, -1.95, 0]} />
    </>
  );
}

// ─────────────────────────── Faux C-Scan strip ───────────────────────────
function CScanStrip({ zone, scanT, angle }: { zone: ZoneId; scanT: number; angle: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    // Background
    ctx.fillStyle = "#070a12";
    ctx.fillRect(0, 0, w, h);
    // Build a faux C-scan up to scanT (0..1)
    const cols = Math.floor(w * scanT);
    const baseColor = ZONE_COLORS[zone];
    const seed = ZONES.indexOf(zone) * 17 + (angle > 0 ? 1 : 2);
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < h; y++) {
        // pseudo-random noise function — varies per zone + angle
        const n =
          Math.sin((x * 13 + y * 7 + seed) * 0.13) *
            Math.cos((x * 7 + y * 11) * 0.21) *
            0.5 +
          0.5;
        const baseFsh = 0.05 + 0.12 * n; // mostly low background
        const fsh = baseFsh;
        const t = Math.min(1, fsh * 5);
        const r = parseInt(baseColor.slice(1, 3), 16);
        const g = parseInt(baseColor.slice(3, 5), 16);
        const b = parseInt(baseColor.slice(5, 7), 16);
        ctx.fillStyle = `rgb(${Math.floor(r * t)},${Math.floor(g * t)},${Math.floor(b * t)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Header label
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, w, 18);
    ctx.fillStyle = "#00e5ff";
    ctx.font = "bold 11px Segoe UI, Arial";
    ctx.fillText(`C-SCAN · ZONE ${zone} · ${angle > 0 ? "+45°" : "−45°"}`, 6, 13);
    const currentX = Math.min(w - 1, Math.max(0, cols));
    ctx.strokeStyle = "#f8e71c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(currentX, 18);
    ctx.lineTo(currentX, h);
    ctx.stroke();

    ctx.fillStyle = "#ff4d6d";
    ctx.font = "bold 10px Segoe UI, Arial";
    ctx.fillText(`flag >=${PW_V2500_SIGNAL_RULES.recordableIndicationFsh}% FSH`, w - 92, 13);
  }, [zone, scanT, angle]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={56}
      style={{
        width: "100%",
        height: 56,
        borderRadius: 6,
        border: "1px solid #1f2a3d",
      }}
    />
  );
}

// ─────────────────────────── Main exported component ───────────────────────────
function FshScale() {
  const calibration = PW_V2500_SIGNAL_RULES.calibrationTargetFsh;
  const threshold = PW_V2500_SIGNAL_RULES.recordableIndicationFsh;
  const noise = PW_V2500_SIGNAL_RULES.averageNoiseLimitFsh;

  return (
    <div className="rounded-md border border-slate-700 bg-slate-950/70 p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase text-slate-300">
        <span>FSH signal scale</span>
        <span className="font-mono text-cyan-300">{calibration}% ref</span>
      </div>
      <div className="relative h-28 rounded bg-slate-900">
        <div className="absolute left-0 right-0 top-0 border-t border-slate-500" />
        <div
          className="absolute left-0 right-0 border-t border-yellow-300"
          style={{ top: `${100 - calibration}%` }}
        />
        <div
          className="absolute left-0 right-0 border-t border-rose-400"
          style={{ top: `${100 - threshold}%` }}
        />
        <div
          className="absolute left-0 right-0 border-t border-cyan-500/70"
          style={{ top: `${100 - noise}%` }}
        />
        <div
          className="absolute bottom-0 left-8 w-10 rounded-t bg-cyan-400/70"
          style={{ height: `${threshold}%` }}
        />
        <div
          className="absolute bottom-0 left-24 w-10 rounded-t bg-yellow-300/80"
          style={{ height: `${calibration}%` }}
        />
        <div className="absolute right-2 top-1 text-[10px] text-slate-400">100%</div>
        <div className="absolute right-2 text-[10px] text-yellow-200" style={{ top: `${100 - calibration - 4}%` }}>
          {calibration}% cal
        </div>
        <div className="absolute right-2 text-[10px] text-rose-300" style={{ top: `${100 - threshold - 4}%` }}>
          {threshold}% flag
        </div>
        <div className="absolute right-2 bottom-1 text-[10px] text-cyan-300">noise band</div>
      </div>
    </div>
  );
}

export function V2500ScanSimulator() {
  const [zone, setZone] = useState<ZoneId>("E");
  const [angle, setAngle] = useState<1 | -1>(1); // sign: +45 / -45
  const [camPreset, setCamPreset] = useState<CamPreset>("wide");
  const [playing, setPlaying] = useState(true);
  const [scanT, setScanT] = useState(0);

  // Driving the scan progress at ~14s per pass when playing
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const PASS_DURATION_MS = 14000;
    const tick = (now: number) => {
      const dt = (now - last) / PASS_DURATION_MS;
      last = now;
      setScanT((t) => (t + dt) % 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const cyclePass = (forward: boolean) => {
    // Cycle through: each zone × 2 angles in order
    const order: [ZoneId, 1 | -1][] = [];
    for (const z of ZONES) {
      order.push([z, 1]);
      order.push([z, -1]);
    }
    const idx = order.findIndex(([z, a]) => z === zone && a === angle);
    const next = forward
      ? order[(idx + 1) % order.length]
      : order[(idx - 1 + order.length) % order.length];
    setZone(next[0]);
    setAngle(next[1]);
    setScanT(0);
  };

  const reset = () => {
    setZone("E");
    setAngle(1);
    setCamPreset("wide");
    setPlaying(true);
    setScanT(0);
  };

  return (
    <Card className="overflow-hidden border-cyan-400/40 bg-gradient-to-br from-slate-950 to-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-900/40">
        <div>
          <h3 className="font-bold text-lg text-cyan-300">
            V2500 HPT Disk - Interactive Scan Simulator
          </h3>
          <p className="text-xs text-slate-400">
            5 zones | +/-45 shear wave | NDIP-1226 Rev F | {PASS_COUNT} passes per disk
          </p>
        </div>
        <div className="text-xs text-cyan-300 font-mono">
          BORE DIA {(BORE_RADIUS * 2).toFixed(2)} in | WP {WATER_PATH.toFixed(1)} in |
          INC {MAX_SCAN_INC.toFixed(3)} in
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0">
        {/* 3D Canvas */}
        <div className="relative h-[460px] bg-slate-950">
          <Canvas
            shadows
            camera={{ position: CAM_PRESETS.wide.pos, fov: CAM_PRESETS.wide.fov }}
          >
            <Scene zone={zone} angle={angle * 45} scanT={scanT} camPreset={camPreset} />
            <OrbitControls
              enablePan={false}
              enableZoom
              minDistance={6}
              maxDistance={28}
              target={[0, 0, 0]}
            />
          </Canvas>
          {/* Live HUD overlay */}
          <div className="absolute top-3 left-3 px-3 py-2 bg-slate-950/80 border border-cyan-900/40 rounded text-xs font-mono">
            <div className="text-cyan-300 font-bold">
              ● LIVE — ZONE {zone} · {angle > 0 ? "+45°" : "−45°"}
            </div>
            <div className="text-slate-400">
              {ZONE_INFO[zone].name}
            </div>
            <div className="text-slate-500">
              progress {(scanT * 100).toFixed(1)}% · θ {(scanT * 360).toFixed(0)}°
            </div>
          </div>
        </div>

        {/* Right control panel */}
        <div className="p-4 bg-slate-900/50 border-l border-cyan-900/30 flex flex-col gap-3">
          {/* Zone selector */}
          <div>
            <div className="text-xs font-bold text-slate-300 mb-2">ZONE</div>
            <div className="grid grid-cols-5 gap-1.5">
              {ZONES.map((z) => (
                <button
                  key={z}
                  onClick={() => { setZone(z); setScanT(0); }}
                  className={`h-9 rounded text-sm font-bold transition-colors ${
                    z === zone
                      ? "ring-2 ring-cyan-300"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  style={{
                    background: ZONE_COLORS[z],
                    color: "#0a0e16",
                  }}
                  aria-label={`Select zone ${z}: ${ZONE_INFO[z].name}`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>

          {/* Angle */}
          <div>
            <div className="text-xs font-bold text-slate-300 mb-2">ANGLE</div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={angle === 1 ? "default" : "outline"}
                size="sm"
                onClick={() => { setAngle(1); setScanT(0); }}
                className="bg-cyan-700 hover:bg-cyan-600 data-[variant=outline]:bg-transparent"
              >
                <Plus className="h-3 w-3 mr-1" />45°
              </Button>
              <Button
                variant={angle === -1 ? "default" : "outline"}
                size="sm"
                onClick={() => { setAngle(-1); setScanT(0); }}
              >
                <Minus className="h-3 w-3 mr-1" />45°
              </Button>
            </div>
          </div>

          {/* Camera presets */}
          <div>
            <div className="text-xs font-bold text-slate-300 mb-2">CAMERA</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(["wide", "closeup", "overhead", "cross"] as CamPreset[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setCamPreset(p)}
                  className={`h-8 rounded text-xs font-semibold uppercase transition-colors ${
                    camPreset === p
                      ? "bg-cyan-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Scrub */}
          <div>
            <div className="text-xs font-bold text-slate-300 mb-2 flex items-center justify-between">
              <span>SCAN PROGRESS</span>
              <span className="text-cyan-300 font-mono">{(scanT * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[scanT * 100]}
              onValueChange={(v) => { setScanT(v[0] / 100); setPlaying(false); }}
              min={0}
              max={100}
              step={0.5}
            />
          </div>

          {/* Transport */}
          <div className="grid grid-cols-4 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => cyclePass(false)}
              className="col-span-1"
              title="Previous pass"
            >
              Prev
            </Button>
            <Button
              size="sm"
              onClick={() => setPlaying(!playing)}
              className="col-span-2 bg-cyan-600 hover:bg-cyan-500"
            >
              {playing ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
              {playing ? "Pause" : "Play"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => cyclePass(true)}
              className="col-span-1"
              title="Next pass"
            >
              Next
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="h-3 w-3 mr-2" />Reset
          </Button>

          <div className="rounded-md border border-cyan-900/40 bg-slate-950/60 p-3 text-xs">
            <div className="mb-2 font-bold uppercase text-slate-300">Procedure locks</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <div className="text-slate-500">Water path</div>
                <div className="font-mono text-cyan-300">{WATER_PATH.toFixed(1)} in</div>
              </div>
              <div>
                <div className="text-slate-500">Snell setup</div>
                <div className="font-mono text-cyan-300">{INCIDENT_ANGLE.toFixed(1)} -&gt; {REFRACTED_ANGLE} deg</div>
              </div>
              <div>
                <div className="text-slate-500">Scan/index max</div>
                <div className="font-mono text-cyan-300">{MAX_SCAN_INC.toFixed(3)} / {MAX_INDEX_INC.toFixed(3)} in</div>
              </div>
              <div>
                <div className="text-slate-500">Pass count</div>
                <div className="font-mono text-cyan-300">{PASS_COUNT} total</div>
              </div>
            </div>
          </div>

          <FshScale />

          {/* C-scan strip */}
          <div className="mt-2">
            <CScanStrip zone={zone} scanT={scanT} angle={angle * 45} />
            <div className="mt-1 text-[10px] text-slate-500 font-mono">
              Peak amplitude per position; pixels at or above {PW_V2500_SIGNAL_RULES.recordableIndicationFsh}% FSH are reportable.
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-cyan-900/30 bg-slate-950/40 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <span>
          Each zone is scanned twice (+45 / -45). {PASS_COUNT} passes total per disk.
        </span>
        <span className="font-mono text-slate-500">
          Source: src/rules/pw/pwScanPlans.ts | Asset: Engine V2500-A5-0765-Model.stl (P/N 2A5001)
        </span>
      </div>
    </Card>
  );
}

export default V2500ScanSimulator;
