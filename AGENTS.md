<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Wardrobe data lives in browser IndexedDB (src/lib/storage); no backend DB or auth — spec forbids them.
- Real-time tracking runs locally with MediaPipe (src/lib/vision); AI is only used once per item for analysis via a server function — never per frame.
- Fitting math is split by engine: 2D overlay (tops + flat fallback) in src/features/virtual-try-on/fitting.ts; 3D mm-parametric fitting in src/features/virtual-try-on/fitting3d/.
- 3D try-on: parametric generators (src/features/virtual-try-on/models/) build Three.js objects in millimetres; TryOnEngine.ts drives camera → tracking (tracking/compose.ts, world px coords) → fitting → transparent WebGL render (three/). Head pose quaternion comes from real landmarks (src/lib/vision/headPose.ts).
- AI analysis returns structured parametric dimensions (GlassesParameters/HatParameters/TopParameters in src/types/things.ts) stored on MyThing.modelParameters.
- Tooling note for this checkout: /mnt/sdcard forbids symlinks and exec bits — install with `npm install --bin-links=false` and invoke CLIs as `node <pkg bin path>` instead of via node_modules/.bin.
