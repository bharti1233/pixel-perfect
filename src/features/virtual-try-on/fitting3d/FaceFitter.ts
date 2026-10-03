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
  return {
    position: {
      x: face.eyeMid.x + forward.x * LENS_STANDOFF_MM * scale,
      y: face.eyeMid.y + forward.y * LENS_STANDOFF_MM * scale,
      z: face.eyeMid.z + forward.z * LENS_STANDOFF_MM * scale,
    },
    rotation: face.rotation.quaternion,
    scale,
  };
}
