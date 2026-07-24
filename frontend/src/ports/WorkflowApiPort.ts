import type {
  WorkflowRecord,
  WorkflowRunRecord,
  WorkflowVersionRecord,
} from "@/domain/types";

/** Port for orchestrator HTTP API. Swap adapter without changing UI. */
export interface WorkflowApiPort {
  createWorkflow(input: {
    name: string;
    description?: string;
  }): Promise<WorkflowRecord>;

  saveVersion(
    workflowId: string,
    graphJson: { nodes: unknown[]; edges: unknown[] },
  ): Promise<WorkflowVersionRecord>;

  run(versionId: string): Promise<WorkflowRunRecord>;

  resume(
    runId: string,
    stateUpdates?: Record<string, unknown>,
  ): Promise<WorkflowRunRecord>;
}
