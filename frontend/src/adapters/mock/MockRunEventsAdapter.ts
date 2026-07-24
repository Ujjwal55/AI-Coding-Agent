import type { UiEvent } from "@/domain/types";
import type { RunEventsListener, RunEventsPort } from "@/ports/RunEventsPort";

function nowIso(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** In-memory event bus for L3 + node status until SSE/Events service exists. */
export class MockRunEventsAdapter implements RunEventsPort {
  private events: UiEvent[] = [];
  private listeners = new Set<RunEventsListener>();

  subscribe(listener: RunEventsListener): () => void {
    this.listeners.add(listener);
    listener([...this.events]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getEvents(): UiEvent[] {
    return [...this.events];
  }

  reset(): void {
    this.events = [];
    this.emit();
  }

  seedDemoRun(runId: string, nodeIds: string[]): void {
    const stamps = nodeIds.slice(0, Math.min(nodeIds.length, 4));
    const seeded: UiEvent[] = [
      {
        id: uid("evt"),
        runId,
        eventType: "run_started",
        nodeId: null,
        message: "Run started",
        payload: null,
        createdAt: nowIso(),
      },
    ];

    stamps.forEach((nodeId, index) => {
      const isLast = index === stamps.length - 1;
      seeded.push({
        id: uid("evt"),
        runId,
        eventType: isLast ? "node_started" : "node_completed",
        nodeId,
        message: isLast
          ? `${nodeId} in progress`
          : `${nodeId} completed`,
        payload: isLast
          ? { stdout: `$ running ${nodeId}...\n> working...` }
          : { result: "ok" },
        createdAt: new Date(Date.now() + (index + 1) * 1000).toISOString(),
      });
    });

    this.events = seeded;
    this.emit();
  }

  append(
    event: Omit<UiEvent, "id" | "createdAt"> & {
      id?: string;
      createdAt?: string;
    },
  ): void {
    this.events = [
      ...this.events,
      {
        id: event.id ?? uid("evt"),
        createdAt: event.createdAt ?? nowIso(),
        runId: event.runId,
        eventType: event.eventType,
        nodeId: event.nodeId,
        message: event.message,
        payload: event.payload ?? null,
      },
    ];
    this.emit();
  }

  private emit(): void {
    const snapshot = [...this.events];
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
