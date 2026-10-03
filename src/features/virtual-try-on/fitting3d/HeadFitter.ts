/**
 * Head fitter: hats scale with face width (anatomical mm estimate) and anchor
 * slightly below the top of the head, following head rotation.
 */
import { rotateVec } from "@/lib/vision/headPose";
import type { FaceTracking } from "../types";
import type { ItemTransform } from "./ItemTransform";

const ANATOMIC_FACE_WIDTH_MM = 145;
/** where the hat opening sits, as a fraction of top->chin head height below the crown */
const OPENING_FRACTION = 0.3;

export function fitHat(face: FaceTracking): ItemTransform {
  const scale = face.faceWidth / ANATOMIC_FACE_WIDTH_MM;
  const up = rotateVec(face.rotation.quaternion, { x: 0, y: 1, z: 0 });
  const drop = OPENING_FRACTION * face.headHeight;
  return {
    position: {
      x: face.topOfHead.x - up.x * drop,
      y: face.topOfHead.y - up.y * drop,
      z: face.topOfHead.z - up.z * drop,
    },
    rotation: face.rotation.quaternion,
    scale,
  };
}
