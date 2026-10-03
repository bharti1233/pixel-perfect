import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { generateGlasses } from "@/features/virtual-try-on/models/Glasses3DGenerator";
import { generateHat } from "@/features/virtual-try-on/models/Hat3DGenerator";
import { DEFAULT_GLASSES, DEFAULT_HAT, type GlassesParameters } from "@/types/things";

function triangleCount(root: THREE.Object3D): number {
  let tris = 0;
  root.traverse((o) => {
    const geo = (o as THREE.Mesh).geometry;
    if (geo) tris += geo.getAttribute("position")?.count ?? 0;
  });
  return tris;
}

describe("Glasses3DGenerator (parametric -> Three.js)", () => {
  it("builds every component named in the spec", () => {
    const g = generateGlasses({ ...DEFAULT_GLASSES, frameShape: "aviator" });
    const names = g.children.map((c) => c.name);
    for (const part of [
      "LeftFrame",
      "RightFrame",
      "LeftLens",
      "RightLens",
      "Bridge",
      "LeftTemple",
      "RightTemple",
      "NoseBridge",
    ]) {
      expect(names).toContain(part);
    }
    expect(names.filter((n) => n?.endsWith("Hinge"))).toHaveLength(2);
    expect(triangleCount(g)).toBeGreaterThan(1000);
  });

  it("is real geometry sized near the parametric frame width", () => {
    const params: GlassesParameters = {
      ...DEFAULT_GLASSES,
      frameWidth: 140,
      lensWidth: 50,
      bridgeWidth: 18,
      lensHeight: 40,
      frameThickness: 4,
      templeLength: 140,
    };
    const g = generateGlasses(params);
    const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
    // rims + temple bow should land close to the declared frame width
    expect(size.x).toBeGreaterThanOrEqual(120);
    expect(size.x).toBeLessThanOrEqual(150);
    // temples reach back ~templeLength
    expect(size.z).toBeGreaterThan(100);
  });

  it("supports every frame shape without throwing", () => {
    for (const frameShape of [
      "rectangular",
      "round",
      "square",
      "oval",
      "aviator",
      "cateye",
      "wayfarer",
    ] as const) {
      const g = generateGlasses({ ...DEFAULT_GLASSES, frameShape });
      expect(g.children.length).toBeGreaterThan(6);
      expect(triangleCount(g)).toBeGreaterThan(500);
    }
  });
});

describe("Hat3DGenerator (parametric -> Three.js)", () => {
  it("builds a cap with crown, top button and brim", () => {
    const h = generateHat({ ...DEFAULT_HAT, type: "cap" });
    const names = h.children.map((c) => c.name);
    expect(names).toContain("Crown");
    expect(names).toContain("Brim");
    expect(triangleCount(h)).toBeGreaterThan(500);
  });

  it("builds every hat type with real geometry", () => {
    for (const type of ["cap", "beanie", "fedora", "bucket", "visor", "other"] as const) {
      const h = generateHat({ ...DEFAULT_HAT, type });
      expect(h.children.length).toBeGreaterThan(0);
      expect(triangleCount(h)).toBeGreaterThan(200);
    }
  });

  it("omits the brim for beanies", () => {
    const h = generateHat({ ...DEFAULT_HAT, type: "beanie" });
    expect(h.children.map((c) => c.name)).not.toContain("Brim");
  });
});
