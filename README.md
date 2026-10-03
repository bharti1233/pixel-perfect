# Style Mirror

3D AI Fashion Virtual Try-On Web MVP

## Overview

Style Mirror is a web-first AI fashion virtual try-on application. Users can add their own clothing and accessories to a personal wardrobe called "My Things", then use their device camera to see those items virtually fitted onto their face/body in real time.

The key difference from a simple AR overlay: **fashion items are represented as 3D/parametric objects and fitted to a tracked 3D face/body coordinate system**.

### Current Implementation Priority

1. **Glasses** - 3D parametric models fitted to tracked face
2. **Hats** - 3D parametric models fitted to tracked head
3. **Upper-body clothing** - Body tracked (2D overlay for MVP)

## Architecture

```
Browser
  ↓
Style Mirror frontend (React + TanStack Start)
  ↓
Gemini API (item analysis only, once per item)
  ↓
Local browser storage (IndexedDB for wardrobe, localStorage for settings)
  ↓
Three.js (3D rendering)
  ↓
Local face/body tracking (MediaPipe)
```

### Key Principles

- **No backend database** - All data stays on the device (IndexedDB + localStorage)
- **No authentication** - Works immediately without accounts
- **Gemini API called once per item** - Never during live camera tracking
- **Local face/body tracking** - MediaPipe runs entirely in-browser
- **3D parametric models** - Generated from AI analysis, not flat image overlays

## Technology Stack

- **TypeScript** + **React 19** + **TanStack Start** (SSR)
- **Tailwind CSS 4** + **Radix UI** (components)
- **Three.js** (3D rendering)
- **MediaPipe Tasks Vision** (face/pose tracking)
- **Google Gemini API** (item analysis)
- **IndexedDB** via `idb-keyval` (wardrobe storage)
- **Vitest** (testing)

## Getting Started

### Prerequisites

- Node.js 18+ (recommend nvm)
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Installation

```sh
git clone <repository-url>
cd style-mirror
npm install
npm run dev
```

### Gemini API Key Setup

1. Open the app in your browser
2. Go to **My Things** → **Settings** (gear icon)
3. Enter your Gemini API key
4. Click **Test Connection** to verify
5. Click **Save**

> ⚠️ **Security Note**: API keys are stored locally in this browser's localStorage. This is suitable for a personal/local MVP only. Do not use a sensitive production API key on a publicly accessible deployment. For production, use a server-side proxy.

## Development

```sh
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
npm run format   # Format with Prettier
npm run test     # Run tests
npm run test:watch  # Watch mode tests
```

## Project Structure

```
src/
├── components/          # UI components (Radix-based)
├── features/
│   └── virtual-try-on/  # Core try-on engine
│       ├── three/       # Three.js scene, camera, lighting
│       ├── models/      # Parametric 3D generators (glasses, hats)
│       ├── fitting3d/   # 3D fitting math (face/head/body)
│       ├── tracking/    # Coordinate mapping from landmarks
│       └── TryOnEngine  # Main orchestrator
├── hooks/               # React hooks
├── lib/
│   ├── ai/gemini.ts     # Gemini API client
│   ├── storage/         # IndexedDB (things) + localStorage (settings)
│   └── vision/          # MediaPipe trackers + head pose math
├── routes/              # TanStack Router routes
│   ├── index.tsx        # Home
│   ├── things.tsx       # My Things (wardrobe + settings)
│   └── try-on.tsx       # Live try-on camera
├── test/                # Unit tests
└── types/               # TypeScript types
```

## Privacy

- Camera is only active while the Try On experience is open
- No video is recorded or uploaded
- No camera frames are saved
- No biometric information is stored
- No facial profiles are created
- Face tracking runs locally via MediaPipe (never sent to servers)

## Error States

The app handles these scenarios gracefully:

- **Camera permission denied** - Clear instructions to enable in browser settings
- **No face detected** - "Move into the camera frame"
- **Multiple faces** - "Please make sure only one person is visible"
- **Low light** - "Move into better lighting for more accurate tracking"
- **Item analysis failure** - "Try a clearer image with the full item visible"
- **3D generation failure** - Falls back to 2D overlay with notice
- **No Gemini API key** - Prompts to add key in Settings

## Testing

Unit tests cover:

- Head pose estimation math (quaternion, Euler angles)
- Coordinate mapping (video → world space)
- 3D fitting math (scale, position, rotation)
- Parametric 3D generators (glasses, hats)

```sh
npm run test
```

## Production Build

```sh
npm run build
```

The output will be in the `dist` directory (or `.output` for TanStack Start).

## License

MIT
