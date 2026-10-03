/**
 * AI Model Configuration for Style Mirror.
 *
 * Centralized configuration for available AI models.
 * Easy to update when models are added/removed.
 */

export interface AIModel {
  id: string;
  displayName: string;
  provider: "gemini";
  capabilities: {
    vision: boolean;
    structuredOutput: boolean;
    jsonMode: boolean;
  };
  enabled: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  models: AIModel[];
}

// Current Gemini models (as of 2024/2025)
export const GEMINI_MODELS: AIModel[] = [
  {
    id: "gemini-1.5-flash",
    displayName: "Gemini 1.5 Flash",
    provider: "gemini",
    capabilities: {
      vision: true,
      structuredOutput: true,
      jsonMode: true,
    },
    enabled: true,
  },
  {
    id: "gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro",
    provider: "gemini",
    capabilities: {
      vision: true,
      structuredOutput: true,
      jsonMode: true,
    },
    enabled: true,
  },
  {
    id: "gemini-1.5-flash-8b",
    displayName: "Gemini 1.5 Flash-8B",
    provider: "gemini",
    capabilities: {
      vision: true,
      structuredOutput: true,
      jsonMode: true,
    },
    enabled: true,
  },
];

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "gemini",
    name: "Gemini",
    models: GEMINI_MODELS,
  },
];

// Default model ID
export const DEFAULT_MODEL_ID = "gemini-1.5-flash";

/**
 * Get all enabled models across all providers.
 */
export function getEnabledModels(): AIModel[] {
  return AI_PROVIDERS.flatMap((p) => p.models.filter((m) => m.enabled));
}

/**
 * Get a model by ID.
 */
export function getModelById(modelId: string): AIModel | undefined {
  return AI_PROVIDERS.flatMap((p) => p.models).find((m) => m.id === modelId);
}

/**
 * Get the default model.
 */
export function getDefaultModel(): AIModel {
  const model = getModelById(DEFAULT_MODEL_ID);
  if (model) return model;
  // Fallback to first enabled model
  const enabled = getEnabledModels();
  const firstEnabled = enabled.find(() => true);
  if (firstEnabled) return firstEnabled;
  // GEMINI_MODELS has at least one element by definition
  return GEMINI_MODELS[0] as AIModel;
}

/**
 * Validate that a model ID is valid and enabled.
 */
export function isValidModel(modelId: string): boolean {
  const model = getModelById(modelId);
  return model !== undefined && model.enabled;
}
