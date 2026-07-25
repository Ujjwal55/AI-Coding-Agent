/** BYOK (bring-your-own-key) settings for a run. Stored in sessionStorage. */

export type ByokProvider =
  | "gemini"
  | "groq"
  | "openai"
  | "openai_compatible"
  | "anthropic";

export interface ByokSettings {
  provider: ByokProvider;
  apiKey: string;
  /** Free-form model id — any model the provider accepts. */
  model: string;
  /** Required for openai_compatible (e.g. https://api.deepseek.com/v1). */
  baseUrl: string;
}

const STORAGE_KEY = "dtdl.byok.v2";

export const MODEL_SUGGESTIONS: Record<ByokProvider, string[]> = {
  gemini: [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-2.5-pro",
  ],
  groq: [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "qwen/qwen3-32b",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o4-mini"],
  openai_compatible: [
    "deepseek-chat",
    "deepseek-reasoner",
    "llama-3.3-70b-versatile",
  ],
  anthropic: [
    "claude-sonnet-4-5",
    "claude-opus-4-5",
    "claude-haiku-4-5",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
  ],
};

export function defaultModelForProvider(provider: ByokProvider): string {
  return MODEL_SUGGESTIONS[provider][0];
}

export function defaultBaseUrl(provider: ByokProvider): string {
  if (provider === "openai") return "https://api.openai.com/v1";
  if (provider === "openai_compatible") return "";
  return "";
}

function normalizeProvider(raw: unknown): ByokProvider {
  if (raw === "groq") return "groq";
  if (raw === "openai") return "openai";
  if (raw === "openai_compatible") return "openai_compatible";
  if (raw === "anthropic") return "anthropic";
  return "gemini";
}

export function loadByokSettings(): ByokSettings {
  if (typeof window === "undefined") {
    return {
      provider: "gemini",
      apiKey: "",
      model: defaultModelForProvider("gemini"),
      baseUrl: "",
    };
  }
  try {
    const raw =
      sessionStorage.getItem(STORAGE_KEY) ||
      sessionStorage.getItem("dtdl.byok.v1");
    if (!raw) {
      return {
        provider: "gemini",
        apiKey: "",
        model: defaultModelForProvider("gemini"),
        baseUrl: "",
      };
    }
    const parsed = JSON.parse(raw) as Partial<ByokSettings>;
    const provider = normalizeProvider(parsed.provider);
    return {
      provider,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model:
        typeof parsed.model === "string" && parsed.model.trim()
          ? parsed.model.trim()
          : defaultModelForProvider(provider),
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
    };
  } catch {
    return {
      provider: "gemini",
      apiKey: "",
      model: defaultModelForProvider("gemini"),
      baseUrl: "",
    };
  }
}

export function saveByokSettings(settings: ByokSettings): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Payload fields for run / resume when BYOK is filled in. */
export function byokRunFields(settings: ByokSettings): {
  byokProvider?: ByokProvider;
  byokApiKey?: string;
  byokModel?: string;
  byokBaseUrl?: string;
} {
  const key = settings.apiKey.trim();
  if (!key) return {};
  const model =
    settings.model.trim() || defaultModelForProvider(settings.provider);
  const fields: {
    byokProvider: ByokProvider;
    byokApiKey: string;
    byokModel: string;
    byokBaseUrl?: string;
  } = {
    byokProvider: settings.provider,
    byokApiKey: key,
    byokModel: model,
  };
  if (settings.provider === "openai_compatible" || settings.provider === "openai") {
    const base = settings.baseUrl.trim() || defaultBaseUrl(settings.provider);
    if (base) fields.byokBaseUrl = base;
  }
  return fields;
}
