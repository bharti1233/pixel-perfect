/**
 * Maps raw, video-normalized landmarks into the try-on world coordinate system
 * (viewport-centered px, +Y up, +Z toward camera) and composes TrackingData.
 * Pure functions — no rendering or engine state in here.
 */
import { buildHeadFrame, headRotation, type Vec3 } from "@/lib/vision/headPose";
import type { BodyTracking, FaceTracking } from "../types";

export interface Landmark3 {
  x: number;
  y: number;
  z: number;
}

/** object-cover mapping from a video frame to the overlay canvas (same math the video element uses via CSS object-cover). */
export interface CoverMapping {
  cw: number;
  ch: number;
  vw: number;
  vh: number;
  s: number;
  ox: number;
  oy: number;
}

export function coverMapping(vw: number, vh: number, cw: number, ch: number): CoverMapping {
  const s = vw > 0 && vh > 0 ? Math.max(cw / vw, ch / vh) : 1;
  return { cw, ch, vw, vh, s, ox: (cw - vw * s) / 2, oy: (ch - vh * s) / 2 };
}

export function toWorld(m: CoverMapping, p: Landmark3): Vec3 {
  return {
    x: p.x * m.vw * m.s + m.ox - m.cw / 2,
    y: -(p.y * m.vh * m.s + m.oy - m.ch / 2),
    z: -p.z * m.vw * m.s,
  };
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const mid = (a: Vec3, b: Vec3): Vec3 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
});

/** MediaPipe FaceLandmarker indices. */
export const FACE_IDX = {
  eyeA: 33,
  eyeB: 263,
  nose: 1,
  forehead: 10,
  chin: 152,
  cheekA: 234,
  cheekB: 454,
  bridge: 168,
} as const;

export function composeFace(lm: Landmark3[] | undefined, m: CoverMapping): FaceTracking | null {
  if (!lm) return null;
  const eyeA = lm[FACE_IDX.eyeA],
    eyeB = lm[FACE_IDX.eyeB],
    top = lm[FACE_IDX.forehead],
    chin = lm[FACE_IDX.chin],
    nose = lm[FACE_IDX.nose],
    cheekA = lm[FACE_IDX.cheekA],
    cheekB = lm[FACE_IDX.cheekB];
  if (!eyeA || !eyeB || !top || !chin || !nose || !cheekA || !cheekB) return null;

  const wEyeA = toWorld(m, eyeA);
  const wEyeB = toWorld(m, eyeB);
  const wTop = toWorld(m, top);
  const wChin = toWorld(m, chin);

  const frame = buildHeadFrame(wEyeA, wEyeB, wTop, wChin);
  if (!frame) return null;

  const bridge = lm[FACE_IDX.bridge];
  const wBridge = bridge ? toWorld(m, bridge) : undefined;

  return {
    present: true,
    eyeMid: mid(wEyeA, wEyeB),
    eyeDistance: dist(wEyeA, wEyeB),
    faceWidth: dist(toWorld(m, cheekA), toWorld(m, cheekB)),
    headHeight: dist(wTop, wChin),
    topOfHead: wTop,
    noseTip: toWorld(m, nose),
    noseBridge: wBridge,
    rotation: headRotation(frame),
  };
}

/** MediaPipe PoseLandmarker indices. */
export const POSE_IDX = {
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
  lHip: 23,
  rHip: 24,
} as const;

const at = (lm: Landmark3[] | undefined, i: number, m: CoverMapping): Vec3 | null => {
  const p = lm?.[i];
  return p ? toWorld(m, p) : null;
};

export function composeBody(lm: Landmark3[] | undefined, m: CoverMapping): BodyTracking | null {
  const lSh = at(lm, POSE_IDX.lShoulder, m);
  const rSh = at(lm, POSE_IDX.rShoulder, m);
  if (!lSh || !rSh) return null;
  const lHip = at(lm, POSE_IDX.lHip, m);
  const rHip = at(lm, POSE_IDX.rHip, m);
  const hipMid = lHip && rHip ? mid(lHip, rHip) : null;
  const shoulderMid = mid(lSh, rSh);
  const torsoLength = hipMid ? dist(shoulderMid, hipMid) : 0;
  return {
    present: true,
    leftShoulder: lSh,
    rightShoulder: rSh,
    shoulderMid,
    shoulderWidth: dist(lSh, rSh),
    shoulderAngle: Math.atan2(rSh.y - lSh.y, rSh.x - lSh.x),
    leftElbow: at(lm, POSE_IDX.lElbow, m),
    rightElbow: at(lm, POSE_IDX.rElbow, m),
    leftWrist: at(lm, POSE_IDX.lWrist, m),
    rightWrist: at(lm, POSE_IDX.rWrist, m),
    leftHip: lHip,
    rightHip: rHip,
    hipMid,
    torsoLength,
  };
}
