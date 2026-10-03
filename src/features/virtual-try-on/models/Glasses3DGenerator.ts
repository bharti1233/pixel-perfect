/**
 * Glasses3DGenerator: builds a real Three.js object (mm units) from parametric
 * GlassesParameters — NOT a flat image.
 *
 *   GlassesGroup (origin = bridge centre, lens plane z=0, +z out of the lenses)
 *   ├── RightFrame / LeftFrame   (extruded rim with lens-shaped hole)
 *   ├── RightLens  / LeftLens    (thin transparent physical-material lens)
 *   ├── Bridge                   (curved tube across the nose bridge)
 *   ├── NoseBridge               (translucent nose pads)
 *   ├── RightHinge / LeftHinge   (metal hardware)
 *   └── RightTemple / LeftTemple (tube along the ear, bowing to frameWidth)
 *
 * All sizes are millimetres — the fitter converts mm -> px via eye distance.
 */
import * as THREE from "three";
import type { GlassesParameters } from "@/types/things";
import { frameMaterial, hardwareMaterial, lensMaterial, padMaterial } from "./materials";

type ShapeKind = GlassesParameters["frameShape"];

function roundedPolygon(points: Array<[number, number]>, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const l1 = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]) || 1;
    const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const a: [number, number] = [
      p1[0] + ((p0[0] - p1[0]) / l1) * r,
      p1[1] + ((p0[1] - p1[1]) / l1) * r,
    ];
    const b: [number, number] = [
      p1[0] + ((p2[0] - p1[0]) / l2) * r,
      p1[1] + ((p2[1] - p1[1]) / l2) * r,
    ];
    if (i === 0) shape.moveTo(a[0], a[1]);
    else shape.lineTo(a[0], a[1]);
    shape.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  shape.closePath();
  return shape;
}

function ellipseShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absellipse(0, 0, w / 2, h / 2, 0, Math.PI * 2, false, 0);
  return s;
}

function circleShape(d: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(0, 0, d / 2, 0, Math.PI * 2, false);
  return s;
}

/**
 * Lens outline for a frame style. `side` = +1 for the lens on the +x side
 * (outer edge = +x); cateye shapes use it for the raised outer corner.
 * For all other shapes the outline is symmetric and side is irrelevant.
 */
function lensOutline(kind: ShapeKind, w: number, h: number, side: 1 | -1): THREE.Shape {
  switch (kind) {
    case "round":
      return circleShape((w + h) / 2);
    case "oval":
      return ellipseShape(w, h);
    case "square":
      return roundedPolygon(
        [
          [-w / 2, -h / 2],
          [w / 2, -h / 2],
          [w / 2, h / 2],
          [-w / 2, h / 2],
        ],
        Math.min(w, h) * 0.12,
      );
    case "wayfarer":
      return roundedPolygon(
        [
          [-w / 2, -h / 2],
          [w / 2, -h / 2],
          [(w / 2) * 1.04, (h / 2) * 0.92],
          [(w / 2) * 1.04, h / 2],
          [(-w / 2) * 1.04, h / 2],
          [(-w / 2) * 1.04, (h / 2) * 0.92],
        ],
        Math.min(w, h) * 0.16,
      );
    case "aviator":
      return roundedPolygon(
        [
          [(-w / 2) * 0.86, h / 2],
          [(w / 2) * 0.86, h / 2],
          [w / 2, (h / 2) * 0.35],
          [(w / 2) * 0.6, (-h / 2) * 0.82],
          [0, -h / 2],
          [(-w / 2) * 0.6, (-h / 2) * 0.82],
          [-w / 2, (h / 2) * 0.35],
        ],
        Math.min(w, h) * 0.2,
      );
    case "cateye": {
      // build in "outer = +x" space, mirror for the other lens
      const outer = side;
      const pts: Array<[number, number]> = [
        [(-w / 2) * outer, -h / 2],
        [(w / 2) * outer, -h / 2],
        [(w / 2) * outer, (h / 2) * 0.62],
        [(w / 2) * 1.12 * outer, (h / 2) * 1.06],
        [(-w / 2) * 0.72 * outer, (h / 2) * 0.96],
        [(-w / 2) * outer, (h / 2) * 0.28],
      ];
      return roundedPolygon(pts, Math.min(w, h) * 0.18);
    }
    case "custom":
      // Fallback to rounded rectangle when no detailed custom points are available
      // The detailed geometry from Gemini will be used in a future enhancement
      return roundedPolygon(
        [
          [-w / 2, -h / 2],
          [w / 2, -h / 2],
          [w / 2, h / 2],
          [-w / 2, h / 2],
        ],
        Math.min(w, h) * 0.22,
      );
    case "rectangular":
    default:
      return roundedPolygon(
        [
          [-w / 2, -h / 2],
          [w / 2, -h / 2],
          [w / 2, h / 2],
          [-w / 2, h / 2],
        ],
        Math.min(w, h) * 0.22,
      );
  }
}

export function generateGlasses(params: GlassesParameters): THREE.Group {
  const group = new THREE.Group();
  group.name = "Glasses3D";

  const t = params.frameThickness;
  const lw = params.lensWidth;
  const lh = params.lensHeight;
  const bw = params.bridgeWidth;
  const L = params.templeLength;
  const halfSpan = (lw + bw) / 2; // bridge centre -> lens centre (mm)

  const frameMat = frameMaterial(params.frameColor);
  const lensMat = lensMaterial(params);
  const hwMat = hardwareMaterial();
  const padMat = padMaterial();

  const frameGeo: THREE.BufferGeometry[] = [];
  const lensGeo: THREE.BufferGeometry[] = [];

  for (const side of [1, -1] as const) {
    const label = side > 0 ? "Right" : "Left";
    const x = side * halfSpan;

    // rim: outer outline with a lens-shaped hole
    const inner = lensOutline(params.frameShape, lw, lh, side);
    const outer = lensOutline(params.frameShape, lw + 2 * t, lh + 2 * t, side);
    outer.holes.push(new THREE.Path(inner.getPoints(40)));

    const rimGeo = new THREE.ExtrudeGeometry(outer, {
      depth: t * 1.2,
      bevelEnabled: true,
      bevelThickness: t * 0.16,
      bevelSize: t * 0.16,
      bevelSegments: 2,
      curveSegments: 20,
    });
    rimGeo.center();
    const rim = new THREE.Mesh(rimGeo, frameMat);
    rim.name = `${label}Frame`;
    rim.position.x = x;
    group.add(rim);
    frameGeo.push(rimGeo);

    // lens
    const lGeo = new THREE.ExtrudeGeometry(inner, {
      depth: 1.2,
      bevelEnabled: false,
      curveSegments: 24,
    });
    lGeo.center();
    const lens = new THREE.Mesh(lGeo, lensMat);
    lens.name = `${label}Lens`;
    lens.position.x = x;
    group.add(lens);
    lensGeo.push(lGeo);

    // hinge hardware at the outer edge of the rim
    const rimOuterX = halfSpan + lw / 2 + t;
    const hinge = new THREE.Group();
    hinge.name = `${label}Hinge`;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(2.6, t * 1.5, 5), hwMat);
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, t * 1.7, 12), hwMat);
    screw.rotation.z = Math.PI / 2;
    hinge.add(plate, screw);
    hinge.position.set(side * rimOuterX, lh * 0.16, -t * 0.7);
    group.add(hinge);

    // temple: from the hinge back to the ear, bowing out to frameWidth mid-way
    const halfFrame = Math.max(params.frameWidth / 2, rimOuterX);
    const yH = lh * 0.16;
    const templeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * rimOuterX, yH, -t),
      new THREE.Vector3(side * halfFrame, yH + 1, -L * 0.28),
      new THREE.Vector3(side * (halfFrame - 1), yH - L * 0.03, -L * 0.58),
      new THREE.Vector3(side * (rimOuterX - 1), yH - L * 0.12, -L * 0.82),
      new THREE.Vector3(side * (rimOuterX - 2), yH - L * 0.22, -L * 0.98),
    ]);
    const templeGeo = new THREE.TubeGeometry(templeCurve, 36, t * 0.5, 8, false);
    const temple = new THREE.Mesh(templeGeo, frameMat);
    temple.name = `${label}Temple`;
    group.add(temple);
    frameGeo.push(templeGeo);
  }

  // bridge: curved tube across the nose
  const yB = lh * 0.32;
  const bridgeCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-(bw / 2 + t * 0.8), yB, 0),
    new THREE.Vector3(0, yB + bw * 0.35, 0),
    new THREE.Vector3(bw / 2 + t * 0.8, yB, 0),
  );
  const bridgeGeo = new THREE.TubeGeometry(bridgeCurve, 16, t * 0.68, 8, false);
  const bridge = new THREE.Mesh(bridgeGeo, frameMat);
  bridge.name = "Bridge";
  group.add(bridge);
  frameGeo.push(bridgeGeo);

  // nose bridge detail: translucent pads behind the lenses
  const nose = new THREE.Group();
  nose.name = "NoseBridge";
  for (const side of [1, -1] as const) {
    const padGeo = new THREE.SphereGeometry(2.4, 12, 10);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.scale.set(1, 1.7, 0.7);
    pad.position.set(side * (bw / 2 + 1.4), -lh * 0.3, -t * 1.6);
    pad.rotation.z = side * -0.35;
    nose.add(pad);
  }
  group.add(nose);

  group.userData["frameGeometries"] = frameGeo;
  group.userData["lensGeometries"] = lensGeo;
  return group;
}
