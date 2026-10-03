import { createFileRoute, Link } from "@tanstack/react-router";
import { Glasses, Crown, Shirt, ArrowRight, Plus } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Style Mirror — Try on your own clothes, live" },
      {
        name: "description",
        content:
          "Add your own glasses, hats and tops, then see them on you in real time through your camera.",
      },
      { property: "og:title", content: "Style Mirror — Live virtual try-on" },
      { property: "og:description", content: "Your wardrobe, on you, live through the camera." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 pb-28 pt-10">
      <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Style Mirror</p>
      <h1 className="mt-3 text-5xl font-extrabold leading-[0.95]">
        Your wardrobe,
        <br />
        <span className="text-primary">on you.</span>
        <br />
        Live.
      </h1>
      <p className="mt-4 text-muted-foreground">
        Snap your own pieces, then watch them follow you through the camera. Everything stays on
        your device.
      </p>

      <div className="mt-8 grid gap-3">
        <Link
          to="/things"
          className="flex items-center justify-between rounded-2xl bg-primary p-5 text-primary-foreground glow"
        >
          <span className="flex items-center gap-3 font-semibold">
            <Plus className="h-5 w-5" /> Add a thing
          </span>
          <ArrowRight className="h-5 w-5" />
        </Link>
        <Link to="/try-on" className="flex items-center justify-between rounded-2xl bg-card p-5">
          <span className="font-semibold">Open the mirror</span>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      </div>

      <h2 className="mt-10 text-lg font-bold">What works today</h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {[
          { icon: Glasses, label: "Glasses", note: "3D face fit" },
          { icon: Crown, label: "Hats", note: "3D head fit" },
          { icon: Shirt, label: "Tops", note: "Body tracked" },
        ].map(({ icon: Icon, label, note }) => (
          <div key={label} className="rounded-2xl bg-card p-4">
            <Icon className="h-6 w-6 text-accent" />
            <p className="mt-3 text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground">{note}</p>
          </div>
        ))}
      </div>
      <BottomNav />
    </main>
  );
}
