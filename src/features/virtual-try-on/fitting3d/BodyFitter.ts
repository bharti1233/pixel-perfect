/**
 * Body fitter: upper-body anchor math prepared for the garment/T-shirt path.
 * The current MVP renders tops with the proven 2D overlay (fitting.ts) because
 * a parametric 3D T-shirt would not be photorealistic — but the anchor/transform
 * contract exists so a real garment renderer can plug in without touching tracking.
 */
import { rotateVec } from "@/lib/vision/headPose";
import type { BodyTracking } from "../types";
import type { ItemTransform } from "./ItemTransform";

/** adult shoulder width, biacromial, in mm */
const ANATOMIC_SHOULDER_MM = 380;

export function fitUpperBody(body: BodyTracking): ItemTransform {
  const scale = body.shoulderWidth / ANATOMIC_SHOULDER_MM;
  const roll = -body.shoulderAngle;
  const rotation = { x: 0, y: 0, z: Math.sin(roll / 2), w: Math.cos(roll / 2) };
  // collar sits above the shoulder line, slightly behind the body plane
  const up = rotateVec(rotation, { x: 0, y: 1, z: 0 });
  const collarOffset = 0.18 * body.shoulderWidth;
  return {
    position: {
      x: body.shoulderMid.x + up.x * collarOffset,
      y: body.shoulderMid.y + up.y * collarOffset,
      z: body.shoulderMid.z,
    },
    rotation,
    scale,
  };
}
