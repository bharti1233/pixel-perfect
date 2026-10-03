/**
 * Hat3DGenerator: builds a Three.js hat (mm units) from parametric HatParameters.
 *
 *   HatGroup (origin = centre of the opening where the hat meets the head)
 *   ├── Crown  (type-specific: dome / lathe / band)
 *   ├── Brim   (type-specific: visor sector / full ring / sloped bucket brim)
 *   └── Detail (top button, fold band — depending on type)
 *
 * +y = up out of the head, +z = forward (face direction). The HeadFitter
 * anchors this group below the tracked top-of-head and rotates it with the
 * head quaternion.
 */
import * as THREE from "three";
import type { HatParameters } from "@/types/things";
import { fabricMaterial } from "./materials";

const TAU = Math.PI * 2;

/** Sector of an annulus in the XY shape plane (forward = +y), later laid flat into XZ. */
function annulusSector(
  rInner: number,
  rOuter: number,
  halfAngle: number,
  segments: number,
): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const a = -halfAngle + (2 * halfAngle * i) / segments;
    const x = rInner * Math.sin(a);
    const y = rInner * Math.cos(a);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = segments; i >= 0; i--) {
    const a = -halfAngle + (2 * halfAngle * i) / segments;
    shape.lineTo(rOuter * Math.sin(a), rOuter * Math.cos(a));
  }
  shape.closePath();
  return shape;
}

function fullAnnulus(rInner: number, rOuter: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOuter, 0, TAU, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rInner, 0, TAU, true);
  shape.holes.push(hole);
  return shape;
}

/** Lay an XY shape flat into XZ (extrusion thickness runs along -y), then lift to `y`. */
function flatten(geo: THREE.ExtrudeGeometry, y: number): THREE.BufferGeometry {
  geo.rotateX(Math.PI / 2);
  geo.translate(0, y, 0);
  return geo;
}

function extrude(shape: THREE.Shape, thickness: number): THREE.ExtrudeGeometry {
  return new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 24,
  });
}

/** Top button found on baseball caps. */
function topButton(mat: THREE.Material, y: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(5, 14, 10), mat);
  m.position.y = y;
  return m;
}

function foldBand(mat: THREE.Material, rx: number, rz: number, height: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(1, 1, height, 48, 1, true);
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(rx, 1, rz);
  m.position.y = height / 2;
  return m;
}

export function generateHat(params: HatParameters): THREE.Group {
  const group = new THREE.Group();
  group.name = "Hat3D";

  const rx = params.width / 2; // crown radius, x
  const rz = params.depth / 2; // crown radius, z (front-back)
  const h = params.height;
  const brimW = params.brimWidth ?? 0; // forward projection
  const brimD = params.brimDepth ?? 0; // side-to-side width
  const mat = fabricMaterial(params.color);

  const crownGeos: THREE.BufferGeometry[] = [];
  const brimGeos: THREE.BufferGeometry[] = [];

  switch (params.type) {
    case "beanie": {
      const dome = new THREE.SphereGeometry(1, 40, 24, 0, TAU, 0, Math.PI / 2);
      dome.scale(rx, h, rz);
      const crown = new THREE.Mesh(dome, mat);
      crown.name = "Crown";
      group.add(crown);
      crownGeos.push(dome);
      const band = foldBand(mat, rx * 1.05, rz * 1.05, Math.min(28, h * 0.3));
      band.name = "FoldBand";
      group.add(band);
      break;
    }
    case "fedora":
    case "other": {
      // tapered lathe crown with a softly rounded top
      const profile: THREE.Vector2[] = [
        new THREE.Vector2(0.99, 0),
        new THREE.Vector2(1.0, h * 0.18),
        new THREE.Vector2(0.96, h * 0.62),
        new THREE.Vector2(0.86, h * 0.85),
        new THREE.Vector2(0.55, h * 0.97),
        new THREE.Vector2(0.0, h),
      ];
      const lathe = new THREE.LatheGeometry(profile, 44);
      lathe.scale(rx, 1, rz);
      const crown = new THREE.Mesh(lathe, mat);
      crown.name = "Crown";
      group.add(crown);
      crownGeos.push(lathe);

      if (brimD > 0) {
        const outer = Math.max(rx + 6, brimD / 2);
        const brimGeo = flatten(extrude(fullAnnulus(Math.min(rx, rz) - 1, outer), 3), 2);
        const brim = new THREE.Mesh(brimGeo, mat);
        brim.name = "Brim";
        group.add(brim);
        brimGeos.push(brimGeo);
      }
      break;
    }
    case "bucket": {
      const dome = new THREE.SphereGeometry(1, 40, 24, 0, TAU, 0, Math.PI / 2);
      dome.scale(rx, h, rz);
      const crown = new THREE.Mesh(dome, mat);
      crown.name = "Crown";
      group.add(crown);
      crownGeos.push(dome);

      if (brimW > 0) {
        // sloped, downward bell around the whole head
        const drop = Math.max(16, brimW * 0.9);
        const cone = new THREE.CylinderGeometry(1, 1.3, drop, 48, 1, true);
        cone.scale(rx, 1, rz);
        const brim = new THREE.Mesh(cone, mat);
        brim.name = "Brim";
        brim.position.y = -drop / 2 + 2;
        group.add(brim);
        brimGeos.push(cone);
      }
      break;
    }
    case "visor": {
      const band = foldBand(mat, rx, rz, Math.min(34, h));
      band.name = "CrownBand";
      group.add(band);
      crownGeos.push(band.geometry);
      if (brimW > 0) {
        const outer = Math.max(rx + brimW, (brimD || 0) / 2);
        const brimGeo = flatten(
          extrude(annulusSector(Math.min(rx, rz) - 1, outer, 1.15, 28), 3),
          4,
        );
        const brim = new THREE.Mesh(brimGeo, mat);
        brim.name = "Brim";
        group.add(brim);
        brimGeos.push(brimGeo);
      }
      break;
    }
    case "cap":
    default: {
      const dome = new THREE.SphereGeometry(1, 40, 24, 0, TAU, 0, Math.PI / 2);
      dome.scale(rx, h, rz);
      const crown = new THREE.Mesh(dome, mat);
      crown.name = "Crown";
      group.add(crown);
      crownGeos.push(dome);
      group.add(topButton(mat, h));

      if (brimW > 0) {
        const outer = Math.max(rx + brimW, rx + 8);
        const halfAngle = Math.min(1.5, Math.max(0.7, (brimD || 0) / 2 / Math.max(rx, 1)) || 1.2);
        const brimGeo = flatten(
          extrude(annulusSector(Math.min(rx, rz) - 2, outer, halfAngle, 30), 4),
          6,
        );
        const brim = new THREE.Mesh(brimGeo, mat);
        brim.name = "Brim";
        // tilt the visor slightly downward like a real cap peak
        brim.rotation.x = 0.22;
        group.add(brim);
        brimGeos.push(brimGeo);
      }
      break;
    }
  }

  group.userData["crownGeometries"] = crownGeos;
  group.userData["brimGeometries"] = brimGeos;
  group.userData["fabricMaterial"] = mat;
  return group;
}
