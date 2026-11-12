import { z } from "zod";
import { parseStructured } from "./parse";
import { AiConfigError, AiRetryableError, type AiProvider, type StructuredRequest } from "./types";

export type JsonMode = "json_schema" | "json_object";

export type OpenAiConfig = {
  baseUrl: string;
  apiKey: string | undefined;
  model: string | undefined;
  /** "json_schema" (structured outputs) or "json_object" for servers that only support JSON mode. */
  jsonMode?: JsonMode;
  timeoutMs?: number;
  /** Injected in tests. */
  fetch?: typeof fetch;
};

type ChatCompletion = {
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
};

/**
 * Any server speaking the OpenAI Chat Completions protocol (OpenAI itself,
 * Token Harbor, OpenRouter, a local vLLM…). The JSON Schema is sent both as
 * `response_format` and in the system prompt, so proxies that ignore
 * structured outputs still get the contract; zod validates the reply.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = "openai" as const;
  private readonly url: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly jsonMode: JsonMode;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAiConfig) {
    if (!config.apiKey) throw new AiConfigError("Thiếu OPENAI_API_KEY cho AI_PROVIDER=openai.");
    if (!config.model) throw new AiConfigError("Thiếu OPENAI_MODEL cho AI_PROVIDER=openai.");
    this.url = `${config.baseUrl.replace(/\/+$/u, "")}/chat/completions`;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.jsonMode = config.jsonMode ?? "json_schema";
    this.timeoutMs = config.timeoutMs ?? 120_000;
    this.fetchImpl = config.fetch ?? fetch;
  }

  async generateStructured<T>({ system, prompt, schema, task }: StructuredRequest<T>): Promise<T> {
    // Without the "$schema" marker models are far less likely to echo the schema back as the answer.
    const jsonSchema: Record<string, unknown> = { ...z.toJSONSchema(schema) };
    delete jsonSchema.$schema;
    const responseFormat =
      this.jsonMode === "json_schema"
        ? { type: "json_schema", json_schema: { name: schemaName(task), schema: jsonSchema, strict: false } }
        : { type: "json_object" };
    const body = {
      model: this.model,
      temperature: 0.3,
      response_format: responseFormat,
      messages: [
        {
          role: "system",
          content: [
            system,
            "",
            "Chỉ trả về đúng một đối tượng JSON theo JSON Schema sau, không kèm chữ nào khác:",
            JSON.stringify(jsonSchema),
            "Lược đồ trên chỉ mô tả cấu trúc: KHÔNG chép lại lược đồ, hãy trả về dữ liệu thật theo cấu trúc đó.",
          ].join("\n"),
        },
        { role: "user", content: prompt },
      ],
    };

    let response: Response;
    try {
      response = await this.fetchImpl(this.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw this.networkError(error, task);
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      const message = `AI (${this.model}) trả lỗi HTTP ${response.status} cho "${task}": ${detail}`;
      // Bad key, unknown model or rejected request: retrying will not help.
      if ([400, 401, 403, 404, 422].includes(response.status)) throw new AiConfigError(message);
      throw new AiRetryableError(message);
    }

    let completion: ChatCompletion;
    try {
      completion = (await response.json()) as ChatCompletion;
    } catch (error) {
      throw this.networkError(error, task);
    }
    const choice = completion.choices?.[0];
    if (choice?.finish_reason === "length") {
      throw new AiRetryableError(`AI (${this.model}) bị cắt giữa chừng khi chạy "${task}"`);
    }
    return parseStructured(choice?.message?.content, schema, task, `AI (${this.model})`);
  }

  private networkError(error: unknown, task: string) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    const message = timedOut
      ? `AI (${this.model}) quá ${Math.round(this.timeoutMs / 1000)} giây chưa trả lời xong "${task}"`
      : `Không gọi được AI (${this.model}) cho "${task}"`;
    return new AiRetryableError(message, { cause: error });
  }
}

/** response_format names allow only [a-zA-Z0-9_-]{1,64}. */
function schemaName(task: string): string {
  return task.replace(/[^a-zA-Z0-9_-]/gu, "_").slice(0, 64) || "result";
}
