import * as THREE from 'three';
import { CSG } from 'three-csg-ts';

/**
 * Helper function to perfectly center any geometry at origin
 */
function perfectCenter(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const boundingBox = geometry.boundingBox;
  
  if (boundingBox) {
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);
  }
  
  return geometry;
}

/**
 * Create hollow geometry by subtracting inner geometry from outer
 * Improved error handling and validation to prevent crashes
 */
function createHollowGeometry(
  outerGeometry: THREE.BufferGeometry,
  innerGeometry: THREE.BufferGeometry
): THREE.BufferGeometry {
  // Track temporary geometries for cleanup
  let outerClone: THREE.BufferGeometry | null = null;
  let innerClone: THREE.BufferGeometry | null = null;

  try {
    // Validate input geometries
    if (!outerGeometry || !innerGeometry) {
      console.warn('Invalid geometry provided for CSG operation, returning outer geometry');
      return outerGeometry;
    }

    // Ensure geometries have proper attributes
    if (!outerGeometry.attributes.position || !innerGeometry.attributes.position) {
      console.warn('Geometry missing position attribute, returning outer geometry');
      return outerGeometry;
    }

    // Check for degenerate geometries
    const outerPositions = outerGeometry.attributes.position.array;
    const innerPositions = innerGeometry.attributes.position.array;

    if (outerPositions.length < 9 || innerPositions.length < 9) { // At least 3 vertices (x,y,z each)
      console.warn('Degenerate geometry detected, returning outer geometry');
      return outerGeometry;
    }

    // Create meshes with error checking - clone geometries for CSG
    outerClone = outerGeometry.clone();
    innerClone = innerGeometry.clone();
    const outerMesh = new THREE.Mesh(outerClone);
    const innerMesh = new THREE.Mesh(innerClone);

    // Ensure meshes are properly initialized
    outerMesh.updateMatrix();
    innerMesh.updateMatrix();

    // Perform CSG operation with additional error handling
    let resultMesh;
    try {
      resultMesh = CSG.subtract(outerMesh, innerMesh);
    } catch (csgError) {
      console.warn('CSG.subtract failed, attempting fallback:', csgError);
      // Dispose temporary geometries before returning
      outerClone?.dispose();
      innerClone?.dispose();
      // Return a clone of outer geometry to prevent mutation issues
      return outerGeometry.clone();
    }

    // Dispose temporary geometries - they're no longer needed
    outerClone.dispose();
    innerClone.dispose();
    outerClone = null;
    innerClone = null;

    // Validate result
    if (!resultMesh || !resultMesh.geometry) {
      console.warn('CSG operation produced invalid result, returning outer geometry');
      return outerGeometry.clone();
    }

    // Ensure the result geometry is valid
    const resultGeometry = resultMesh.geometry;
    if (!resultGeometry.attributes.position) {
      console.warn('CSG result missing position attribute, returning outer geometry');
      return outerGeometry.clone();
    }

    return resultGeometry;
  } catch (error) {
    console.error('Unexpected error in createHollowGeometry, safely returning outer geometry:', error);
    // Dispose any temporary geometries on error
    outerClone?.dispose();
    innerClone?.dispose();
    // Return a clone to prevent mutation issues
    return outerGeometry.clone();
  }
}

export interface ShapeParameters {
  isHollow?: boolean;
  outerDiameter?: number;
  innerDiameter?: number;
  length?: number;
  width?: number;
  thickness?: number;
  innerLength?: number;
  innerWidth?: number;
  // Cone-specific parameters
  coneTopDiameter?: number;      // Top diameter (smaller end, 0 = pointed)
  coneBottomDiameter?: number;   // Bottom diameter (base, larger end)
  coneHeight?: number;           // Height of the cone
  wallThickness?: number;        // Wall thickness for hollow cone
}

/**
 * Create 3D geometries for all part types
 * All geometries are perfectly centered at origin (0,0,0)
 */

export const ShapeGeometries = {
  // ============= BASE GEOMETRIES =============
  box: (params?: ShapeParameters) => {
    const outer = new THREE.BoxGeometry(2, 1, 1.5);
    
    if (params?.isHollow && params.innerLength && params.innerWidth) {
      // Validate parameters are positive and reasonable
      if (params.innerLength <= 0 || params.innerWidth <= 0) {
        console.warn('Invalid inner dimensions for hollow box, returning solid geometry');
        return perfectCenter(outer);
      }
      
      const inner = new THREE.BoxGeometry(
        Math.min(params.innerLength / 100 * 2, 1.9), // Ensure inner is smaller than outer
        params.thickness ? Math.min(params.thickness / 50, 0.9) : 0.8,
        Math.min(params.innerWidth / 75 * 1.5, 1.4)
      );
      return perfectCenter(createHollowGeometry(outer, inner));
    }
    
    return perfectCenter(outer);
  },
  
  cylinder: (params?: ShapeParameters) => {
    const outerRadius = 0.5;
    const height = 2;
    const outer = new THREE.CylinderGeometry(outerRadius, outerRadius, height, 32);
    outer.rotateZ(Math.PI / 2);
    
    if (params?.isHollow && params.innerDiameter && params.outerDiameter) {
      // Validate diameters
      if (params.innerDiameter <= 0 || params.outerDiameter <= 0 || 
          params.innerDiameter >= params.outerDiameter) {
        console.warn('Invalid hollow cylinder dimensions, returning solid geometry');
        return perfectCenter(outer);
      }
      
      const innerRadius = Math.min((params.innerDiameter / params.outerDiameter) * outerRadius, outerRadius * 0.95);
      const inner = new THREE.CylinderGeometry(innerRadius, innerRadius, height + 0.1, 32);
      inner.rotateZ(Math.PI / 2);
      return perfectCenter(createHollowGeometry(outer, inner));
    }
    
    return perfectCenter(outer);
  },
  
  tube: (params?: ShapeParameters) => {
    // Tube can be shown as solid (cylinder) or hollow based on isHollow toggle
    const outerRadius = 0.5;
    const height = 2;

    // If isHollow is explicitly false, show as solid cylinder
    if (params?.isHollow === false) {
      const solid = new THREE.CylinderGeometry(outerRadius, outerRadius, height, 32);
      solid.rotateZ(Math.PI / 2);
      return perfectCenter(solid);
    }

    // Default: show as hollow tube
    const outer = new THREE.CylinderGeometry(outerRadius, outerRadius, height, 32);
    outer.rotateZ(Math.PI / 2);

    const innerRadius = params?.innerDiameter && params?.outerDiameter && params.innerDiameter > 0
      ? Math.min((params.innerDiameter / params.outerDiameter) * outerRadius, outerRadius * 0.95)
      : outerRadius * 0.6; // Default inner radius if not specified

    const inner = new THREE.CylinderGeometry(innerRadius, innerRadius, height + 0.1, 32);
    inner.rotateZ(Math.PI / 2);
    return perfectCenter(createHollowGeometry(outer, inner));
  },
  
  rectangular_tube: (params?: ShapeParameters) => {
    const outer = new THREE.BoxGeometry(1, 2, 0.6);

    // If isHollow is explicitly false, show as solid box
    if (params?.isHollow === false) {
      return perfectCenter(outer);
    }

    // Default: show as hollow rectangular tube
    if (params?.innerLength && params.innerWidth) {
      const inner = new THREE.BoxGeometry(
        0.7,
        params.innerLength / 100 * 2,
        params.innerWidth / 100 * 0.6
      );
      return perfectCenter(createHollowGeometry(outer, inner));
    }

    // Default hollow with standard wall thickness
    const inner = new THREE.BoxGeometry(0.7, 1.7, 0.4);
    return perfectCenter(createHollowGeometry(outer, inner));
  },
  
  hexagon: (params?: ShapeParameters) => {
    const outerRadius = 0.5;
    const height = 2;
    const outer = new THREE.CylinderGeometry(outerRadius, outerRadius, height, 6);
    outer.rotateZ(Math.PI / 2);
    
    if (params?.isHollow && params.innerDiameter && params.outerDiameter) {
      // Validate diameters
      if (params.innerDiameter <= 0 || params.outerDiameter <= 0 || 
          params.innerDiameter >= params.outerDiameter) {
        console.warn('Invalid hollow hexagon dimensions, returning solid geometry');
        return perfectCenter(outer);
      }
      
      const innerRadius = Math.min((params.innerDiameter / params.outerDiameter) * outerRadius, outerRadius * 0.95);
      const inner = new THREE.CylinderGeometry(innerRadius, innerRadius, height + 0.1, 6);
      inner.rotateZ(Math.PI / 2);
      return perfectCenter(createHollowGeometry(outer, inner));
    }
    
    return perfectCenter(outer);
  },
  
  sphere: (params?: ShapeParameters) => {
    const outerRadius = 0.7;
    const outer = new THREE.SphereGeometry(outerRadius, 32, 32);
    
    if (params?.isHollow && params.innerDiameter && params.outerDiameter) {
      // Validate diameters
      if (params.innerDiameter <= 0 || params.outerDiameter <= 0 || 
          params.innerDiameter >= params.outerDiameter) {
        console.warn('Invalid hollow sphere dimensions, returning solid geometry');
        return perfectCenter(outer);
      }
      
      const innerRadius = Math.min((params.innerDiameter / params.outerDiameter) * outerRadius, outerRadius * 0.95);
      const inner = new THREE.SphereGeometry(innerRadius, 32, 32);
      return perfectCenter(createHollowGeometry(outer, inner));
    }
    
    return perfectCenter(outer);
  },
  
  cone: (params?: ShapeParameters) => {
    // CONE IS ALWAYS HOLLOW - it's a tapered tube in ultrasonic inspection
    // Never a solid pointed cone - always has wall thickness
    const bottomDiameter = params?.coneBottomDiameter || 100;
    const bottomRadius = bottomDiameter / 100; // Scale to reasonable 3D size
    // Default top diameter is 60% of bottom diameter for a nice truncated cone shape (not pointed!)
    const defaultTopDiameter = bottomDiameter * 0.6;
    // If coneTopDiameter is not provided or is 0, use default. Never allow pointed (minimum 30% of bottom)
    const topDiameter = (params?.coneTopDiameter && params.coneTopDiameter > 0) 
      ? params.coneTopDiameter 
      : defaultTopDiameter;
    const topRadius = Math.max(topDiameter / 100, bottomRadius * 0.3);
    const height = (params?.coneHeight || 150) / 100;
    // Wall thickness defaults to 15mm if not specified (thicker wall for better visibility)
    const wallThickness = (params?.wallThickness || 15) / 100;

    // ALWAYS create hollow cone (tapered tube) using LatheGeometry
    const points: THREE.Vector2[] = [];
    const innerBottomRadius = Math.max(bottomRadius - wallThickness, bottomRadius * 0.5);
    const innerTopRadius = Math.max(topRadius - wallThickness, topRadius * 0.5);

    // Create cross-section profile for hollow cone (clockwise from bottom-outer)
    points.push(new THREE.Vector2(bottomRadius, 0));           // Bottom outer
    points.push(new THREE.Vector2(topRadius, height));          // Top outer
    points.push(new THREE.Vector2(innerTopRadius, height));     // Top inner
    points.push(new THREE.Vector2(innerBottomRadius, 0));       // Bottom inner

    const geometry = new THREE.LatheGeometry(points, 64);
    return perfectCenter(geometry);
  },
  
  // ============= LEGACY MAPPINGS (for backward compatibility) =============

  // PLATE - Flat rectangular (W/T > 5 per ASTM E2375) - thin and wide
  plate: (params?: ShapeParameters) => {
    // Plate is thin: width >> thickness
    const outer = new THREE.BoxGeometry(2.5, 0.3, 1.8); // Wide and thin

    if (params?.isHollow && params.innerLength && params.innerWidth) {
      if (params.innerLength <= 0 || params.innerWidth <= 0) {
        return perfectCenter(outer);
      }
      const inner = new THREE.BoxGeometry(2.2, 0.25, 1.5);
      return perfectCenter(createHollowGeometry(outer, inner));
    }

    return perfectCenter(outer);
  },
  sheet: (params?: ShapeParameters) => ShapeGeometries.plate(params),
  slab: (params?: ShapeParameters) => ShapeGeometries.plate(params),
  flat_bar: (params?: ShapeParameters) => ShapeGeometries.plate(params),

  // BOX/BAR/BILLET - Compact rectangular (W/T < 5 per ASTM E2375)
  rectangular_bar: (params?: ShapeParameters) => ShapeGeometries.box(params),
  square_bar: (params?: ShapeParameters) => ShapeGeometries.box(params),
  billet: (params?: ShapeParameters) => ShapeGeometries.box(params),
  block: (params?: ShapeParameters) => ShapeGeometries.box(params),
  
  round_bar: (params?: ShapeParameters) => ShapeGeometries.cylinder(params),
  shaft: (params?: ShapeParameters) => ShapeGeometries.cylinder(params),
  hub: (params?: ShapeParameters) => ShapeGeometries.cylinder(params),

  // DISK - Flat solid circular (H/D < 0.5 per ASTM E2375)
  disk: (params?: ShapeParameters) => {
    const outerRadius = 1.0;
    const height = 0.4; // Flat disk - height much less than diameter
    const outer = new THREE.CylinderGeometry(outerRadius, outerRadius, height, 32);
    // No rotation - disk is flat like a pancake
    return perfectCenter(outer);
  },
  disk_forging: (params?: ShapeParameters) => {
    const outerRadius = 1.0;
    const height = 0.4; // Flat disk forging - H/D < 0.5
    const outer = new THREE.CylinderGeometry(outerRadius, outerRadius, height, 32);
    return perfectCenter(outer);
  },

  // RING - Short hollow circular (L/T < 5 per ASTM E2375)
  ring: (params?: ShapeParameters) => {
    const outerRadius = 0.8;
    const innerRadius = 0.5;
    const height = 0.6; // Short ring - L/T < 5
    const outer = new THREE.CylinderGeometry(outerRadius, outerRadius, height, 32);
    const inner = new THREE.CylinderGeometry(innerRadius, innerRadius, height + 0.1, 32);
    return perfectCenter(createHollowGeometry(outer, inner));
  },
  ring_forging: (params?: ShapeParameters) => {
    const outerRadius = 0.8;
    const innerRadius = 0.5;
    const height = 0.6; // Short ring forging - L/T < 5
    const outer = new THREE.CylinderGeometry(outerRadius, outerRadius, height, 32);
    const inner = new THREE.CylinderGeometry(innerRadius, innerRadius, height + 0.1, 32);
    return perfectCenter(createHollowGeometry(outer, inner));
  },

  pipe: (params?: ShapeParameters) => ShapeGeometries.tube(params),
  sleeve: (params?: ShapeParameters) => ShapeGeometries.tube(params),
  bushing: (params?: ShapeParameters) => ShapeGeometries.tube(params),
  
  square_tube: (params?: ShapeParameters) => ShapeGeometries.rectangular_tube(params),
  
  hex_bar: (params?: ShapeParameters) => ShapeGeometries.hexagon(params),

  // IMPELLER - Realistic stepped disk with hub, web, rim and smooth fillet transitions
  impeller: (params?: ShapeParameters) => {
    const points: THREE.Vector2[] = [];
    const boreRadius = 0.18;
    const hubRadius = 0.38;
    const hubHeight = 0.55;
    const webThickness = 0.08;
    const rimRadius = 0.92;
    const rimHeight = 0.32;

    // Bottom profile (inside to outside)
    // Bore inner wall bottom
    points.push(new THREE.Vector2(boreRadius, -hubHeight / 2));
    // Hub bottom face
    points.push(new THREE.Vector2(hubRadius, -hubHeight / 2));
    // Fillet: hub bottom to web (smooth curve)
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const angle = (Math.PI / 2) * t;
      const r = hubRadius + 0.06 * Math.sin(angle);
      const y = -webThickness / 2 - 0.06 * Math.cos(angle);
      points.push(new THREE.Vector2(r, y));
    }
    // Web bottom surface going outward
    points.push(new THREE.Vector2(rimRadius - 0.12, -webThickness / 2));
    // Fillet: web to rim bottom
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const angle = (Math.PI / 2) * t;
      const r = rimRadius - 0.12 + 0.12 * Math.sin(angle);
      const y = -webThickness / 2 - (rimHeight / 2 - webThickness / 2) * Math.sin(angle * 0.7);
      points.push(new THREE.Vector2(r, y));
    }
    // Rim bottom
    points.push(new THREE.Vector2(rimRadius, -rimHeight / 2));
    // Rim outer wall
    points.push(new THREE.Vector2(rimRadius, rimHeight / 2));
    // Rim top to web fillet
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const angle = (Math.PI / 2) * (1 - t);
      const r = rimRadius - 0.12 + 0.12 * Math.sin(angle);
      const y = webThickness / 2 + (rimHeight / 2 - webThickness / 2) * Math.sin(angle * 0.7);
      points.push(new THREE.Vector2(r, y));
    }
    // Web top surface going inward
    points.push(new THREE.Vector2(hubRadius + 0.06, webThickness / 2));
    // Fillet: web to hub top
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const angle = (Math.PI / 2) * (1 - t);
      const r = hubRadius + 0.06 * Math.sin(angle);
      const y = webThickness / 2 + 0.06 * Math.cos(angle);
      points.push(new THREE.Vector2(r, y));
    }
    // Hub top face
    points.push(new THREE.Vector2(hubRadius, hubHeight / 2));
    // Bore inner wall top
    points.push(new THREE.Vector2(boreRadius, hubHeight / 2));

    const geometry = new THREE.LatheGeometry(points, 64);
    return perfectCenter(geometry);
  },

  // BLISK - Bladed disk with actual visible blades using CSG union
  blisk: (params?: ShapeParameters) => {
    const diskRadius = 0.7;
    const diskHeight = 0.22;
    const boreRadius = 0.18;
    const numBlades = 20;
    const bladeHeight = 0.35;
    const bladeThickness = 0.025;
    const bladeChord = 0.22;

    // Create disk body with bore using LatheGeometry for a slight hub profile
    const diskPoints: THREE.Vector2[] = [];
    diskPoints.push(new THREE.Vector2(boreRadius, -diskHeight * 0.7));
    diskPoints.push(new THREE.Vector2(boreRadius + 0.08, -diskHeight * 0.7));
    // Slight hub bulge
    diskPoints.push(new THREE.Vector2(boreRadius + 0.12, -diskHeight * 0.5));
    diskPoints.push(new THREE.Vector2(diskRadius * 0.5, -diskHeight * 0.3));
    diskPoints.push(new THREE.Vector2(diskRadius, -diskHeight / 2));
    diskPoints.push(new THREE.Vector2(diskRadius, diskHeight / 2));
    diskPoints.push(new THREE.Vector2(diskRadius * 0.5, diskHeight * 0.3));
    diskPoints.push(new THREE.Vector2(boreRadius + 0.12, diskHeight * 0.5));
    diskPoints.push(new THREE.Vector2(boreRadius + 0.08, diskHeight * 0.7));
    diskPoints.push(new THREE.Vector2(boreRadius, diskHeight * 0.7));

    const diskGeometry = new THREE.LatheGeometry(diskPoints, 64);
    const diskMesh = new THREE.Mesh(diskGeometry);
    diskMesh.updateMatrix();

    // Create blades around the rim using CSG union
    let resultMesh: THREE.Mesh<THREE.BufferGeometry> = diskMesh;
    for (let i = 0; i < numBlades; i++) {
      const angle = (i / numBlades) * Math.PI * 2;
      // Airfoil-like blade: thin box slightly curved outward
      const bladeGeom = new THREE.BoxGeometry(bladeChord, bladeHeight, bladeThickness);
      const bladeMesh = new THREE.Mesh(bladeGeom);

      // Position blade at the rim, extending radially outward
      const midR = diskRadius + bladeChord / 2 - 0.03;
      bladeMesh.position.set(
        Math.cos(angle) * midR,
        0,
        Math.sin(angle) * midR
      );
      // Rotate blade to face radially + slight twist for realism
      bladeMesh.rotation.y = -angle + Math.PI / 2;
      bladeMesh.rotation.x = 0.15; // slight twist
      bladeMesh.updateMatrix();

      try {
        resultMesh = CSG.union(resultMesh, bladeMesh);
      } catch {
        // If CSG fails on a blade, skip it
      }
    }

    const finalGeometry = resultMesh.geometry.clone();
    return perfectCenter(finalGeometry);
  },

  // HPT DISK - V2500 High Pressure Turbine Disk bore profile (NDIP-1226/1227 Figure 2)
  // Proportions derived from real V2500 HPT disk: bore R=2.91", hub~4.5", web~0.5", rim~9"
  // Surfaces: bore ID (D) → chamfer (C) → land (B) → chamfer (A) → fillet (E) → web → rim
  hpt_disk: (params?: ShapeParameters) => {
    const points: THREE.Vector2[] = [];

    // Normalized proportions based on real V2500 dimensions (bore=2.91", rim≈9")
    const boreRadius = 0.32;       // Bore ID - proportionally larger (2.91/9 ≈ 0.32)
    const landWidth = 0.04;        // Surface B flat land width
    const chamferSize = 0.035;     // Surfaces A & C chamfer depth
    const hubRadius = 0.50;        // Hub outer radius where fillet E begins
    const hubHalfHeight = 0.30;    // Hub half-height (axial, each side from center)
    const filletRadius = 0.08;     // Fillet E radius (web-to-hub transition)
    const webHalfThick = 0.05;     // Web half-thickness
    const webToRimFillet = 0.06;   // Fillet radius at web-to-rim junction
    const rimRadius = 0.95;        // Rim outer radius
    const rimHalfHeight = 0.16;    // Rim half-height

    // === BOTTOM HALF (bore outward, y negative = bottom) ===

    // D: Bore inner wall (vertical, bottom)
    points.push(new THREE.Vector2(boreRadius, -hubHalfHeight));

    // C: Chamfer from bore wall to land (angled outward + upward)
    points.push(new THREE.Vector2(boreRadius, -hubHalfHeight + 0.02));
    points.push(new THREE.Vector2(boreRadius + chamferSize, -hubHalfHeight + chamferSize + 0.02));

    // B: Flat land (horizontal face of hub)
    points.push(new THREE.Vector2(boreRadius + chamferSize + landWidth, -hubHalfHeight + chamferSize + 0.02));

    // A: Chamfer from land upward to fillet zone
    points.push(new THREE.Vector2(boreRadius + chamferSize + landWidth + chamferSize, -hubHalfHeight + 2 * chamferSize + 0.02));

    // E: Curved fillet from hub face down to web level (12-point arc for smoothness)
    const eStartR = boreRadius + chamferSize + landWidth + chamferSize;
    const eStartY = -hubHalfHeight + 2 * chamferSize + 0.02;
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      const angle = (Math.PI / 2) * t;
      const r = eStartR + (hubRadius - eStartR) * (1 - Math.cos(angle));
      const y = eStartY + ((-webHalfThick) - eStartY) * Math.sin(angle);
      points.push(new THREE.Vector2(r, y));
    }

    // Hub to web transition
    points.push(new THREE.Vector2(hubRadius + filletRadius, -webHalfThick));

    // Web bottom surface (flat, extending outward to rim)
    points.push(new THREE.Vector2(rimRadius - webToRimFillet * 2, -webHalfThick));

    // Fillet: web to rim (8-point arc)
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const angle = (Math.PI / 2) * t;
      const r = rimRadius - webToRimFillet * 2 + webToRimFillet * 2 * Math.sin(angle);
      const y = -webHalfThick - (rimHalfHeight - webHalfThick) * (1 - Math.cos(angle));
      points.push(new THREE.Vector2(r, y));
    }

    // Rim outer wall
    points.push(new THREE.Vector2(rimRadius, -rimHalfHeight));
    points.push(new THREE.Vector2(rimRadius, rimHalfHeight));

    // === TOP HALF (mirror of bottom, y positive = top) ===

    // Fillet: rim to web (top)
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const angle = (Math.PI / 2) * (1 - t);
      const r = rimRadius - webToRimFillet * 2 + webToRimFillet * 2 * Math.sin(angle);
      const y = webHalfThick + (rimHalfHeight - webHalfThick) * (1 - Math.cos(angle));
      points.push(new THREE.Vector2(r, y));
    }

    // Web top surface
    points.push(new THREE.Vector2(hubRadius + filletRadius, webHalfThick));

    // E': Fillet from web to hub face (top, 12-point arc)
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      const angle = (Math.PI / 2) * (1 - t);
      const r = eStartR + (hubRadius - eStartR) * (1 - Math.cos(angle));
      const y = -(eStartY + ((-webHalfThick) - eStartY) * Math.sin(angle));
      points.push(new THREE.Vector2(r, y));
    }

    // A': Chamfer (top)
    points.push(new THREE.Vector2(boreRadius + chamferSize + landWidth + chamferSize, hubHalfHeight - 2 * chamferSize - 0.02));

    // B': Land (top)
    points.push(new THREE.Vector2(boreRadius + chamferSize + landWidth, hubHalfHeight - chamferSize - 0.02));

    // C': Chamfer to bore (top)
    points.push(new THREE.Vector2(boreRadius + chamferSize, hubHalfHeight - chamferSize - 0.02));
    points.push(new THREE.Vector2(boreRadius, hubHalfHeight - 0.02));

    // D': Bore inner wall (top)
    points.push(new THREE.Vector2(boreRadius, hubHalfHeight));

    const geometry = new THREE.LatheGeometry(points, 64);
    return perfectCenter(geometry);
  },

  // Generic fallbacks
  bar: (params?: ShapeParameters) => ShapeGeometries.box(params),
  forging: (params?: ShapeParameters) => ShapeGeometries.cylinder(params),
  round_forging_stock: (params?: ShapeParameters) => ShapeGeometries.cylinder(params),
  rectangular_forging_stock: (params?: ShapeParameters) => ShapeGeometries.box(params),
  near_net_forging: (params?: ShapeParameters) => ShapeGeometries.cylinder(params),
  machined_component: (params?: ShapeParameters) => ShapeGeometries.box(params),
  custom: (params?: ShapeParameters) => ShapeGeometries.box(params),
};

/**
 * PERFORMANCE: Global geometry cache to avoid recalculating expensive CSG operations
 * Key: "partType-paramHash", Value: cloned BufferGeometry
 */
const geometryCache = new Map<string, THREE.BufferGeometry>();

/**
 * Generate a simple hash key for params
 */
function getParamsKey(params?: ShapeParameters): string {
  if (!params) return 'default';
  return JSON.stringify(params);
}

/**
 * Get geometry by part type with optional hollow parameters
 * PERFORMANCE: Uses global cache to avoid regenerating expensive geometries
 */
export const getGeometryByType = (
  partType: string,
  params?: ShapeParameters
): THREE.BufferGeometry => {
  const cacheKey = `${partType}-${getParamsKey(params)}`;

  // Check cache first
  const cached = geometryCache.get(cacheKey);
  if (cached) {
    // Return a clone to prevent shared geometry mutations
    return cached.clone();
  }

  const geometryFunc = ShapeGeometries[partType as keyof typeof ShapeGeometries] as
    | ((params?: ShapeParameters) => THREE.BufferGeometry)
    | undefined;
  let geometry: THREE.BufferGeometry;

  if (geometryFunc) {
    geometry = geometryFunc(params);
  } else {
    // Fallback to generic box
    geometry = perfectCenter(new THREE.BoxGeometry(1, 1, 1));
  }

  // Store in cache (clone to keep pristine copy)
  geometryCache.set(cacheKey, geometry.clone());

  return geometry;
};

/**
 * Clear the geometry cache (useful for memory management)
 */
export const clearGeometryCache = (): void => {
  geometryCache.forEach(geom => geom.dispose());
  geometryCache.clear();
};
