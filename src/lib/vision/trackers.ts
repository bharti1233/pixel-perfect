/** Local, low-latency face + pose tracking (MediaPipe Tasks, runs in-browser). Browser-only: import dynamically. */
import type { FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";

export interface Point {
  x: number;
  y: number;
}

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let fileset: Promise<unknown> | null = null;
let face: Promise<FaceLandmarker> | null = null;
let pose: Promise<PoseLandmarker> | null = null;

async function vision() {
  const mp = await import("@mediapipe/tasks-vision");
  fileset ??= mp.FilesetResolver.forVisionTasks(WASM);
  return {
    mp,
    fs: (await fileset) as Awaited<ReturnType<typeof mp.FilesetResolver.forVisionTasks>>,
  };
}

export function getFaceTracker() {
  face ??= vision().then(({ mp, fs }) =>
    mp.FaceLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 2, // >1 lets the UI ask for a single person in frame
    }),
  );
  return face;
}

export function getPoseTracker() {
  pose ??= vision().then(({ mp, fs }) =>
    mp.PoseLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
    }),
  );
  return pose;
}
