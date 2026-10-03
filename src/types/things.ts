export type ThingCategory = "glasses" | "hats" | "tops";

/**
 * Parametric representation of a pair of glasses, in millimetres.
 * Produced by AI item analysis (approximate estimates, not physical measurements)
 * and consumed by Glasses3DGenerator to build real Three.js geometry.
 *
 * Backward compatibility: legacy items with only the old fields will use
 * the legacy generator; new items with frameShape = "custom" and detailed
 * geometry will use the custom generator.
 */
export interface GlassesParameters {
  frameShape:
    "rectangular" | "round" | "square" | "oval" | "aviator" | "cateye" | "wayfarer" | "custom";
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

  // Detailed geometry for custom shapes
  frame?:
    | {
        overall_width: number;
        overall_height: number;
        front_depth: number;
        left_lens_width: number;
        right_lens_width: number;
        left_lens_height: number;
        right_lens_height: number;
        lens_corner_radius: number;
        bridge_width: number;
        bridge_height: number;
        frame_thickness: number;
        rim_thickness: number;
        lens_gap: number;
      }
    | undefined;
  nose?:
    | {
        nose_pad_present: boolean | null;
        nose_pad_position: "front" | "mid" | "back" | null;
        nose_pad_size: number | null;
        bridge_nose_clearance: number | null;
      }
    | undefined;
  temples?:
    | {
        left_temple_length: number;
        right_temple_length: number;
        temple_thickness: number;
        temple_width: number;
        temple_curve: "straight" | "light_curve" | "heavy_curve" | null;
        hinge_position: "outer_upper" | "outer_center" | "outer_lower" | null;
        hinge_size: number | null;
        temple_angle: number | null;
      }
    | undefined;
  "3d"?:
    | {
        front_face_curvature: number | null;
        lens_curvature: number | null;
        frame_depth: number | null;
        temple_depth: number | null;
        head_wrap_angle: number | null;
      }
    | undefined;
  appearance?:
    | {
        frame_color: string;
        frame_material_appearance: "matte" | "glossy" | "metallic" | "tortoise" | null;
        lens_tint: string;
        lens_transparency: number;
        surface_finish: "matte" | "glossy" | "textured" | null;
      }
    | undefined;
  confidence?:
    | {
        geometry_confidence: number;
        measurement_confidence: number;
      }
    | undefined;
  perspective?:
    | {
        estimated_camera_yaw: number | null;
        estimated_camera_pitch: number | null;
        estimated_camera_roll: number | null;
        perspective_confidence: number | null;
      }
    | undefined;
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
