import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { AiConfigError, AiRetryableError, type AiProvider, type StructuredRequest } from "./types";

export class GeminiProvider implements AiProvider {
  readonly name = "gemini" as const;
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string | undefined,
    private readonly model: string,
  ) {
    if (!apiKey) throw new AiConfigError("Thiếu GEMINI_API_KEY cho AI_PROVIDER=gemini.");
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateStructured<T>({ system, prompt, schema, task }: StructuredRequest<T>): Promise<T> {
    let text: string | undefined;
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(schema),
          temperature: 0.3,
        },
      });
      text = response.text;
    } catch (error) {
      throw new AiRetryableError(`Gemini lỗi khi chạy "${task}"`, { cause: error });
    }
    return parseStructured(text, schema, task);
  }
}

/** Validates model output against the task schema; bad output is retryable. */
export function parseStructured<T>(text: string | undefined, schema: z.ZodType<T>, task: string): T {
  if (!text) throw new AiRetryableError(`Gemini trả về rỗng cho "${task}"`);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new AiRetryableError(`Gemini trả về JSON không hợp lệ cho "${task}"`, { cause: error });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new AiRetryableError(`Gemini trả về sai định dạng cho "${task}"`, { cause: parsed.error });
  }
  return parsed.data;
}
