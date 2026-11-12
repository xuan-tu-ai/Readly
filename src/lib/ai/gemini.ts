import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { parseStructured } from "./parse";
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
    return parseStructured(text, schema, task, "Gemini");
  }
}
