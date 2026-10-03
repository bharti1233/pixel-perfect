import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Camera,
  ImageIcon,
  Trash2,
  Sparkles,
  X,
  Loader2,
  Save,
  Settings,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { listThings, saveThing, deleteThing } from "@/lib/storage/things";
import { cutoutItem, fileToDataUrl, resizeDataUrl } from "@/lib/vision/image";
import { analyzeItem } from "@/lib/ai/gemini";
import {
  CATEGORY_LABEL,
  isGlassesParameters,
  isHatParameters,
  isTopParameters,
  type GarmentAnalysis,
  type MyThing,
  type ThingCategory,
} from "@/types/things";
import { hasGeminiApiKey } from "@/lib/storage/settings";

export const Route = createFileRoute("/things")({
  head: () => ({
    meta: [
      { title: "My Things — Style Mirror" },
      {
        name: "description",
        content: "Your personal wardrobe of glasses, hats and tops, stored on your device.",
      },
      { property: "og:title", content: "My Things — Style Mirror" },
      { property: "og:description", content: "Your personal try-on wardrobe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ThingsPage,
});

const CATS: ThingCategory[] = ["glasses", "hats", "tops"];

/** One-line parametric summary shown under the item name. */
function paramsSummary(t: MyThing): string {
  const p = t.modelParameters;
  if (!p) return t.analysis?.subcategory || "";
  if (isGlassesParameters(p))
    return `${p.frameShape} · ${Math.round(p.frameWidth)}mm frame · ${p.lensType} lenses`;
  if (isHatParameters(p))
    return `${p.type} · ${Math.round(p.width)}mm · ${Math.round(p.height)}mm crown`;
  if (isTopParameters(p)) return `${p.garmentType} · ${p.fit} · ${p.sleeves ?? "—"} sleeve`;
  return "";
}

function ThingsPage() {
  const [things, setThings] = useState<MyThing[]>([]);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<MyThing | null>(null);
  const [filter, setFilter] = useState<ThingCategory | "all">("all");
  const refresh = () => listThings().then(setThings);
  useEffect(() => {
    refresh();
  }, []);

  const shown = filter === "all" ? things : things.filter((t) => t.category === filter);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 pb-32 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">My Things</h1>
        <Link to="/settings" className="rounded-full p-3 glass-bar" aria-label="Settings">
          <Settings className="h-5 w-5" />
        </Link>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto">
        {(["all", ...CATS] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full px-4 py-1.5 text-sm ${filter === c ? "bg-foreground text-background" : "bg-card text-muted-foreground"}`}
          >
            {c === "all" ? "All" : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="mt-16 text-center text-muted-foreground">
          <p>Nothing here yet.</p>
          <p className="text-sm">Tap + to add your first piece.</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {shown.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpen(t)}
              className="overflow-hidden rounded-2xl bg-card text-left"
            >
              <div className="checker flex aspect-square items-center justify-center p-4">
                <img
                  src={t.imageUrl}
                  alt={t.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {CATEGORY_LABEL[t.category]}
                  {t.subcategory ? ` · ${t.subcategory}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setAdding(true)}
        aria-label="Add thing"
        className="fixed bottom-24 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground glow"
      >
        <Plus className="h-8 w-8" />
      </button>

      {adding && (
        <AddSheet
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}
      {open && (
        <DetailSheet
          thing={open}
          onClose={() => setOpen(null)}
          onChanged={async (updated) => {
            await saveThing(updated);
            setOpen(updated);
            refresh();
          }}
          onDeleted={async () => {
            await deleteThing(open.id);
            setOpen(null);
            refresh();
          }}
        />
      )}
      <BottomNav />
    </main>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-scrim" onClick={onClose}>
      <div
        className="mx-auto max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex justify-end">
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DetailSheet({
  thing,
  onClose,
  onChanged,
  onDeleted,
}: {
  thing: MyThing;
  onClose: () => void;
  onChanged: (t: MyThing) => Promise<void> | void;
  onDeleted: () => Promise<void>;
}) {
  const [name, setName] = useState(thing.name);
  const [category, setCategory] = useState<ThingCategory>(thing.category);
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== thing.name || category !== thing.category;

  async function save() {
    setSaving(true);
    await onChanged({
      ...thing,
      name: name.trim() || CATEGORY_LABEL[category],
      category,
      // switching category invalidates parameters built for the old category
      modelParameters: category === thing.category ? thing.modelParameters : undefined,
      analysis: category === thing.category ? thing.analysis : undefined,
    });
    setSaving(false);
  }

  return (
    <Sheet onClose={onClose}>
      <div className="checker flex h-56 items-center justify-center rounded-2xl p-6">
        <img
          src={thing.imageUrl}
          alt={thing.name}
          className="max-h-full max-w-full object-contain"
        />
      </div>
      <h2 className="mt-4 text-2xl font-bold">{thing.name}</h2>
      <p className="text-sm text-muted-foreground">
        {CATEGORY_LABEL[thing.category]}
        {paramsSummary(thing) ? ` · ${paramsSummary(thing)}` : ""}
        {thing.analysis ? ` · confidence ${Math.round(thing.analysis.confidence * 100)}%` : ""}
      </p>

      <div className="mt-4 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name"
          className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:border-primary"
        />
        <div className="grid grid-cols-3 gap-2">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-xl py-2.5 text-sm font-semibold ${category === c ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          to="/try-on"
          search={{ id: thing.id }}
          className="flex-1 rounded-xl bg-primary py-3 text-center font-semibold text-primary-foreground"
        >
          Try it on
        </Link>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-foreground px-4 py-3 font-semibold text-background disabled:opacity-50"
            aria-label="Save changes"
          >
            <Save className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={onDeleted}
          className="rounded-xl bg-secondary px-4 py-3 text-destructive"
          aria-label="Delete"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </Sheet>
  );
}

function AddSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const [cutout, setCutout] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ThingCategory>("glasses");
  const [analysis, setAnalysis] = useState<GarmentAnalysis | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(f?: File) {
    if (!f) return;

    if (!hasGeminiApiKey()) {
      setError("Add your Gemini API key in Settings before analyzing items.");
      return;
    }

    setError(null);
    setBusy("Preparing image…");
    try {
      const resized = await resizeDataUrl(await fileToDataUrl(f));
      setOriginal(resized);
      setCutout(await cutoutItem(resized, removeBg));
      setBusy("Analyzing with AI…");
      try {
        const a = await analyzeItem(await resizeDataUrl(resized, 640));
        setAnalysis(a);
        setCategory(a.category);
        if (a.name) setName((n) => n || a.name);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analysis failed.");
      } finally {
        setBusy(null);
      }
    } catch {
      setBusy(null);
      setError("We couldn't read that image. Try another one.");
    }
  }

  async function toggleBg(v: boolean) {
    setRemoveBg(v);
    if (original) setCutout(await cutoutItem(original, v));
  }

  async function save() {
    if (!cutout) return;
    await saveThing({
      id: crypto.randomUUID(),
      name: name.trim() || CATEGORY_LABEL[category],
      category,
      subcategory: analysis?.subcategory,
      imageUrl: cutout,
      originalUrl: original ?? undefined,
      analysis: analysis ?? undefined,
      modelParameters: analysis?.parameters,
      createdAt: Date.now(),
    });
    onSaved();
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="text-2xl font-bold">Add a thing</h2>
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input
        ref={galRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {!original ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => camRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl bg-secondary p-6"
          >
            <Camera className="h-7 w-7 text-primary" />{" "}
            <span className="text-sm font-semibold">Take photo</span>
          </button>
          <button
            onClick={() => galRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl bg-secondary p-6"
          >
            <ImageIcon className="h-7 w-7 text-primary" />{" "}
            <span className="text-sm font-semibold">From gallery</span>
          </button>
          <p className="col-span-2 text-xs text-muted-foreground">
            Tip: shoot the item flat, from the front, on a plain background.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="checker flex h-56 items-center justify-center rounded-2xl p-4">
            {cutout && (
              <img src={cutout} alt="Preview" className="max-h-full max-w-full object-contain" />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={removeBg}
              onChange={(e) => toggleBg(e.target.checked)}
              className="accent-primary"
            />
            Remove plain background
          </label>
          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {busy}
            </p>
          )}
          {analysis && !busy && (
            <p className="flex items-center gap-2 text-sm text-accent">
              <Sparkles className="h-4 w-4" />
              {analysis.parameters && `3D params ready · `}
              Detected {analysis.subcategory || analysis.category}
              {analysis.dominantColor ? `, ${analysis.dominantColor}` : ""}. Change below if wrong.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:border-primary"
          />
          <div className="grid grid-cols-3 gap-2">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-xl py-2.5 text-sm font-semibold ${category === c ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          <button
            disabled={busy?.startsWith("Preparing") ?? false}
            onClick={save}
            className="w-full rounded-xl bg-foreground py-3 font-semibold text-background disabled:opacity-50"
          >
            Save to My Things
          </button>
        </div>
      )}
    </Sheet>
  );
}
