/**
 * AI Settings Storage for Style Mirror.
 *
 * Stores selected AI model locally (localStorage).
 * Extends the existing settings abstraction.
 */

import { DEFAULT_MODEL_ID, isValidModel } from "@/lib/ai/models";

const AI_SETTINGS_KEY = "style-mirror-ai-settings";

export interface AISettings {
  selectedModelId?: string;
}

/** Load AI settings from localStorage (browser only). */
function loadAISettings(): AISettings {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(AI_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

/** Save AI settings to localStorage (browser only). */
function saveAISettings(settings: AISettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
}

/** Get the currently selected model ID. */
export function getSelectedModelId(): string {
  const settings = loadAISettings();
  const savedModelId = settings.selectedModelId;

  if (savedModelId) {
    // Check if the saved model is still supported
    if (isValidModel(savedModelId)) {
      return savedModelId;
    }
    // Model is no longer supported - reset to default
    resetSelectedModel();
    return DEFAULT_MODEL_ID;
  }

  // No saved model - use default
  return DEFAULT_MODEL_ID;
}

/** Get all enabled models (for UI display). */
export async function getEnabledModels() {
  const { getEnabledModels: getModels } = await import("@/lib/ai/models");
  return getModels();
}

/** Save the selected model ID. */
export function setSelectedModelId(modelId: string): void {
  const settings = loadAISettings();
  settings.selectedModelId = modelId;
  saveAISettings(settings);
}

/** Reset to default model. */
export function resetSelectedModel(): void {
  const settings = loadAISettings();
  delete settings.selectedModelId;
  saveAISettings(settings);
}
