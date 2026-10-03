import type { Quaternion } from "@/lib/vision/headPose";

export interface ItemTransform {
  position: { x: number; y: number; z: number };
  rotation: Quaternion;
  /** world px per model mm */
  scale: number;
}
