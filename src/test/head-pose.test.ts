import { describe, expect, it } from "vitest";

import {
  buildHeadFrame,
  headRotation,
  quaternionFromFrame,
  rotateVec,
  type Vec3,
} from "@/lib/vision/headPose";
import {
  composeFace,
  composeBody,
  coverMapping,
  toWorld,
} from "@/features/virtual-try-on/tracking/compose";
import { fitGlasses } from "@/features/virtual-try-on/fitting3d/FaceFitter";
import { fitHat } from "@/features/virtual-try-on/fitting3d/HeadFitter";
import { fitUpperBody } from "@/features/virtual-try-on/fitting3d/BodyFitter";
import { DEFAULT_GLASSES, DEFAULT_HAT } from "@/types/things";
import type { FaceTracking } from "@/features/virtual-try-on/types";

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe("head frame + pose (real landmark math)", () => {
  const frontal: [Vec3, Vec3, Vec3, Vec3] = [
    { x: -60, y: 0, z: 0 },
    { x: 60, y: 0, z: 0 },
    { x: 0, y: 90, z: 0 },
    { x: 0, y: -90, z: 0 },
  ];

  it("builds an orthonormal frame at rest", () => {
    const f = buildHeadFrame(...frontal)!;
    expect(f).not.toBeNull();
    expect(near(f.right.x, 1)).toBe(true);
    expect(near(f.up.y, 1)).toBe(true);
    expect(near(f.forward.z, 1)).toBe(true);
    // right-handed: cross(right, up) === forward
    expect(near(f.right.y * f.up.z - f.right.z * f.up.y, f.forward.x)).toBe(true);
  });

  it("produces a near-identity quaternion and zero Euler angles at rest", () => {
    const r = headRotation(buildHeadFrame(...frontal)!);
    expect(near(r.quaternion.x, 0)).toBe(true);
    expect(near(r.quaternion.w, 1)).toBe(true);
    expect(Math.abs(r.yaw)).toBeLessThan(1e-6);
    expect(Math.abs(r.pitch)).toBeLessThan(1e-6);
    expect(Math.abs(r.roll)).toBeLessThan(1e-6);
  });

  it("yaws when one eye moves toward the camera", () => {
    // image-right eye closer to camera -> nose points image-left -> negative yaw
    const rotated: [Vec3, Vec3, Vec3, Vec3] = [
      { x: -60, y: 0, z: -30 },
      { x: 60, y: 0, z: 30 },
      frontal[2],
      frontal[3],
    ];
    const r = headRotation(buildHeadFrame(...rotated)!);
    expect(r.yaw).toBeLessThan(-0.1);
  });

  it("rolls with the eye line", () => {
    // Roll requires the forehead-chin line to tilt
    const tilted: [Vec3, Vec3, Vec3, Vec3] = [
      { x: -60, y: 0, z: 0 },
      { x: 60, y: 30, z: 0 },
      { x: 15, y: 90, z: 0 }, // forehead tilted
      { x: -15, y: -90, z: 0 }, // chin tilted opposite
    ];
    const r = headRotation(buildHeadFrame(...tilted)!);
    expect(Math.abs(r.roll)).toBeGreaterThan(0.05);
  });

  it("pitches when the face normal points up", () => {
    const f = buildHeadFrame(
      frontal[0],
      frontal[1],
      { x: 0, y: 100, z: 40 },
      { x: 0, y: -80, z: -40 },
    )!;
    const r = headRotation(f);
    // Pitch should be non-zero (sign depends on coordinate convention)
    expect(Math.abs(r.pitch)).toBeGreaterThan(0.05);
  });

  it("quaternion round-trips the basis vectors", () => {
    const f = buildHeadFrame(
      { x: -50, y: 5, z: -20 },
      { x: 55, y: -5, z: 25 },
      { x: 4, y: 95, z: 10 },
      {
        x: -2,
        y: -85,
        z: -5,
      },
    )!;
    const q = quaternionFromFrame(f);
    const fwd = rotateVec(q, { x: 0, y: 0, z: 1 });
    expect(near(fwd.x, f.forward.x, 1e-5)).toBe(true);
    expect(near(fwd.y, f.forward.y, 1e-5)).toBe(true);
    expect(near(fwd.z, f.forward.z, 1e-5)).toBe(true);
  });

  it("rotateVec keeps vectors under identity rotation", () => {
    const v = rotateVec({ x: 0, y: 0, z: 0, w: 1 }, { x: 3, y: -4, z: 5 });
    expect(v).toEqual({ x: 3, y: -4, z: 5 });
  });
});

describe("coordinate mapping", () => {
  it("maps object-cover video coords into viewport-centered world px", () => {
    // 640x480 video into 640x640 canvas -> scale by height, crop sides
    const m = coverMapping(640, 480, 640, 640);
    expect(m.s).toBeCloseTo(640 / 480, 5);
    // centre of video -> centre of world (allow -0)
    const center = toWorld(m, { x: 0.5, y: 0.5, z: 0 });
    expect(Math.abs(center.x)).toBeLessThan(1e-10);
    expect(Math.abs(center.y)).toBeLessThan(1e-10);
    expect(Math.abs(center.z)).toBeLessThan(1e-10);
    // upper half of the image maps to positive world Y (y-up)
    const above = toWorld(m, { x: 0.5, y: 0.25, z: 0 });
    expect(above.y).toBeGreaterThan(0);
    // smaller landmark z = closer to camera -> positive world Z
    const near = toWorld(m, { x: 0.5, y: 0.5, z: -0.1 });
    expect(near.z).toBeGreaterThan(0);
  });

  it("composes face tracking from normalized landmarks", () => {
    const m = coverMapping(640, 480, 640, 480);
    const lm: Array<{ x: number; y: number; z: number }> = new Array(478).fill({
      x: 0.5,
      y: 0.5,
      z: 0,
    });
    lm[33] = { x: 0.45, y: 0.5, z: 0 }; // eye image-left
    lm[263] = { x: 0.55, y: 0.5, z: 0 }; // eye image-right
    lm[10] = { x: 0.5, y: 0.4, z: 0 }; // forehead
    lm[152] = { x: 0.5, y: 0.6, z: 0 }; // chin
    lm[1] = { x: 0.5, y: 0.53, z: -0.02 }; // nose
    lm[234] = { x: 0.42, y: 0.5, z: 0 };
    lm[454] = { x: 0.58, y: 0.5, z: 0 };

    const face = composeFace(lm, m)!;
    expect(face).not.toBeNull();
    expect(near(face.eyeMid.x, 0)).toBe(true);
    expect(near(face.eyeDistance, 0.1 * 640)).toBe(true); // 10% of 640px width
    expect(face.headHeight).toBeCloseTo(0.2 * 480, 5);
    expect(Math.abs(face.rotation.yaw)).toBeLessThan(1e-6);
  });

  it("returns null without the required landmarks", () => {
    const m = coverMapping(640, 480, 640, 480);
    expect(composeFace([], m)).toBeNull();
    expect(composeBody([], m)).toBeNull();
  });
});

describe("3D fitting (mm parametric -> world px)", () => {
  const face: FaceTracking = {
    present: true,
    eyeMid: { x: 10, y: 20, z: 0 },
    eyeDistance: 140, // px
    faceWidth: 290,
    headHeight: 360,
    topOfHead: { x: 0, y: 180, z: 0 },
    noseTip: { x: 0, y: 5, z: -30 },
    rotation: { quaternion: { x: 0, y: 0, z: 0, w: 1 }, pitch: 0, yaw: 0, roll: 0 },
  };

  it("scales glasses so lens centres land on the pupils", () => {
    const params = { ...DEFAULT_GLASSES }; // lens 52 + bridge 18 = 70mm anchor
    const t = fitGlasses(face, params);
    expect(t.scale).toBeCloseTo(140 / 70, 5);
    // 12mm standoff in front of the eye plane
    expect(t.position.z).toBeCloseTo((12 * 140) / 70, 5);
    expect(t.position.x).toBeCloseTo(10, 5);
    expect(t.position.y).toBeCloseTo(20, 5);
  });

  it("scales hats from anatomical face width and anchors below the crown", () => {
    const t = fitHat(face);
    expect(t.scale).toBeCloseTo(290 / 145, 5);
    const drop = 0.3 * face.headHeight;
    expect(t.position.y).toBeCloseTo(face.topOfHead.y - drop, 5);
  });

  it("prepares an upper-body transform from shoulder width", () => {
    const t = fitUpperBody({
      present: true,
      leftShoulder: { x: -190, y: 0, z: 0 },
      rightShoulder: { x: 190, y: 0, z: 0 },
      shoulderMid: { x: 0, y: 0, z: 0 },
      shoulderWidth: 380,
      shoulderAngle: 0,
      leftElbow: null,
      rightElbow: null,
      leftWrist: null,
      rightWrist: null,
      leftHip: { x: -100, y: -400, z: 0 },
      rightHip: { x: 100, y: -400, z: 0 },
      hipMid: { x: 0, y: -400, z: 0 },
      torsoLength: 400,
    });
    expect(t.scale).toBeCloseTo(1, 5);
    expect(t.position.y).toBeGreaterThan(0); // collar above the shoulder line
  });

  it("grows glasses with eye distance (closer face => bigger scale)", () => {
    const params = { ...DEFAULT_HAT };
    void params;
    const t1 = fitGlasses(face, { ...DEFAULT_GLASSES });
    const closer: FaceTracking = { ...face, eyeDistance: 210 };
    const t2 = fitGlasses(closer, { ...DEFAULT_GLASSES });
    expect(t2.scale).toBeGreaterThan(t1.scale);
  });
});
