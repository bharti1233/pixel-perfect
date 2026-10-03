import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock localStorage
const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem(key: string) {
    return this.store[key] || null;
  },
  setItem(key: string, value: string) {
    this.store[key] = value;
  },
  removeItem(key: string) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  },
};

Object.defineProperty(global, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

describe("AI Settings Storage", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.resetModules();
  });

  it("returns default model when no setting is stored", async () => {
    const { getSelectedModelId } = await import("@/lib/storage/aiSettings");
    expect(getSelectedModelId()).toBe("gemini-2.5-flash");
  });

  it("saves and retrieves selected model ID", async () => {
    const { setSelectedModelId, getSelectedModelId } = await import("@/lib/storage/aiSettings");
    setSelectedModelId("gemini-2.5-pro");
    expect(getSelectedModelId()).toBe("gemini-2.5-pro");
  });

  it("persists model selection across module reloads", async () => {
    const { setSelectedModelId } = await import("@/lib/storage/aiSettings");
    setSelectedModelId("gemini-2.5-pro");

    // Simulate module reload by getting fresh import
    vi.resetModules();
    const { getSelectedModelId } = await import("@/lib/storage/aiSettings");
    expect(getSelectedModelId()).toBe("gemini-2.5-pro");
  });

  it("resets to default model", async () => {
    const { setSelectedModelId, resetSelectedModel, getSelectedModelId } =
      await import("@/lib/storage/aiSettings");
    setSelectedModelId("gemini-2.5-pro");
    resetSelectedModel();
    expect(getSelectedModelId()).toBe("gemini-2.5-flash");
  });
});

describe("Settings Storage", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.resetModules();
  });

  it("returns undefined when no API key is stored", async () => {
    const { getGeminiApiKey } = await import("@/lib/storage/settings");
    expect(getGeminiApiKey()).toBeUndefined();
  });

  it("saves and retrieves API key", async () => {
    const { saveGeminiApiKey, getGeminiApiKey } = await import("@/lib/storage/settings");
    saveGeminiApiKey("test-api-key-12345");
    expect(getGeminiApiKey()).toBe("test-api-key-12345");
  });

  it("removes API key", async () => {
    const { saveGeminiApiKey, removeGeminiApiKey, getGeminiApiKey } =
      await import("@/lib/storage/settings");
    saveGeminiApiKey("test-api-key-12345");
    removeGeminiApiKey();
    expect(getGeminiApiKey()).toBeUndefined();
  });

  it("masks API key for display", async () => {
    const { saveGeminiApiKey, getMaskedGeminiApiKey } = await import("@/lib/storage/settings");
    saveGeminiApiKey("AIzaSyB1234567890123456789012345678901234");
    const masked = getMaskedGeminiApiKey();
    expect(masked).toContain("AIzaSy");
    expect(masked).toContain("••••");
    expect(masked).toContain("1234");
  });

  it("returns true when key exists", async () => {
    const { saveGeminiApiKey, hasGeminiApiKey } = await import("@/lib/storage/settings");
    saveGeminiApiKey("test-key");
    expect(hasGeminiApiKey()).toBe(true);
  });

  it("returns false when key is empty", async () => {
    const { hasGeminiApiKey } = await import("@/lib/storage/settings");
    expect(hasGeminiApiKey()).toBe(false);
  });
});

describe("AI Models Configuration", () => {
  it("has enabled models", async () => {
    const { getEnabledModels } = await import("@/lib/ai/models");
    const models = getEnabledModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.enabled)).toBe(true);
  });

  it("has default model", async () => {
    const { getDefaultModel } = await import("@/lib/ai/models");
    const model = getDefaultModel();
    expect(model.id).toBe("gemini-2.5-flash");
  });

  it("can get model by ID", async () => {
    const { getModelById } = await import("@/lib/ai/models");
    const model = getModelById("gemini-2.5-pro");
    expect(model).toBeDefined();
    expect(model?.id).toBe("gemini-2.5-pro");
  });

  it("validates model ID", async () => {
    const { isValidModel } = await import("@/lib/ai/models");
    expect(isValidModel("gemini-2.5-flash")).toBe(true);
    expect(isValidModel("invalid-model")).toBe(false);
  });

  it("includes Gemini 2.5 Flash", async () => {
    const { getModelById } = await import("@/lib/ai/models");
    const model = getModelById("gemini-2.5-flash");
    expect(model).toBeDefined();
    expect(model?.displayName).toBe("Gemini 2.5 Flash");
  });

  it("includes Gemini 2.5 Flash-Lite", async () => {
    const { getModelById } = await import("@/lib/ai/models");
    const model = getModelById("gemini-2.5-flash-lite");
    expect(model).toBeDefined();
    expect(model?.displayName).toBe("Gemini 2.5 Flash-Lite");
  });

  it("includes Gemini 2.5 Pro", async () => {
    const { getModelById } = await import("@/lib/ai/models");
    const model = getModelById("gemini-2.5-pro");
    expect(model).toBeDefined();
    expect(model?.displayName).toBe("Gemini 2.5 Pro");
  });

  it("includes Gemini 3.5 Flash", async () => {
    const { getModelById } = await import("@/lib/ai/models");
    const model = getModelById("gemini-3.5-flash");
    expect(model).toBeDefined();
    expect(model?.displayName).toBe("Gemini 3.5 Flash");
  });

  it("includes Gemini 3.5 Flash-Lite", async () => {
    const { getModelById } = await import("@/lib/ai/models");
    const model = getModelById("gemini-3.5-flash-lite");
    expect(model).toBeDefined();
    expect(model?.displayName).toBe("Gemini 3.5 Flash-Lite");
  });

  it("includes Gemini 3.8 Flash", async () => {
    const { getModelById } = await import("@/lib/ai/models");
    const model = getModelById("gemini-3.8-flash");
    expect(model).toBeDefined();
    expect(model?.displayName).toBe("Gemini 3.8 Flash");
  });

  it("does not include old Gemini 1.5 models", async () => {
    const { getModelById } = await import("@/lib/ai/models");
    expect(getModelById("gemini-1.5-flash")).toBeUndefined();
    expect(getModelById("gemini-1.5-pro")).toBeUndefined();
    expect(getModelById("gemini-1.5-flash-8b")).toBeUndefined();
  });

  it("default model is Gemini 2.5 Flash", async () => {
    const { getDefaultModel } = await import("@/lib/ai/models");
    const model = getDefaultModel();
    expect(model.id).toBe("gemini-2.5-flash");
    expect(model.displayName).toBe("Gemini 2.5 Flash");
  });
});
