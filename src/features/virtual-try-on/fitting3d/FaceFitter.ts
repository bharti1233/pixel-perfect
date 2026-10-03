/**
 * Face fitter: attaches face-region items (glasses) to tracked face geometry.
 * Pure math — takes FaceTracking + parametric item dimensions, returns a
 * world-space transform for the Three.js object.
 */
import { rotateVec, type Quaternion } from "@/lib/vision/headPose";
import type { GlassesParameters } from "@/types/things";
import type { FaceTracking } from "../types";
import type { ItemTransform } from "./ItemTransform";

/** mm the lenses sit in front of the eye plane */
const LENS_STANDOFF_MM = 12;

/**
 * Scale anchor: real glasses' lens centres sit ~eye distance apart on a face.
 * anchor = lens width + bridge width (mm), measured centre-to-centre.
 */
export function fitGlasses(face: FaceTracking, params: GlassesParameters): ItemTransform {
  const anchorMm = Math.max(1, params.lensWidth + params.bridgeWidth);
  const scale = face.eyeDistance / anchorMm;
  const forward = rotateVec(face.rotation.quaternion, { x: 0, y: 0, z: 1 });

  // Use nose bridge as the anchor point if available, otherwise fall back to eye midpoint
  const anchorPoint = face.noseBridge ?? face.eyeMid;

  return {
    position: {
      x: anchorPoint.x + forward.x * LENS_STANDOFF_MM * scale,
      y: anchorPoint.y + forward.y * LENS_STANDOFF_MM * scale,
      z: anchorPoint.z + forward.z * LENS_STANDOFF_MM * scale,
    },
    rotation: face.rotation.quaternion,
    scale,
  };
}
