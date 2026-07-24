import type {
  FileNode,
  WorkflowRecord,
  WorkflowRunRecord,
  WorkflowVersionRecord,
} from "@/domain/types";

export interface RunOptions {
  objective?: string;
  workspaceId?: string | null;
  successCriteria?: string[];
  maxPlanRevisions?: number;
}

/** Resume actions understood by the backend /resume endpoint. */
export type ResumeAction =
  | "approve_plan"
  | "send_plan_feedback"
  | "approve_code"
  | "request_code_changes";

export interface ResumeOptions {
  action?: ResumeAction;
  feedback?: string;
  stateUpdates?: Record<string, unknown>;
}

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

  /** Upload a zipped repository; backend unzips into an isolated workspace. */
  uploadRepo(
    zip: Blob,
    fileName?: string,
  ): Promise<{ workspace_id: string; file_tree: FileNode[] }>;

  /** URL to download the (possibly modified) workspace as a zip. */
  downloadUrl(workspaceId: string): string;

  /** List files in an uploaded workspace. */
  getWorkspaceTree(
    workspaceId: string,
  ): Promise<{ file_tree: FileNode[] }>;

  /** Read a text file from a workspace. */
  getWorkspaceFile(workspaceId: string, path: string): Promise<string>;

  run(versionId: string, options?: RunOptions): Promise<WorkflowRunRecord>;

  resume(runId: string, options?: ResumeOptions): Promise<WorkflowRunRecord>;

  pauseActive(): Promise<void>;
}
