/**
 * Local settings storage for Style Mirror.
 * Stores Gemini API key securely in localStorage (browser-only).
 *
 * SECURITY NOTE: Browser-stored API keys are NOT secure production secrets.
 * This is a personal/local MVP configuration. Do not use a sensitive
 * production API key on a publicly accessible deployment.
 */

const SETTINGS_KEY = "style-mirror-settings";

export interface Settings {
  geminiApiKey?: string;
}

let cachedSettings: Settings = {};

/** Load settings from localStorage (browser only). */
function loadSettings(): Settings {
  if (typeof window === "undefined") return {};
  if (cachedSettings && Object.keys(cachedSettings).length > 0) return cachedSettings;
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      cachedSettings = JSON.parse(stored);
      return cachedSettings;
    }
  } catch {
    // Ignore parse errors
  }
  cachedSettings = {};
  return cachedSettings;
}

/** Save settings to localStorage (browser only). */
function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  cachedSettings = settings;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Get the stored Gemini API key. */
export function getGeminiApiKey(): string | undefined {
  return loadSettings().geminiApiKey;
}

/** Save the Gemini API key. */
export function saveGeminiApiKey(apiKey: string): void {
  const settings = loadSettings();
  settings.geminiApiKey = apiKey.trim();
  saveSettings(settings);
}

/** Remove the Gemini API key. */
export function removeGeminiApiKey(): void {
  const settings = loadSettings();
  delete settings.geminiApiKey;
  saveSettings(settings);
}

/** Check if Gemini API key is configured. */
export function hasGeminiApiKey(): boolean {
  const key = getGeminiApiKey();
  return Boolean(key && key.trim().length > 0);
}

/** Get masked API key for display (e.g., "AIzaSy••••••••••••••••1234"). */
export function getMaskedGeminiApiKey(): string | undefined {
  const key = getGeminiApiKey();
  if (!key) return undefined;
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 6)}••••••••••••••••${key.slice(-4)}`;
}
