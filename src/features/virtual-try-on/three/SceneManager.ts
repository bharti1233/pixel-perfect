/**
 * SceneManager: transparent Three.js scene rendered over the live camera video.
 *
 * World units = CSS pixels of the viewport:
 *   origin at viewport center, +X right, +Y up, +Z toward the camera.
 *   The camera sits at z = CAM_Z and the projection is derived so that an
 *   object at z = 0 spans exactly its pixel size — tracking math (px) and
 *   scene math (world units) therefore coincide with no conversion layer.
 */
import * as THREE from "three";

const CAM_Z = 900;

export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  private width = 1;
  private height = 1;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.canvas = this.renderer.domElement;
    this.canvas.style.position = "absolute";
    this.canvas.style.inset = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "none";
    container.appendChild(this.canvas);

    this.camera = new THREE.PerspectiveCamera(45, 1, 10, CAM_Z * 5);
    this.camera.position.set(0, 0, CAM_Z);
    this.camera.lookAt(0, 0, 0);

    this.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight,
    );
  }

  setSize(w: number, h: number): void {
    if (w <= 0 || h <= 0 || (w === this.width && h === this.height)) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    // world px == screen px at z = 0
    this.camera.aspect = w / h;
    this.camera.fov = 2 * Math.atan(h / 2 / CAM_Z) * (180 / Math.PI);
    this.camera.updateProjectionMatrix();
  }

  add(obj: THREE.Object3D): void {
    this.scene.add(obj);
  }

  remove(obj: THREE.Object3D): void {
    this.scene.remove(obj);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
    this.canvas.remove();
  }
}
