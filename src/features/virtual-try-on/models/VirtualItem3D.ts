/**
 * Reusable 3D accessory system (Phase 8B).
 *
 *   VirtualItem3D
 *   ├── Glasses3D  (fitRegion "face")   — FaceFitter
 *   ├── Hat3D      (fitRegion "head")   — HeadFitter
 *   └── (future: Earrings3D, Mask3D, Necklace3D — same contract)
 *
 * The engine only ever talks to this interface: tracking goes in,
 * position/rotation/scale come out on the Three.js object.
 */
import * as THREE from "three";
import {
  DEFAULT_GLASSES,
  DEFAULT_HAT,
  isGlassesParameters,
  isHatParameters,
  type GlassesParameters,
  type HatParameters,
  type MyThing,
} from "@/types/things";
import { fitGlasses } from "../fitting3d/FaceFitter";
import { fitHat } from "../fitting3d/HeadFitter";
import type { FitRegion, TrackingData } from "../types";
import { generateGlasses } from "./Glasses3DGenerator";
import { generateHat } from "./Hat3DGenerator";

export interface VirtualItem3D {
  id: string;
  category: MyThing["category"];
  fitRegion: FitRegion;
  object: THREE.Object3D;
  /** continuous per-frame fitting against live tracking */
  updateTracking(data: TrackingData): void;
  dispose(): void;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const m of mats) m.dispose();
  });
}

class Glasses3D implements VirtualItem3D {
  readonly id: string;
  readonly category = "glasses" as const;
  readonly fitRegion = "face" as const;
  readonly object: THREE.Group;
  private params: GlassesParameters;

  constructor(thing: MyThing, params: GlassesParameters) {
    this.id = thing.id;
    this.params = params;
    this.object = generateGlasses(params);
    this.object.name = `Glasses3D:${thing.id}`;
    this.object.visible = false;
  }

  updateTracking(data: TrackingData): void {
    const face = data.face;
    if (!face) {
      this.object.visible = false;
      return;
    }
    const t = fitGlasses(face, this.params);
    this.object.position.set(t.position.x, t.position.y, t.position.z);
    this.object.quaternion.set(t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w);
    this.object.scale.setScalar(t.scale);
    this.object.visible = true;
  }

  dispose(): void {
    disposeObject(this.object);
  }
}

class Hat3D implements VirtualItem3D {
  readonly id: string;
  readonly category = "hats" as const;
  readonly fitRegion = "head" as const;
  readonly object: THREE.Group;

  constructor(thing: MyThing, params: HatParameters) {
    this.id = thing.id;
    this.object = generateHat(params);
    this.object.name = `Hat3D:${thing.id}`;
    this.object.visible = false;
  }

  updateTracking(data: TrackingData): void {
    const face = data.face;
    if (!face) {
      this.object.visible = false;
      return;
    }
    const t = fitHat(face);
    this.object.position.set(t.position.x, t.position.y, t.position.z);
    this.object.quaternion.set(t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w);
    this.object.scale.setScalar(t.scale);
    this.object.visible = true;
  }

  dispose(): void {
    disposeObject(this.object);
  }
}

/** Tops are not a fake 3D mesh: the engine renders them via the proven 2D garment overlay. */
class TopOverlayMarker implements VirtualItem3D {
  readonly id: string;
  readonly category = "tops" as const;
  readonly fitRegion = "upper-body" as const;
  readonly object = new THREE.Group();
  constructor(thing: MyThing) {
    this.id = thing.id;
    this.object.name = `TopOverlay:${thing.id}`;
    this.object.visible = false;
  }
  updateTracking(): void {
    /* 2D path handles rendering */
  }
  dispose(): void {
    this.object.clear();
  }
}

/**
 * Builds the 3D representation for a wardrobe item.
 * Throws if parametric generation fails — the engine surfaces the spec's
 * "3D generation failure" error state (with a flat-overlay fallback).
 */
export function createVirtualItem(thing: MyThing): VirtualItem3D {
  if (thing.category === "glasses") {
    const params = isGlassesParameters(thing.modelParameters)
      ? thing.modelParameters
      : DEFAULT_GLASSES;
    return new Glasses3D(thing, params);
  }
  if (thing.category === "hats") {
    return new Hat3D(
      thing,
      isHatParameters(thing.modelParameters) ? thing.modelParameters : DEFAULT_HAT,
    );
  }
  return new TopOverlayMarker(thing);
}
