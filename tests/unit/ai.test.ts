import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AiConfigError,
  AiRetryableError,
  createAiProvider,
  GeminiProvider,
  MockProvider,
} from "@/lib/ai";
import { parseStructured } from "@/lib/ai/gemini";

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

describe("parseStructured (Gemini output)", () => {
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
