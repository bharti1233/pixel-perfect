import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Box, Loader2, Plus, SwitchCamera, TriangleAlert } from "lucide-react";
import { z } from "zod";
import { listThings } from "@/lib/storage/things";
import { CATEGORY_LABEL, type MyThing, type ThingCategory } from "@/types/things";
import {
  TryOnEngine,
  type DebugInfo,
  type EnginePhase,
} from "@/features/virtual-try-on/TryOnEngine";

export const Route = createFileRoute("/try-on")({
  validateSearch: z.object({ id: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Try On — Style Mirror" },
      {
        name: "description",
        content: "See your own glasses, hats and tops on you live through the camera.",
      },
      { property: "og:title", content: "Live Try On — Style Mirror" },
      { property: "og:description", content: "Real-time virtual try-on of your own items." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TryOn,
});

const CATS: ThingCategory[] = ["glasses", "hats", "tops"];

const PHASE_COPY: Record<EnginePhase, string> = {
  starting: "Starting camera…",
  live: "",
  denied: "Camera access is required for Try On.",
  error: "We couldn't start the try-on view on this device.",
  noface: "We can't detect your face. Move into the camera frame.",
  multiple: "Please make sure only one person is visible.",
  dark: "Move into better lighting for more accurate tracking.",
};

function TryOn() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<TryOnEngine | null>(null);

  const [things, setThings] = useState<MyThing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(id ?? null);
  const [flatId, setFlatId] = useState<string | null>(null);
  const [tab, setTab] = useState<ThingCategory>("glasses");
  const [phase, setPhase] = useState<EnginePhase>("starting");
  const [tracking, setTracking] = useState(false);
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [modelError, setModelError] = useState<{ message: string; thing: MyThing } | null>(null);

  // ---- engine lifecycle (camera + tracking + render loop)
  useEffect(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    const stage = stageRef.current;
    if (!video || !overlay || !stage) return;
    const engine = new TryOnEngine({
      video,
      overlay,
      stage,
      onPhase: setPhase,
      onTracking: setTracking,
      onDebug: setDebug,
      onModelError: (message, thing) => {
        setModelError({ message, thing });
        setFlatId(thing.id); // fall back to the working flat overlay for now
      },
    });
    engineRef.current = engine;
    void engine.start();
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // ---- wardrobe
  useEffect(() => {
    listThings().then((all) => {
      setThings(all);
      const initial = all.find((t) => t.id === id) ?? all[0] ?? null;
      if (initial) {
        setSelectedId(initial.id);
        setTab(initial.category);
      } else {
        setSelectedId(null);
      }
    });
  }, [id]);

  const selected = useMemo(
    () => things.find((t) => t.id === selectedId) ?? null,
    [things, selectedId],
  );

  // ---- item switching never restarts the camera
  useEffect(() => {
    engineRef.current?.setThing(selected, !!selected && flatId === selected.id);
  }, [selected, flatId]);

  // ---- camera facing switch (skip the initial mount: start() already uses "user")
  const facingInit = useRef(true);
  useEffect(() => {
    if (facingInit.current) {
      facingInit.current = false;
      return;
    }
    void engineRef.current?.setFacing(facing);
  }, [facing]);

  const shown = things.filter((t) => t.category === tab);
  const statusText =
    phase === "live"
      ? selected
        ? tracking
          ? "● Tracking"
          : "Looking for you…"
        : "Select an item"
      : PHASE_COPY[phase] || " ";

  const mirror = facing === "user" ? "-scale-x-100" : "";
  const devDebug = import.meta.env.DEV;

  return (
    <div className="fixed inset-0 bg-background">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover ${mirror}`}
      />
      <canvas
        ref={overlayRef}
        className={`pointer-events-none absolute inset-0 h-full w-full ${mirror}`}
      />
      {/* Three.js stage: transparent WebGL canvas injected here */}
      <div
        ref={stageRef}
        className={`pointer-events-none absolute inset-0 ${mirror}`}
        aria-hidden
      />

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={() => navigate({ to: "/things" })}
          className="rounded-full p-3 glass-bar"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span
          className={`rounded-full px-3 py-1.5 text-xs glass-bar ${tracking && phase === "live" ? "text-accent" : ""}`}
        >
          {statusText}
        </span>
        <button
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          className="rounded-full p-3 glass-bar"
          aria-label="Switch camera"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
      </div>

      <p className="absolute inset-x-0 top-16 z-10 px-8 text-center text-[11px] text-muted-foreground">
        Camera stays on this screen — nothing is recorded or uploaded.
      </p>

      {/* loading */}
      {phase === "starting" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* permission / hardware errors */}
      {(phase === "denied" || phase === "error") && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-8 text-center">
          <div>
            <h2 className="text-2xl font-bold">
              {phase === "denied" ? "Camera access needed" : "Camera unavailable"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {phase === "denied"
                ? "Camera access is required for Try On. Please allow camera access in your browser settings, then reload."
                : PHASE_COPY.error}
            </p>
          </div>
        </div>
      )}

      {/* tracking hints */}
      {(phase === "noface" || phase === "multiple" || phase === "dark") && (
        <div className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-8 text-center">
          <p className="mx-auto max-w-xs rounded-2xl bg-scrim px-4 py-3 text-sm backdrop-blur">
            {PHASE_COPY[phase]}
          </p>
        </div>
      )}

      {/* 3D generation failure (spec error state) with flat fallback */}
      {modelError && (
        <div className="absolute inset-x-0 top-24 z-30 mx-auto max-w-md px-4">
          <div className="flex items-start gap-3 rounded-2xl bg-card p-4 ring-1 ring-destructive/50">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="text-sm">{modelError.message}</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setFlatId(null)}
                  className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold"
                >
                  Retry 3D
                </button>
                <button
                  onClick={() => setModelError(null)}
                  className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* dev-only debug */}
      {devDebug && debug && (
        <div className="absolute left-4 top-28 z-20 rounded-xl bg-scrim px-3 py-2 font-mono text-[10px] leading-4 text-accent backdrop-blur">
          <div>FPS: {debug.fps}</div>
          <div>Faces: {debug.faces}</div>
          <div>Light: {debug.light.toFixed(2)}</div>
          <div>Jitter: {debug.jitter.toFixed(1)}px</div>
          <div>Eye dist: {debug.eyeDistance}px</div>
          <div>
            Yaw: {debug.yawDeg.toFixed(1)}° Pitch: {debug.pitchDeg.toFixed(1)}° Roll:{" "}
            {debug.rollDeg.toFixed(1)}°
          </div>
          <div>Item: {debug.item}</div>
        </div>
      )}

      {/* bottom: category tabs + item strip */}
      <div className="absolute inset-x-0 bottom-0 z-20 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-2 flex gap-2">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
                tab === c ? "bg-primary text-primary-foreground" : "glass-bar text-muted-foreground"
              }`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        {things.length === 0 ? (
          <Link
            to="/things"
            className="block rounded-2xl bg-primary p-4 text-center font-semibold text-primary-foreground"
          >
            Add something to try on
          </Link>
        ) : (
          <div className="flex gap-3 overflow-x-auto rounded-3xl p-3 glass-bar">
            {shown.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-card p-2 ring-2 ${
                  selected?.id === t.id ? "ring-primary" : "ring-transparent"
                }`}
                aria-label={t.name}
              >
                <img src={t.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
              </button>
            ))}
            <Link
              to="/things"
              className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-secondary text-muted-foreground"
              aria-label="Add item"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[10px]">Add</span>
            </Link>
          </div>
        )}
        {selected && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Box className="h-3.5 w-3.5" />{" "}
            {flatId === selected.id
              ? `${selected.name} — flat preview`
              : selected.category === "tops"
                ? `${selected.name} — body fit`
                : `${selected.name} — 3D`}
          </p>
        )}
      </div>
    </div>
  );
}
