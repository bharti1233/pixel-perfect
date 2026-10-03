/** Three.js materials for parametric accessory generation. */
import * as THREE from "three";
import type { GlassesParameters } from "@/types/things";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Frames: slightly glossy plastic / coated metal. */
export function frameMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.38,
    metalness: 0.18,
  });
}

/** Hinges and small hardware. */
export function hardwareMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#c9ced6"),
    roughness: 0.25,
    metalness: 0.9,
  });
}

/**
 * Lenses: transparent physical material. Clear lenses stay very light,
 * tinted/mirror lenses get darker or reflective.
 */
export function lensMaterial(
  params: Pick<GlassesParameters, "lensColor" | "lensOpacity" | "lensType">,
): THREE.MeshPhysicalMaterial {
  const base = clamp(params.lensOpacity, 0, 1);
  const opacity = params.lensType === "clear" ? Math.min(base, 0.35) : Math.max(base, 0.45);
  const mirror = params.lensType === "mirror";
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(params.lensColor || "#99aabb"),
    transparent: true,
    opacity,
    roughness: mirror ? 0.04 : 0.08,
    metalness: mirror ? 0.75 : 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

/** Soft translucent nose pads. */
export function padMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#e8edf2"),
    transparent: true,
    opacity: 0.55,
    roughness: 0.3,
    depthWrite: false,
  });
}

/** Hat fabric / felt / knit. */
export function fabricMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.9,
    metalness: 0,
  });
}
