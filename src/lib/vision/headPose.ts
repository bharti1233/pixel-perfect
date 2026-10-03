/**
 * Head pose estimation from MediaPipe face landmarks (real 3D landmark data,
 * no hardcoded coordinates). Runs fully in-browser.
 *
 * World convention (matches src/features/virtual-try-on/types.ts):
 *   +X right, +Y up, +Z toward the camera, units = CSS pixels.
 *   Landmarks must already be mapped into world space (see tracking/compose.ts),
 *   because raw MediaPipe normalization is anisotropic (x/width, y/height).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** Euler angles in radians. Approximate/debug-oriented; rendering uses the quaternion. */
export interface HeadRotation {
  quaternion: Quaternion;
  /** positive = looking up */
  pitch: number;
  /** positive = nose turning toward image-right */
  yaw: number;
  /** positive = image-right eye higher than image-left */
  roll: number;
}

export interface HeadFrame {
  /** person's image-right direction (from eye-left corner to eye-right corner) */
  right: Vec3;
  /** head up direction (chin -> forehead top) */
  up: Vec3;
  /** face normal, pointing out of the face (toward the camera when facing it) */
  forward: Vec3;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: Vec3): Vec3 | null => {
  const l = Math.hypot(a.x, a.y, a.z);
  if (!Number.isFinite(l) || l < 1e-6) return null;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

/**
 * Builds an orthonormal head frame from four world-space landmarks:
 * outer eye-left corner, outer eye-right corner, forehead top, chin.
 */
export function buildHeadFrame(eyeA: Vec3, eyeB: Vec3, top: Vec3, chin: Vec3): HeadFrame | null {
  const right = norm(sub(eyeB, eyeA));
  const up = norm(sub(top, chin));
  if (!right || !up) return null;
  const forward = norm(cross(right, up));
  if (!forward) return null;
  // re-orthogonalize: right must be perpendicular to both up and forward
  const r2 = norm(cross(up, forward));
  if (!r2) return null;
  return { right: r2, up, forward };
}

/**
 * Quaternion from an orthonormal basis given as columns [right, up, forward]
 * of a rotation matrix (right-handed: cross(right, up) === forward).
 */
export function quaternionFromFrame(f: HeadFrame): Quaternion {
  // column-major: m[col * 3 + row]
  const m00 = f.right.x,
    m01 = f.up.x,
    m02 = f.forward.x;
  const m10 = f.right.y,
    m11 = f.up.y,
    m12 = f.forward.y;
  const m20 = f.right.z,
    m21 = f.up.z,
    m22 = f.forward.z;
  const trace = m00 + m11 + m22;
  let x: number, y: number, z: number, w: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  return { x, y, z, w };
}

/** Full head rotation: quaternion for rendering + Euler angles for debug/UI. */
export function headRotation(f: HeadFrame): HeadRotation {
  const yaw = Math.atan2(f.forward.x, f.forward.z);
  const pitch = Math.asin(Math.max(-1, Math.min(1, f.forward.y)));
  const roll = Math.atan2(f.right.y, f.right.x);
  return { quaternion: quaternionFromFrame(f), pitch, yaw, roll };
}

const lerpV = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

/** Rotates a vector by a quaternion (v' = v + 2w(q×v) + 2(q×(q×v))). */
export function rotateVec(q: Quaternion, v: Vec3): Vec3 {
  const cx = q.y * v.z - q.z * v.y;
  const cy = q.z * v.x - q.x * v.z;
  const cz = q.x * v.y - q.y * v.x;
  const tx = 2 * cx,
    ty = 2 * cy,
    tz = 2 * cz;
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

/** Exponential smoothing for a head rotation (slerp-ish on the quaternion). */
export function smoothRotation(
  prev: HeadRotation | null,
  next: HeadRotation,
  alpha: number,
): HeadRotation {
  if (!prev) return next;
  const a = prev.quaternion;
  const b = next.quaternion;
  // shortest-arc nlerp is plenty for per-frame smoothing
  const sign = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w < 0 ? -1 : 1;
  const q = lerpV(
    { x: a.x, y: a.y, z: a.z },
    { x: b.x * sign, y: b.y * sign, z: b.z * sign },
    alpha,
  );
  const w = a.w + (b.w * sign - a.w) * alpha;
  const len = Math.hypot(q.x, q.y, q.z, w) || 1;
  const l = (p: number, n: number) => p + (n - p) * alpha;
  return {
    quaternion: { x: q.x / len, y: q.y / len, z: q.z / len, w: w / len },
    pitch: l(prev.pitch, next.pitch),
    yaw: l(prev.yaw, next.yaw),
    roll: l(prev.roll, next.roll),
  };
}
