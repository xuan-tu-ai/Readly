import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AiConfigError,
  AiRetryableError,
  createAiProvider,
  GeminiProvider,
  MockProvider,
  OpenAiCompatibleProvider,
} from "@/lib/ai";
import { parseStructured } from "@/lib/ai/parse";

const schema = z.object({ level: z.enum(["chua_dat", "dat", "sau_sac"]) });
const request = { task: "grade", system: "s", prompt: "p", schema };

describe("createAiProvider", () => {
  it("defaults to the mock provider", () => {
    expect(createAiProvider({}).name).toBe("mock");
  });

  it("requires an API key for Gemini", () => {
    expect(() => createAiProvider({ AI_PROVIDER: "gemini" })).toThrow(AiConfigError);
  });

  it("builds a Gemini provider when configured", () => {
    expect(createAiProvider({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-key" })).toBeInstanceOf(
      GeminiProvider,
    );
  });

  it("requires a key and a model for OpenAI-compatible servers", () => {
    expect(() => createAiProvider({ AI_PROVIDER: "openai", OPENAI_MODEL: "m" })).toThrow(AiConfigError);
    expect(() => createAiProvider({ AI_PROVIDER: "openai", OPENAI_API_KEY: "k" })).toThrow(AiConfigError);
  });

  it("builds an OpenAI-compatible provider when configured", () => {
    const env = { AI_PROVIDER: "openai", OPENAI_API_KEY: "k", OPENAI_MODEL: "m" };
    expect(createAiProvider(env)).toBeInstanceOf(OpenAiCompatibleProvider);
    expect(() => createAiProvider({ ...env, OPENAI_JSON_MODE: "yaml" })).toThrow(AiConfigError);
  });

  it("rejects unknown providers", () => {
    expect(() => createAiProvider({ AI_PROVIDER: "other" })).toThrow(AiConfigError);
  });
});

describe("MockProvider", () => {
  it("returns registered responses validated against the schema", async () => {
    const ai = new MockProvider({ grade: () => ({ level: "dat" }) });
    await expect(ai.generateStructured(request)).resolves.toEqual({ level: "dat" });
  });

  it("fails loudly for unregistered tasks", async () => {
    await expect(new MockProvider().generateStructured(request)).rejects.toThrow(AiConfigError);
  });

  it("rejects responses that break the contract", async () => {
    const ai = new MockProvider({ grade: () => ({ level: "10/10" }) });
    await expect(ai.generateStructured(request)).rejects.toThrow();
  });
});

describe("parseStructured (model output)", () => {
  it("accepts JSON wrapped in a markdown fence", () => {
    const fenced = ["```json", '{"level":"dat"}', "```"].join("\n");
    expect(parseStructured(fenced, schema, "grade")).toEqual({ level: "dat" });
  });

  it("parses valid JSON", () => {
    expect(parseStructured('{"level":"sau_sac"}', schema, "grade")).toEqual({ level: "sau_sac" });
  });

  it.each([
    ["empty output", undefined],
    ["malformed JSON", "{level:"],
    ["wrong shape", '{"level":"great"}'],
  ])("treats %s as retryable", (_label, text) => {
    expect(() => parseStructured(text, schema, "grade")).toThrow(AiRetryableError);
  });
});

describe("OpenAiCompatibleProvider", () => {
  type Call = { url: string; init: RequestInit };

  function provider(reply: () => Response, jsonMode?: "json_schema" | "json_object") {
    const calls: Call[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return reply();
    }) as unknown as typeof fetch;
    const ai = new OpenAiCompatibleProvider({
      baseUrl: "https://example.test/v1/",
      apiKey: "test-key",
      model: "test-model",
      jsonMode,
      fetch: fake,
    });
    return { ai, calls };
  }

  const completion = (content: string | null, finish = "stop") =>
    Response.json({ choices: [{ message: { content }, finish_reason: finish }] });

  it("posts a chat completion with the schema and parses the reply", async () => {
    const { ai, calls } = provider(() => completion('{"level":"sau_sac"}'));
    await expect(ai.generateStructured(request)).resolves.toEqual({ level: "sau_sac" });

    expect(calls[0].url).toBe("https://example.test/v1/chat/completions");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe("test-model");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.schema.properties.level.enum).toEqual(["chua_dat", "dat", "sau_sac"]);
    expect(body.response_format.json_schema.schema.$schema).toBeUndefined();
    expect(body.messages[0].content).toContain('"sau_sac"');
    expect(body.messages[1]).toEqual({ role: "user", content: "p" });
  });

  it("supports plain JSON mode", async () => {
    const { ai, calls } = provider(() => completion('{"level":"dat"}'), "json_object");
    await ai.generateStructured(request);
    expect(JSON.parse(calls[0].init.body as string).response_format).toEqual({ type: "json_object" });
  });

  it.each([
    ["rate limits", () => new Response("slow down", { status: 429 })],
    ["server errors", () => new Response("oops", { status: 503 })],
    ["truncated replies", () => completion('{"level":', "length")],
    ["off-contract replies", () => completion('{"level":"10/10"}')],
    ["empty replies", () => completion(null)],
  ])("treats %s as retryable", async (_label, reply) => {
    const { ai } = provider(reply);
    await expect(ai.generateStructured(request)).rejects.toThrow(AiRetryableError);
  });

  it("treats network failures as retryable", async () => {
    const { ai } = provider(() => {
      throw new TypeError("fetch failed");
    });
    await expect(ai.generateStructured(request)).rejects.toThrow(AiRetryableError);
  });

  it("says so when the model takes too long", async () => {
    const { ai } = provider(() => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    await expect(ai.generateStructured(request)).rejects.toThrow(/quá \d+ giây/u);
  });

  it("does not retry a rejected key or model", async () => {
    const { ai } = provider(() => new Response('{"error":"invalid api key"}', { status: 401 }));
    await expect(ai.generateStructured(request)).rejects.toThrow(AiConfigError);
  });
});
