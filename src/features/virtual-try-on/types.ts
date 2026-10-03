/**
 * Tracking types for the virtual try-on engine.
 *
 * Coordinate system (all units = CSS pixels of the try-on viewport):
 *
 *              +Y (up)
 *               ^
 *               |   ● head
 *               |
 *   -X <────────+────────> +X (right)
 *               |
 *               v
 *              -Y
 *
 *   Origin = center of the viewport, +Z points out of the screen toward the camera.
 *   Depth comes from MediaPipe landmark z (converted: smaller raw z = closer to camera).
 */
import type { HeadRotation, Vec3 } from "@/lib/vision/headPose";

export type { Vec3 } from "@/lib/vision/headPose";

export interface FaceTracking {
  present: boolean;
  /** midpoint between the pupils — primary glasses anchor */
  eyeMid: Vec3;
  /** eye distance in px — primary scale signal */
  eyeDistance: number;
  /** cheek-to-cheek width in px — hat/head scale signal */
  faceWidth: number;
  /** forehead-top -> chin distance in px */
  headHeight: number;
  /** top of the head (landmark 10) — hat anchor */
  topOfHead: Vec3;
  noseTip: Vec3;
  /** smoothed head rotation (quaternion + debug Euler) */
  rotation: HeadRotation;
}

export interface BodyTracking {
  present: boolean;
  leftShoulder: Vec3;
  rightShoulder: Vec3;
  shoulderMid: Vec3;
  shoulderWidth: number;
  /** radians, positive = image-right shoulder lower than image-left */
  shoulderAngle: number;
  leftElbow: Vec3 | null;
  rightElbow: Vec3 | null;
  leftWrist: Vec3 | null;
  rightWrist: Vec3 | null;
  leftHip: Vec3 | null;
  rightHip: Vec3 | null;
  hipMid: Vec3 | null;
  torsoLength: number;
}

export interface TrackingData {
  timestampMs: number;
  width: number;
  height: number;
  face: FaceTracking | null;
  body: BodyTracking | null;
  /** number of faces seen this frame */
  faceCount: number;
}

/** Real, measurable session quality signals (never synthetic "confidence"). */
export interface QualitySignals {
  /** average frame luminance 0..1, sampled periodically */
  light: number;
  /** recent eye-midpoint jitter in px (lower = steadier) */
  jitter: number;
  fps: number;
}

export type FitRegion = "face" | "head" | "upper-body";
