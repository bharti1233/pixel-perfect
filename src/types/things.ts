export type ThingCategory = "glasses" | "hats" | "tops";

/**
 * Parametric representation of a pair of glasses, in millimetres.
 * Produced by AI item analysis (approximate estimates, not physical measurements)
 * and consumed by Glasses3DGenerator to build real Three.js geometry.
 */
export interface GlassesParameters {
  frameShape: "rectangular" | "round" | "square" | "oval" | "aviator" | "cateye" | "wayfarer";
  /** total frame width, temples included, mm */
  frameWidth: number;
  lensWidth: number;
  lensHeight: number;
  bridgeWidth: number;
  templeLength: number;
  frameThickness: number;
  frameColor: string;
  lensColor: string;
  /** 0 = invisible, 1 = opaque */
  lensOpacity: number;
  lensType: "clear" | "tinted" | "mirror" | "none";
}

/** Parametric hat, in millimetres. Origin = center of the opening (where it meets the head). */
export interface HatParameters {
  type: "cap" | "beanie" | "fedora" | "bucket" | "visor" | "other";
  /** side-to-side crown width */
  width: number;
  /** crown height above the opening */
  height: number;
  /** front-to-back crown depth */
  depth: number;
  /** forward projection of the brim, mm (0 = no brim) */
  brimWidth?: number;
  /** side-to-side brim width, mm */
  brimDepth?: number;
  color: string;
}

/** Tops stay a 2D garment overlay for the MVP; params are stored for the future VTON path. */
export interface TopParameters {
  garmentType: string;
  color: string;
  sleeves: "none" | "short" | "long" | null;
  fit: "regular" | "slim" | "oversized";
}

export type ModelParameters = GlassesParameters | HatParameters | TopParameters;

export function isGlassesParameters(p?: ModelParameters | null): p is GlassesParameters {
  return !!p && "frameWidth" in p;
}
export function isHatParameters(p?: ModelParameters | null): p is HatParameters {
  return !!p && "width" in p && "depth" in p;
}
export function isTopParameters(p?: ModelParameters | null): p is TopParameters {
  return !!p && "garmentType" in p;
}

/** Reasonable adult-average fallbacks used when AI analysis failed or was skipped. */
export const DEFAULT_GLASSES: GlassesParameters = {
  frameShape: "rectangular",
  frameWidth: 142,
  lensWidth: 52,
  lensHeight: 42,
  bridgeWidth: 18,
  templeLength: 140,
  frameThickness: 4,
  frameColor: "#222222",
  lensColor: "#8899aa",
  lensOpacity: 0.18,
  lensType: "clear",
};

export const DEFAULT_HAT: HatParameters = {
  type: "cap",
  width: 185,
  height: 120,
  depth: 215,
  brimWidth: 70,
  brimDepth: 175,
  color: "#2f3b52",
};

export const DEFAULT_TOP: TopParameters = {
  garmentType: "tshirt",
  color: "#445566",
  sleeves: "short",
  fit: "regular",
};

export interface GarmentAnalysis {
  category: ThingCategory;
  subcategory: string;
  orientation: string;
  dominantColor: string;
  /** hex form of the dominant colour, used by 3D materials */
  colorHex: string;
  fitRegion: string;
  sleeves: string | null;
  name: string;
  confidence: number;
  /** structured parametric estimates for 3D generation */
  parameters: ModelParameters;
}

export interface MyThing {
  id: string;
  name: string;
  category: ThingCategory;
  subcategory?: string | undefined;
  /** Processed, background-removed, trimmed PNG used for preview/list */
  imageUrl: string;
  /** Original photo (resized) */
  originalUrl?: string | undefined;
  analysis?: GarmentAnalysis | undefined;
  /** Convenience copy of analysis.parameters — the 3D generator input */
  modelParameters?: ModelParameters | undefined;
  createdAt: number;
}

export const CATEGORY_LABEL: Record<ThingCategory, string> = {
  glasses: "Glasses",
  hats: "Hats",
  tops: "Tops",
};
