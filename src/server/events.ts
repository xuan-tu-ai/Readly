/**
 * Tiny in-process domain events. Phase 4 emits them; later phases subscribe
 * (points and badges in phase 5, notifications in phase 7) without the
 * emitting code having to know about them.
 */

export type DomainEvent =
  | { type: "AnswerGraded"; userId: string; answerId: string; questionId: string; workId: string }
  | { type: "SegmentsRead"; userId: string; workId: string; segmentIds: string[] }
  | { type: "WorkCompleted"; userId: string; workId: string };

type Handler<T extends DomainEvent["type"]> = (event: Extract<DomainEvent, { type: T }>) => Promise<void> | void;

const handlers = new Map<DomainEvent["type"], Handler<DomainEvent["type"]>[]>();

export function on<T extends DomainEvent["type"]>(type: T, handler: Handler<T>) {
  const list = handlers.get(type) ?? [];
  list.push(handler as unknown as Handler<DomainEvent["type"]>);
  handlers.set(type, list);
}

/** Runs handlers in registration order; a failing handler does not stop the others. */
export async function emit(event: DomainEvent) {
  for (const handler of handlers.get(event.type) ?? []) {
    try {
      await handler(event as never);
    } catch (error) {
      console.error(`[events] ${event.type} handler failed`, error);
    }
  }
}
