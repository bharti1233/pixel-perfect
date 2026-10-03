/** Fitting engine: turns tracking landmarks (screen px) into an item placement. */
import type { Point } from "@/lib/vision/trackers";
import type { ThingCategory } from "@/types/things";

export interface Placement {
  cx: number; // anchor center x
  cy: number; // anchor center y
  w: number;
  h: number;
  angle: number;
  yawScale: number; // horizontal squash for head turn
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Face landmarks index map (MediaPipe 468 mesh). */
export function fitFace(cat: ThingCategory, lm: Point[], aspect: number): Placement | null {
  const eyeL = lm[33],
    eyeR = lm[263],
    bridge = lm[168],
    top = lm[10],
    cheekL = lm[234],
    cheekR = lm[454],
    nose = lm[1];
  if (!eyeL || !eyeR || !bridge || !top || !cheekL || !cheekR || !nose) return null;
  const angle = Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x);
  const faceW = dist(cheekL, cheekR);
  // yaw: nose offset relative to cheeks
  const c = mid(cheekL, cheekR);
  const yaw = Math.max(
    -1,
    Math.min(
      1,
      ((nose.x - c.x) * Math.cos(angle) + (nose.y - c.y) * Math.sin(angle)) / (faceW / 2),
    ),
  );
  const yawScale = 1 - Math.abs(yaw) * 0.35;

  if (cat === "glasses") {
    const w = dist(eyeL, eyeR) * 1.75;
    return { cx: bridge.x, cy: bridge.y + w * 0.04, w, h: w / aspect, angle, yawScale };
  }
  if (cat === "hats") {
    const w = faceW * 1.45;
    const h = w / aspect;
    // hat brim sits slightly below forehead top; move along "up" vector
    const up = { x: Math.sin(angle), y: -Math.cos(angle) };
    const brimOffset = -faceW * 0.12; // push down into forehead
    const k = h / 2 + brimOffset;
    return { cx: top.x + up.x * k, cy: top.y + up.y * k, w, h, angle, yawScale };
  }
  return null;
}

/** Pose landmarks (MediaPipe 33): 11/12 shoulders, 23/24 hips. */
export function fitTop(lm: Point[], aspect: number): Placement | null {
  const sL = lm[11],
    sR = lm[12],
    hL = lm[23],
    hR = lm[24];
  if (!sL || !sR) return null;
  const sw = dist(sL, sR);
  const angle = Math.atan2(sL.y - sR.y, sL.x - sR.x);
  const w = sw * 1.75;
  const shoulders = mid(sL, sR);
  let h = w / aspect;
  if (hL && hR) {
    const torso = dist(shoulders, mid(hL, hR));
    h = Math.max(h * 0.7, Math.min(h * 1.3, torso * 1.35));
  }
  const up = { x: Math.sin(angle), y: -Math.cos(angle) };
  const collar = { x: shoulders.x + up.x * sw * 0.28, y: shoulders.y + up.y * sw * 0.28 };
  return { cx: collar.x - up.x * (h / 2), cy: collar.y - up.y * (h / 2), w, h, angle, yawScale: 1 };
}

/** Exponential smoothing to stabilise jitter. */
export function smooth(prev: Placement | null, next: Placement, a = 0.45): Placement {
  if (!prev) return next;
  const l = (p: number, n: number) => p + (n - p) * a;
  let da = next.angle - prev.angle;
  if (da > Math.PI) da -= 2 * Math.PI;
  if (da < -Math.PI) da += 2 * Math.PI;
  return {
    cx: l(prev.cx, next.cx),
    cy: l(prev.cy, next.cy),
    w: l(prev.w, next.w),
    h: l(prev.h, next.h),
    angle: prev.angle + da * a,
    yawScale: l(prev.yawScale, next.yawScale),
  };
}
