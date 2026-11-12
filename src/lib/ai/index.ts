import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";
import { mockComparePrediction, mockGrade } from "./mock-responders";
import { AiConfigError, type AiProvider } from "./types";

export * from "./types";
export { GeminiProvider, MockProvider };

/** Mock responders shared by tests and demo mode. Later phases register their tasks here. */
export const defaultMockResponders: ConstructorParameters<typeof MockProvider>[0] = {
  ping: () => ({ ok: true }),
  "grade-answer": mockGrade,
  "compare-prediction": mockComparePrediction,
};

export function createAiProvider(env: Record<string, string | undefined> = process.env): AiProvider {
  const kind = env.AI_PROVIDER ?? "mock";
  switch (kind) {
    case "mock":
      return new MockProvider(defaultMockResponders);
    case "gemini":
      return new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL || "gemini-2.5-flash");
    default:
      throw new AiConfigError(`AI_PROVIDER không hợp lệ: "${kind}" (dùng "mock" hoặc "gemini").`);
  }
}

let shared: AiProvider | undefined;
export function getAiProvider(): AiProvider {
  shared ??= createAiProvider();
  return shared;
}
