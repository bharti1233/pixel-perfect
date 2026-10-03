/**
 * LightingManager: neutral studio-ish lighting so parametric materials read
 * correctly over a live camera feed. Uses a PMREM room environment for lens
 * reflections when available, with plain lights as a guaranteed fallback.
 */
import * as THREE from "three";

export interface LightingHandle {
  dispose(): void;
}

export function applyLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer): LightingHandle {
  const lights: THREE.Light[] = [];

  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9aa4b2, 0.5);
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-0.4, 0.8, 1);
  const fill = new THREE.DirectionalLight(0xfff2e6, 0.6);
  fill.position.set(0.7, -0.3, 0.6);
  lights.push(ambient, hemi, key, fill);
  lights.forEach((l) => scene.add(l));

  let env: THREE.Texture | null = null;
  let pmrem: THREE.PMREMGenerator | null = null;
  void (async () => {
    try {
      const { RoomEnvironment } =
        await import("three/examples/jsm/environments/RoomEnvironment.js");
      pmrem = new THREE.PMREMGenerator(renderer);
      env = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;
      scene.environment = env;
    } catch {
      // lights alone are fine — reflections are a bonus
    }
  })();

  return {
    dispose() {
      lights.forEach((l) => scene.remove(l));
      env?.dispose();
      pmrem?.dispose();
      scene.environment = null;
    },
  };
}
