import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  Key,
  Save,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import {
  hasGeminiApiKey,
  getMaskedGeminiApiKey,
  saveGeminiApiKey,
  removeGeminiApiKey,
  getGeminiApiKey,
} from "@/lib/storage/settings";
import { getSelectedModelId, setSelectedModelId, getEnabledModels } from "@/lib/storage/aiSettings";
import { testGeminiApiKey } from "@/lib/ai/gemini";
import type { AIModel } from "@/lib/ai/models";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Style Mirror" },
      { name: "description", content: "Configure your AI provider and API key for Style Mirror." },
      { property: "og:title", content: "Settings — Style Mirror" },
      { property: "og:description", content: "AI and API configuration for Style Mirror." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<"success" | "error" | null>(null);
  const [modelId, setModelId] = useState<string>("");
  const [testingModel, setTestingModel] = useState(false);
  const [modelTestResult, setModelTestResult] = useState<"success" | "error" | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  const maskedKey = getMaskedGeminiApiKey();
  const hasKey = hasGeminiApiKey();

  useEffect(() => {
    let mounted = true;
    getEnabledModels().then((enabledModels) => {
      if (mounted) {
        setModels(enabledModels);
      }
    });
    const currentModelId = getSelectedModelId();
    setModelId(currentModelId);
    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) return;
    saveGeminiApiKey(apiKeyInput);
    setApiKeyInput("");
    setShowKey(false);
    setKeyTestResult(null);
  };

  const handleRemoveApiKey = () => {
    removeGeminiApiKey();
    setShowKey(false);
    setKeyTestResult(null);
  };

  const handleTestApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setTestingKey(true);
    setKeyTestResult(null);
    const success = await testGeminiApiKey(apiKeyInput.trim(), modelId);
    setKeyTestResult(success ? "success" : "error");
    setTestingKey(false);
  };

  const handleModelChange = async (newModelId: string) => {
    setModelId(newModelId);
    setSelectedModelId(newModelId);
    setShowModelDropdown(false);
    setModelTestResult(null);
  };

  const handleTestModel = async () => {
    if (!hasKey) {
      setModelTestResult("error");
      return;
    }
    setTestingModel(true);
    setModelTestResult(null);
    const { testGeminiApiKey } = await import("@/lib/ai/gemini");
    const success = await testGeminiApiKey(getGeminiApiKey() || "", modelId);
    setModelTestResult(success ? "success" : "error");
    setTestingModel(false);
  };

  const getCurrentModel = () => models.find((m) => m.id === modelId) || models[0];

  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 pb-32 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">Settings</h1>
      </div>

      <div className="mt-6 space-y-6">
        {/* AI Provider Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-primary">AI Provider</h2>

          <div className="rounded-2xl bg-card p-5 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Gemini</h3>
              <p className="text-sm text-muted-foreground">Google's Gemini API for item analysis</p>
            </div>

            {/* API Key Section */}
            <div className="pt-4 border-t">
              <h4 className="text-base font-medium mb-3 flex items-center gap-2">
                <Key className="h-5 w-5" /> Gemini API Key
              </h4>

              {hasKey ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-secondary p-4">
                    <div className="flex items-center gap-3">
                      <Key className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <code className="text-sm font-mono">{maskedKey}</code>
                        <p className="text-xs text-muted-foreground mt-1">
                          API key is stored locally on this device
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowKey(true)}
                      className="text-sm text-primary hover:underline"
                    >
                      Show
                    </button>
                  </div>

                  {showKey && (
                    <div className="rounded-xl bg-secondary p-4 space-y-2">
                      <input
                        type="text"
                        value={apiKeyInput || maskedKey?.replace(/•/g, "") || ""}
                        readOnly
                        className="w-full rounded-lg bg-background px-3 py-2 text-sm font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        This is your actual API key. Keep it secret.
                      </p>
                      <button
                        onClick={() => setShowKey(false)}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        Hide
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Your API key is stored locally on this device. Style Mirror does not store it in
                    a database. For this browser MVP, the API key can be inspected by the
                    user/browser. Do not use a production secret key here.
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={handleTestApiKey}
                      disabled={testingKey}
                      className="flex-1 rounded-xl bg-primary px-4 py-2 text-primary-foreground font-medium disabled:opacity-50"
                    >
                      {testingKey ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Testing...
                        </span>
                      ) : (
                        "Test Connection"
                      )}
                    </button>
                    <button
                      onClick={handleRemoveApiKey}
                      className="rounded-xl bg-secondary px-4 py-2 text-destructive font-medium"
                    >
                      Remove Key
                    </button>
                  </div>

                  {keyTestResult === "success" && (
                    <p className="text-sm text-green-500 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" /> Connection successful
                    </p>
                  )}
                  {keyTestResult === "error" && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <XCircle className="h-4 w-4" /> Connection failed. Check your API key.
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Get your API key from{" "}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Google AI Studio
                    </a>
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
                    <p className="text-sm text-destructive flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" /> Gemini isn't configured yet.
                    </p>
                  </div>
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter your Gemini API key"
                    className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:border-primary text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleTestApiKey}
                      disabled={testingKey || !apiKeyInput.trim()}
                      className="flex-1 rounded-xl bg-primary px-4 py-2 text-primary-foreground font-medium disabled:opacity-50"
                    >
                      {testingKey ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Testing...
                        </span>
                      ) : (
                        "Test Connection"
                      )}
                    </button>
                    <button
                      onClick={handleSaveApiKey}
                      disabled={!apiKeyInput.trim()}
                      className="rounded-xl bg-foreground px-4 py-2 text-background font-medium disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="text-sm text-primary hover:underline"
                  >
                    {showKey ? "Hide" : "Show"} key
                  </button>
                  {keyTestResult === "success" && (
                    <p className="text-sm text-green-500 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" /> Connection successful
                    </p>
                  )}
                  {keyTestResult === "error" && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <XCircle className="h-4 w-4" /> Connection failed. Check your API key.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Get your API key from{" "}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Google AI Studio
                    </a>
                  </p>
                </div>
              )}
            </div>

            {/* Model Selection Section */}
            <div className="pt-4 border-t">
              <h4 className="text-base font-medium mb-3 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> AI Model
              </h4>

              <div className="space-y-3">
                <div className="relative">
                  <button
                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                    className="w-full rounded-xl bg-secondary px-4 py-3 text-left font-medium flex items-center justify-between"
                    aria-expanded={showModelDropdown}
                    aria-haspopup="listbox"
                  >
                    <span>{getCurrentModel()?.displayName || "Select model"}</span>
                    <ChevronLeft
                      className={`h-5 w-5 transition-transform ${showModelDropdown ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showModelDropdown && (
                    <div
                      className="absolute z-10 w-full mt-1 rounded-xl bg-card border shadow-lg overflow-hidden"
                      role="listbox"
                    >
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => handleModelChange(model.id)}
                          className={`w-full px-4 py-3 text-left ${
                            modelId === model.id
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-secondary"
                          } flex items-center justify-between`}
                          role="option"
                          aria-selected={modelId === model.id}
                        >
                          <span>{model.displayName}</span>
                          {modelId === model.id && <CheckCircle className="h-5 w-5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleTestModel}
                    disabled={testingModel || !hasKey}
                    className="flex-1 rounded-xl bg-primary px-4 py-2 text-primary-foreground font-medium disabled:opacity-50"
                  >
                    {testingModel ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Testing...
                      </span>
                    ) : (
                      "Test Model"
                    )}
                  </button>
                </div>

                {modelTestResult === "success" && (
                  <p className="text-sm text-green-500 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" /> Model connection successful
                  </p>
                )}
                {modelTestResult === "error" && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <XCircle className="h-4 w-4" /> Model test failed. Check your API key and model
                    availability.
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Current model: <code className="font-mono">{modelId}</code>
                  {getCurrentModel()?.capabilities && (
                    <>
                      {" | Capabilities: "}
                      <span className="font-mono">
                        {[
                          getCurrentModel()?.capabilities.vision && "Vision",
                          getCurrentModel()?.capabilities.structuredOutput && "Structured Output",
                          getCurrentModel()?.capabilities.jsonMode && "JSON Mode",
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy Notice */}
        <section className="rounded-2xl bg-card p-5 border border-primary/20">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" /> Privacy & Security
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Your API key is stored locally in this browser's localStorage</li>
            <li>• Style Mirror does not send your key to any server</li>
            <li>• The key is only used to call Google's Gemini API directly</li>
            <li>• Camera processing happens entirely on-device (MediaPipe)</li>
            <li>• No video, images, or biometric data is uploaded</li>
            <li>• For production use, implement a server-side proxy</li>
          </ul>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
