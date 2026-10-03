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
  /**
   * Model status for UI display.
   * - "available": model is available for most API keys
   * - "limited": model may require specific API access
   * - "experimental": model is still in preview
   */
  status: "available" | "limited" | "experimental";
  /** Default model for new users */
  default?: boolean;
  /** Short description for UI */
  description: string;
  /** Whether this model supports vision (image input) */
  supportsVision: boolean;
  /** Whether this model supports structured JSON output */
  supportsStructuredOutput: boolean;
  enabled: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  models: AIModel[];
}

// Current Gemini models (updated 2026)
export const GEMINI_MODELS: AIModel[] = [
  {
    id: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    provider: "gemini",
    capabilities: {
      vision: true,
      structuredOutput: true,
      jsonMode: true,
    },
    status: "available",
    default: true,
    description: "Fast multimodal analysis, recommended for item analysis",
    supportsVision: true,
    supportsStructuredOutput: true,
    enabled: true,
  },
  {
    id: "gemini-2.5-flash-lite",
    displayName: "Gemini 2.5 Flash-Lite",
    provider: "gemini",
    capabilities: {
      vision: true,
      structuredOutput: true,
      jsonMode: true,
    },
    status: "available",
    description: "Lightweight fast model for quick analysis",
    supportsVision: true,
    supportsStructuredOutput: true,
    enabled: true,
  },
  {
    id: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    provider: "gemini",
    capabilities: {
      vision: true,
      structuredOutput: true,
      jsonMode: true,
    },
    status: "available",
    description: "Higher quality analysis for complex items",
    supportsVision: true,
    supportsStructuredOutput: true,
    enabled: true,
  },
  {
    id: "gemini-3.5-flash",
    displayName: "Gemini 3.5 Flash",
    provider: "gemini",
    capabilities: {
      vision: true,
      structuredOutput: true,
      jsonMode: true,
    },
    status: "limited",
    description: "Latest generation, check API access",
    supportsVision: true,
    supportsStructuredOutput: true,
    enabled: true,
  },
  {
    id: "gemini-3.5-flash-lite",
    displayName: "Gemini 3.5 Flash-Lite",
    provider: "gemini",
    capabilities: {
      vision: true,
      structuredOutput: true,
      jsonMode: true,
    },
    status: "limited",
    description: "Latest lightweight model, check API access",
    supportsVision: true,
    supportsStructuredOutput: true,
    enabled: true,
  },
  {
    id: "gemini-3.8-flash",
    displayName: "Gemini 3.8 Flash",
    provider: "gemini",
    capabilities: {
      vision: true,
      structuredOutput: true,
      jsonMode: true,
    },
    status: "experimental",
    description: "Experimental model, may have limited access",
    supportsVision: true,
    supportsStructuredOutput: true,
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
export const DEFAULT_MODEL_ID = "gemini-2.5-flash";

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
