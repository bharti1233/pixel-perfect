/**
 * Gemini API client for Style Mirror.
 *
 * Directly calls Google's Gemini API - no Lovable gateway.
 * Reads API key and selected model from local settings storage.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiApiKey } from "@/lib/storage/settings";
import { getSelectedModelId } from "@/lib/storage/aiSettings";
import {
  DEFAULT_GLASSES,
  DEFAULT_HAT,
  DEFAULT_TOP,
  type GlassesParameters,
  type HatParameters,
  type ModelParameters,
  type ThingCategory,
  type TopParameters,
} from "@/types/things";

const PROMPT = `You analyze a single photo of a personal fashion item for a virtual try-on app.
Return ONLY a compact JSON object, no prose, no code fences, with keys:
category: one of "glasses" | "hats" | "tops" | "other"
subcategory: short lowercase word (e.g. sunglasses, eyeglasses, cap, beanie, fedora, tshirt, shirt, jacket, hoodie)
orientation: "front" | "side" | "back" | "flat" | "unknown"
dominantColor: simple color name
colorHex: dominant color as lowercase hex, e.g. "#222222"
fitRegion: "face" | "head" | "upper_body" | "other"
sleeves: "none" | "short" | "long" | null (only for tops, else null)
name: a short friendly item name, max 4 words (e.g. "Black Aviators")
confidence: number 0-1

Then add APPROXIMATE parametric estimates in millimetres for 3D model generation.
These are estimates based on typical adult sizes, not measured values. Keys:
When category is "glasses":
  frameShape: one of "rectangular" | "round" | "square" | "oval" | "aviator" | "cateye" | "wayfarer"
  frameWidth: total front width, typically 135-155
  lensWidth: typically 40-62
  lensHeight: typically 30-55
  bridgeWidth: typically 14-24
  templeLength: typically 120-150
  frameThickness: typically 2-8
  frameColor: hex
  lensColor: hex
  lensOpacity: number 0-1 (clear lenses ~0.15, sunglasses ~0.75)
  lensType: "clear" | "tinted" | "mirror" | "none"
When category is "hats":
  hatType: one of "cap" | "beanie" | "fedora" | "bucket" | "visor" | "other"
  hatWidth: side-to-side crown width, typically 170-210
  hatHeight: crown height, typically 90-170
  hatDepth: front-to-back, typically 180-240
  brimWidth: forward brim projection, 0-120 (0 if no brim)
  brimDepth: side-to-side brim width, 0-260 (0 if no brim)
  hatColor: hex
When category is "tops":
  garmentType: e.g. "tshirt", "shirt", "hoodie"
  topColor: hex
  fit: "regular" | "slim" | "oversized"
Omit keys that do not apply.`;

/** Clamp a numeric estimate into a sane range, falling back to `dflt`. */
function num(v: unknown, min: number, max: number, dflt: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

function hex(v: unknown, dflt: string): string {
  const s = String(v ?? "").trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s.toLowerCase() : dflt;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], dflt: T): T {
  return allowed.includes(String(v) as T) ? (String(v) as T) : dflt;
}

function buildParameters(
  category: ThingCategory,
  p: Record<string, unknown>,
): GlassesParameters | HatParameters | TopParameters {
  if (category === "glasses") {
    return {
      frameShape: pick(
        p["frameShape"],
        ["rectangular", "round", "square", "oval", "aviator", "cateye", "wayfarer"] as const,
        DEFAULT_GLASSES.frameShape,
      ),
      frameWidth: num(p["frameWidth"], 120, 180, DEFAULT_GLASSES.frameWidth),
      lensWidth: num(p["lensWidth"], 35, 70, DEFAULT_GLASSES.lensWidth),
      lensHeight: num(p["lensHeight"], 25, 65, DEFAULT_GLASSES.lensHeight),
      bridgeWidth: num(p["bridgeWidth"], 10, 30, DEFAULT_GLASSES.bridgeWidth),
      templeLength: num(p["templeLength"], 100, 170, DEFAULT_GLASSES.templeLength),
      frameThickness: num(p["frameThickness"], 1.5, 12, DEFAULT_GLASSES.frameThickness),
      frameColor: hex(p["frameColor"], DEFAULT_GLASSES.frameColor),
      lensColor: hex(p["lensColor"], DEFAULT_GLASSES.lensColor),
      lensOpacity: num(p["lensOpacity"], 0, 1, DEFAULT_GLASSES.lensOpacity),
      lensType: pick(
        p["lensType"],
        ["clear", "tinted", "mirror", "none"] as const,
        DEFAULT_GLASSES.lensType,
      ),
    };
  }
  if (category === "hats") {
    const noBrim = { brimWidth: 0, brimDepth: 0 };
    const type = pick(
      p["hatType"],
      ["cap", "beanie", "fedora", "bucket", "visor", "other"] as const,
      DEFAULT_HAT.type,
    );
    const brimWidth = num(p["brimWidth"], 0, 140, DEFAULT_HAT.brimWidth ?? 70);
    const brimDepth = num(p["brimDepth"], 0, 300, DEFAULT_HAT.brimDepth ?? 175);
    return {
      type,
      width: num(p["hatWidth"], 150, 240, DEFAULT_HAT.width),
      height: num(p["hatHeight"], 70, 200, DEFAULT_HAT.height),
      depth: num(p["hatDepth"], 150, 280, DEFAULT_HAT.depth),
      ...(type === "beanie" || type === "visor" ? noBrim : { brimWidth, brimDepth }),
      color: hex(p["hatColor"], DEFAULT_HAT.color),
    };
  }
  return {
    garmentType: String(p["garmentType"] ?? DEFAULT_TOP.garmentType) || DEFAULT_TOP.garmentType,
    color: hex(p["topColor"], DEFAULT_TOP.color),
    sleeves: pick(p["sleeves"], ["none", "short", "long"] as const, DEFAULT_TOP.sleeves ?? "short"),
    fit: pick(p["fit"], ["regular", "slim", "oversized"] as const, DEFAULT_TOP.fit),
  };
}

export interface ItemAnalysisResult {
  category: ThingCategory;
  subcategory: string;
  orientation: string;
  dominantColor: string;
  colorHex: string;
  fitRegion: string;
  sleeves: string | null;
  name: string;
  confidence: number;
  parameters: ModelParameters;
}

/**
 * Analyze a fashion item image using Gemini API.
 * Called once per item upload - NEVER during live tracking.
 */
export async function analyzeItem(imageDataUrl: string): Promise<ItemAnalysisResult> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Add your key in Settings.");
  }

  const modelId = await getSelectedModelId();

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });

  // Convert data URL to base64 for Gemini
  const base64Data = imageDataUrl.split(",")[1];
  if (!base64Data) {
    throw new Error("Invalid image data");
  }

  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64Data,
    },
  };

  const result = await model.generateContent([PROMPT, imagePart]);
  const text = result.response.text();

  if (!text) {
    throw new Error("No response from Gemini API");
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Couldn't parse Gemini response. Try another image.");
  }

  const parsed = JSON.parse(match[0]!) as Record<string, unknown>;
  const category: ThingCategory = ["glasses", "hats", "tops"].includes(String(parsed["category"]))
    ? (parsed["category"] as ThingCategory)
    : "tops";

  const parameters = buildParameters(category, parsed);
  const colorHex =
    category === "glasses"
      ? (parameters as GlassesParameters).frameColor
      : category === "hats"
        ? (parameters as HatParameters).color
        : (parameters as TopParameters).color;

  return {
    category,
    subcategory: String(parsed["subcategory"] ?? ""),
    orientation: String(parsed["orientation"] ?? "unknown"),
    dominantColor: String(parsed["dominantColor"] ?? ""),
    colorHex,
    fitRegion: String(parsed["fitRegion"] ?? ""),
    sleeves: parsed["sleeves"] ? String(parsed["sleeves"]) : null,
    name: String(parsed["name"] ?? ""),
    confidence: Number(parsed["confidence"] ?? 0),
    parameters,
  };
}

/**
 * Test the Gemini API key by making a minimal request.
 */
export async function testGeminiApiKey(apiKey: string, modelId?: string): Promise<boolean> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelId || "gemini-1.5-flash" });
    await model.generateContent("Test");
    return true;
  } catch {
    return false;
  }
}

/**
 * Test the currently selected model with the stored API key.
 */
export async function testCurrentModel(): Promise<boolean> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return false;
  const modelId = await getSelectedModelId();
  return testGeminiApiKey(apiKey, modelId);
}
