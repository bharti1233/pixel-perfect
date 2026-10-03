/**
 * AI Settings Storage for Style Mirror.
 *
 * Stores selected AI model locally (localStorage).
 * Extends the existing settings abstraction.
 */

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
  if (settings.selectedModelId) return settings.selectedModelId;
  // Return default model ID if not set
  return "gemini-1.5-flash";
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
