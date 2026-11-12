import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";
import { OpenAiCompatibleProvider, type JsonMode } from "./openai";
import { draftMockResponders } from "./drafts";
import { mockComparePrediction, mockGrade } from "./mock-responders";
import { AiConfigError, type AiProvider } from "./types";

export * from "./types";
export { GeminiProvider, MockProvider, OpenAiCompatibleProvider };

/** Mock responders shared by tests and demo mode. Later phases register their tasks here. */
export const defaultMockResponders: ConstructorParameters<typeof MockProvider>[0] = {
  ping: () => ({ ok: true }),
  "grade-answer": mockGrade,
  "compare-prediction": mockComparePrediction,
  ...draftMockResponders,
};

export function createAiProvider(env: Record<string, string | undefined> = process.env): AiProvider {
  const kind = env.AI_PROVIDER ?? "mock";
  switch (kind) {
    case "mock":
      return new MockProvider(defaultMockResponders);
    case "gemini":
      return new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL || "gemini-2.5-flash");
    case "openai":
      return new OpenAiCompatibleProvider({
        baseUrl: env.OPENAI_BASE_URL || "https://api.openai.com/v1",
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL,
        jsonMode: parseJsonMode(env.OPENAI_JSON_MODE),
        timeoutMs: env.OPENAI_TIMEOUT_MS ? Number(env.OPENAI_TIMEOUT_MS) : undefined,
      });
    default:
      throw new AiConfigError(
        `AI_PROVIDER không hợp lệ: "${kind}" (dùng "mock", "openai" hoặc "gemini").`,
      );
  }
}

function parseJsonMode(value: string | undefined): JsonMode | undefined {
  if (!value) return undefined;
  if (value === "json_schema" || value === "json_object") return value;
  throw new AiConfigError(`OPENAI_JSON_MODE không hợp lệ: "${value}" (dùng "json_schema" hoặc "json_object").`);
}

let shared: AiProvider | undefined;
export function getAiProvider(): AiProvider {
  shared ??= createAiProvider();
  return shared;
}
