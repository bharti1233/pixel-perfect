/**
 * TryOnEngine — orchestrates the whole live pipeline:
 *
 *   camera video → local MediaPipe tracking → TrackingData (3D coords)
 *       ├─ face/head items → VirtualItem3D.updateTracking → Three.js render
 *       └─ tops / flat fallback → 2D canvas overlay (fitting.ts)
 *
 * Gemini/AI is NEVER in this loop — it runs once per item at upload time.
 * The camera stream stays local: nothing is recorded or uploaded.
 */
import { loadImage } from "@/lib/vision/image";
import type { MyThing } from "@/types/things";
import { fitFace, fitTop, smooth, type Placement } from "./fitting";
import { composeBody, composeFace, coverMapping, type Landmark3 } from "./tracking/compose";
import { createVirtualItem, type VirtualItem3D } from "./models/VirtualItem3D";
import { SceneManager } from "./three/SceneManager";
import { applyLighting, type LightingHandle } from "./three/LightingManager";
import { smoothRotation } from "@/lib/vision/headPose";
import type { FaceTracking, TrackingData } from "./types";

export type EnginePhase = "starting" | "live" | "denied" | "error" | "noface" | "multiple" | "dark";

export interface DebugInfo {
  fps: number;
  faces: number;
  light: number;
  jitter: number;
  eyeDistance: number;
  faceWidth: number;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  item: string;
}

export interface TryOnEngineOptions {
  video: HTMLVideoElement;
  /** 2D canvas: used for tops and for the flat-overlay fallback */
  overlay: HTMLCanvasElement;
  /** container for the transparent Three.js canvas */
  stage: HTMLElement;
  onPhase(phase: EnginePhase): void;
  onTracking(active: boolean): void;
  onDebug(info: DebugInfo): void;
  /** spec: "We couldn't create a 3D representation of this item." */
  onModelError(message: string, thing: MyThing): void;
}

const FACE_TO_LIVE_FRAMES = 2;
const FACE_LOST_FRAMES = 12;
const DEBUG_INTERVAL_MS = 250;
const LIGHT_INTERVAL_MS = 1000;
const DARK_THRESHOLD = 0.14;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class TryOnEngine {
  private opts: TryOnEngineOptions;
  private stream: MediaStream | null = null;
  private facing: "user" | "environment" = "user";

  private scene: SceneManager | null = null;
  private lighting: LightingHandle | null = null;

  private faceTracker: Awaited<
    ReturnType<typeof import("@/lib/vision/trackers").getFaceTracker>
  > | null = null;
  private poseTracker: Awaited<
    ReturnType<typeof import("@/lib/vision/trackers").getPoseTracker>
  > | null = null;
  private posePromise: Promise<unknown> | null = null;

  private itemCache = new Map<string, VirtualItem3D>();
  private activeThing: MyThing | null = null;
  private activeItem: VirtualItem3D | null = null;
  private flatMode = false;
  private overlayImage: HTMLImageElement | null = null;
  private prevPlacement: Placement | null = null;

  private running = false;
  private raf = 0;
  private startSeq = 0;
  private lastTs = 0;
  private lastDebug = 0;
  private lastLight = 0;
  private faceSeen = 0;
  private faceLost = 0;
  private phase: EnginePhase = "starting";
  private trackingActive = false;

  private prevFace: FaceTracking | null = null;
  private fps = 0;
  private light = 1;
  private jitter = 0;

  private lightCanvas: HTMLCanvasElement | null = null;

  constructor(opts: TryOnEngineOptions) {
    this.opts = opts;
  }

  // ---------------------------------------------------------------- camera

  async start(facing: "user" | "environment" = this.facing): Promise<void> {
    const seq = ++this.startSeq;
    this.facing = facing;
    this.setPhase("starting");
    if (!navigator.mediaDevices?.getUserMedia) {
      this.setPhase("error");
      return;
    }
    this.stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (seq !== this.startSeq) {
        // a newer start() superseded this one — don't leak the stream
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      const v = this.opts.video;
      v.srcObject = stream;
      await v.play();
    } catch (e) {
      if (seq !== this.startSeq) return;
      this.setPhase(e instanceof DOMException && e.name === "NotAllowedError" ? "denied" : "error");
      return;
    }
    if (seq !== this.startSeq) return;
    this.initScene();
    await this.ensureTrackers();
    if (seq !== this.startSeq) return;
    if (this.phase === "starting") this.setPhase("live");
    if (!this.running) {
      this.running = true;
      this.lastTs = 0;
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  async setFacing(facing: "user" | "environment"): Promise<void> {
    await this.start(facing);
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private initScene(): void {
    if (this.scene) return;
    try {
      this.scene = new SceneManager(this.opts.stage);
      this.lighting = applyLighting(this.scene.scene, this.scene.renderer);
      // items may have been selected before the scene existed
      for (const item of this.itemCache.values()) this.scene.add(item.object);
    } catch {
      this.scene = null;
      this.setPhase("error");
    }
  }

  private async ensureTrackers(): Promise<void> {
    if (this.faceTracker) return;
    try {
      const { getFaceTracker } = await import("@/lib/vision/trackers");
      this.faceTracker = await getFaceTracker();
    } catch {
      this.opts.onPhase("error");
      this.phase = "error";
    }
  }

  private async ensurePoseTracker(): Promise<void> {
    if (this.poseTracker || this.posePromise) return;
    this.posePromise = import("@/lib/vision/trackers")
      .then(({ getPoseTracker }) => getPoseTracker())
      .then((t) => {
        this.poseTracker = t;
      })
      .catch(() => {
        this.posePromise = null;
      });
    await this.posePromise;
  }

  // ---------------------------------------------------------------- items

  /**
   * Select (or clear) the try-on item without restarting the camera.
   * `flat` forces the 2D overlay path (used as the 3D-generation fallback).
   */
  setThing(thing: MyThing | null, flat = false): void {
    const changed = this.activeThing?.id !== thing?.id;
    this.activeThing = thing;
    this.flatMode = flat;
    if (changed) {
      this.prevPlacement = null;
      this.overlayImage = null;
      if (this.activeItem) this.activeItem.object.visible = false;
      this.activeItem = null;
    }
    if (!thing) return;

    const wants3D = !flat && thing.category !== "tops";
    if (wants3D) {
      let item = this.itemCache.get(thing.id);
      if (!item) {
        try {
          item = createVirtualItem(thing);
        } catch {
          this.opts.onModelError(
            "We couldn't create a 3D representation of this item. Try another image.",
            thing,
          );
          return;
        }
        this.itemCache.set(thing.id, item);
        this.scene?.add(item.object);
      }
      this.activeItem = item;
      this.activeItem.object.visible = false;
      return;
    }

    // 2D overlay path (tops or flat fallback): preload the cut-out image
    this.activeItem = null;
    void loadImage(thing.imageUrl).then((img) => {
      if (this.activeThing?.id === thing.id) this.overlayImage = img;
    });
    if (thing.category === "tops") void this.ensurePoseTracker();
  }

  // ---------------------------------------------------------------- loop

  private setPhase(p: EnginePhase): void {
    if (this.phase === p) return;
    this.phase = p;
    this.opts.onPhase(p);
  }

  private loop = (): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const v = this.opts.video;
    if (v.readyState < 2 || !v.videoWidth) return;

    const now = performance.now();
    if (now <= this.lastTs) return;
    const dt = Math.min(now - this.lastTs, 250);
    this.lastTs = now;
    this.fps = this.fps ? lerp(this.fps, 1000 / Math.max(dt, 1), 0.08) : 60;

    const stage = this.opts.stage;
    const cw = stage.clientWidth || window.innerWidth;
    const ch = stage.clientHeight || window.innerHeight;
    this.scene?.setSize(cw, ch);

    if (!this.faceTracker) return;
    const tracker = this.faceTracker;

    let faceLm: Landmark3[] | undefined;
    let faceCount = 0;
    try {
      const res = tracker.detectForVideo(v, now);
      faceCount = res.faceLandmarks.length;
      faceLm = res.faceLandmarks[0];
    } catch {
      return;
    }

    const m = coverMapping(v.videoWidth, v.videoHeight, cw, ch);
    let face = composeFace(faceLm, m);
    if (face) {
      face = {
        ...face,
        eyeMid: this.prevFace
          ? {
              x: lerp(this.prevFace.eyeMid.x, face.eyeMid.x, 0.5),
              y: lerp(this.prevFace.eyeMid.y, face.eyeMid.y, 0.5),
              z: lerp(this.prevFace.eyeMid.z, face.eyeMid.z, 0.5),
            }
          : face.eyeMid,
        eyeDistance: this.prevFace
          ? lerp(this.prevFace.eyeDistance, face.eyeDistance, 0.45)
          : face.eyeDistance,
        faceWidth: this.prevFace
          ? lerp(this.prevFace.faceWidth, face.faceWidth, 0.45)
          : face.faceWidth,
        headHeight: this.prevFace
          ? lerp(this.prevFace.headHeight, face.headHeight, 0.45)
          : face.headHeight,
        topOfHead: this.prevFace
          ? {
              x: lerp(this.prevFace.topOfHead.x, face.topOfHead.x, 0.5),
              y: lerp(this.prevFace.topOfHead.y, face.topOfHead.y, 0.5),
              z: lerp(this.prevFace.topOfHead.z, face.topOfHead.z, 0.5),
            }
          : face.topOfHead,
        rotation: smoothRotation(this.prevFace?.rotation ?? null, face.rotation, 0.5),
      };
      if (this.prevFace) {
        const moved = Math.hypot(
          face.eyeMid.x - this.prevFace.eyeMid.x,
          face.eyeMid.y - this.prevFace.eyeMid.y,
        );
        this.jitter = lerp(this.jitter, moved, 0.1);
      }
      this.prevFace = face;
    } else {
      this.prevFace = null;
    }

    const needsBody = this.activeThing?.category === "tops";
    let bodyLm: Landmark3[] | undefined;
    if (needsBody && this.poseTracker) {
      try {
        bodyLm = this.poseTracker.detectForVideo(v, now).landmarks[0];
      } catch {
        bodyLm = undefined;
      }
    }
    const body = composeBody(bodyLm, m);

    const data: TrackingData = {
      timestampMs: now,
      width: cw,
      height: ch,
      face,
      body,
      faceCount,
    };

    // ---- phase / quality (real signals only)
    if (faceCount === 0) {
      this.faceLost++;
      this.faceSeen = 0;
      if (this.faceLost >= FACE_LOST_FRAMES) this.setPhase("noface");
    } else if (faceCount > 1) {
      this.faceSeen++;
      this.faceLost = 0;
      this.setPhase("multiple");
    } else {
      this.faceSeen++;
      this.faceLost = 0;
      if (this.faceSeen >= FACE_TO_LIVE_FRAMES && this.phase !== "dark") this.setPhase("live");
    }
    if (now - this.lastLight > LIGHT_INTERVAL_MS) {
      this.lastLight = now;
      this.sampleLight(v);
      if (face && this.light < DARK_THRESHOLD && this.phase === "live") this.setPhase("dark");
      else if (this.phase === "dark" && this.light >= DARK_THRESHOLD) this.setPhase("live");
    }

    if (!!face !== this.trackingActive) {
      this.trackingActive = !!face;
      this.opts.onTracking(this.trackingActive);
    }

    // ---- 3D rendering
    if (this.scene) {
      if (this.activeItem) this.activeItem.updateTracking(data);
      this.scene.render();
    }

    // ---- 2D overlay path (tops / flat fallback)
    this.render2D(faceLm, bodyLm, m);

    // ---- debug
    if (now - this.lastDebug > DEBUG_INTERVAL_MS) {
      this.lastDebug = now;
      this.opts.onDebug({
        fps: Math.round(this.fps),
        faces: faceCount,
        light: this.light,
        jitter: this.jitter,
        eyeDistance: Math.round(face?.eyeDistance ?? 0),
        faceWidth: Math.round(face?.faceWidth ?? 0),
        yawDeg: face ? (face.rotation.yaw * 180) / Math.PI : 0,
        pitchDeg: face ? (face.rotation.pitch * 180) / Math.PI : 0,
        rollDeg: face ? (face.rotation.roll * 180) / Math.PI : 0,
        item: this.activeThing ? `${this.flatMode ? "(flat) " : ""}${this.activeThing.name}` : "—",
      });
    }
  };

  private render2D(
    faceLm: Landmark3[] | undefined,
    bodyLm: Landmark3[] | undefined,
    m: { cw: number; ch: number; vw: number; vh: number; s: number; ox: number; oy: number },
  ): void {
    const c = this.opts.overlay;
    const thing = this.activeThing;
    const img = this.overlayImage;
    const use2D = thing && img && (this.flatMode || thing.category === "tops");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = c.clientWidth,
      cssH = c.clientHeight;
    if (cssW > 0 && (c.width !== Math.round(cssW * dpr) || c.height !== Math.round(cssH * dpr))) {
      c.width = Math.round(cssW * dpr);
      c.height = Math.round(cssH * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    if (!use2D || !thing || !img) return;

    const mapPx = (p: Landmark3) => ({ x: p.x * m.vw * m.s + m.ox, y: p.y * m.vh * m.s + m.oy });
    const aspect = img.width / img.height;
    let place: Placement | null = null;
    if (thing.category === "tops" && bodyLm) {
      place = fitTop(bodyLm.map(mapPx), aspect);
    } else if (thing.category !== "tops" && faceLm) {
      place = fitFace(thing.category, faceLm.map(mapPx), aspect);
    }
    if (!place) {
      this.prevPlacement = null;
      return;
    }
    const p = (this.prevPlacement = smooth(this.prevPlacement, place));
    ctx.save();
    ctx.translate(p.cx, p.cy);
    ctx.rotate(p.angle);
    ctx.scale(p.yawScale, 1);
    ctx.drawImage(img, -p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }

  private sampleLight(v: HTMLVideoElement): void {
    try {
      if (!this.lightCanvas) {
        this.lightCanvas = document.createElement("canvas");
        this.lightCanvas.width = 24;
        this.lightCanvas.height = 24;
      }
      const ctx = this.lightCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, 24, 24);
      const d = ctx.getImageData(0, 0, 24, 24).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4)
        sum += 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
      this.light = sum / (d.length / 4) / 255;
    } catch {
      /* sampling is best-effort */
    }
  }

  // ---------------------------------------------------------------- lifecycle

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stopStream();
    this.opts.video.srcObject = null;
    this.setPhase("starting");
  }

  dispose(): void {
    this.stop();
    for (const item of this.itemCache.values()) {
      this.scene?.remove(item.object);
      item.dispose();
    }
    this.itemCache.clear();
    this.lighting?.dispose();
    this.scene?.dispose();
    this.scene = null;
    this.lighting = null;
    this.faceTracker = null;
    this.poseTracker = null;
  }
}
