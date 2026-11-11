import { AiConfigError, type AiProvider, type StructuredRequest } from "./types";

export type MockResponder = (request: StructuredRequest<unknown>) => unknown;

/**
 * Deterministic, offline provider for tests and for demos without network or
 * quota. Each task registers a responder; output is still validated against
 * the task schema, so the mock cannot drift from the real contract.
 */
export class MockProvider implements AiProvider {
  readonly name = "mock" as const;
  private readonly responders = new Map<string, MockResponder>();

  constructor(responders: Record<string, MockResponder> = {}) {
    for (const [task, responder] of Object.entries(responders)) this.responders.set(task, responder);
  }

  register(task: string, responder: MockResponder): this {
    this.responders.set(task, responder);
    return this;
  }

  async generateStructured<T>(request: StructuredRequest<T>): Promise<T> {
    const responder = this.responders.get(request.task);
    if (!responder) {
      throw new AiConfigError(`MockProvider chưa có câu trả lời mẫu cho task "${request.task}".`);
    }
    return request.schema.parse(responder(request as StructuredRequest<unknown>));
  }
}
