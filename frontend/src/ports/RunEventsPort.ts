import type { UiEvent } from "@/domain/types";

export type RunEventsListener = (events: UiEvent[]) => void;

/** Port for live run observations. Mock now; SSE/Events service later. */
export interface RunEventsPort {
  subscribe(listener: RunEventsListener): () => void;
  getEvents(): UiEvent[];
  reset(): void;
  seedDemoRun(runId: string, nodeIds: string[]): void;
  append(event: Omit<UiEvent, "id" | "createdAt"> & { id?: string; createdAt?: string }): void;
}
