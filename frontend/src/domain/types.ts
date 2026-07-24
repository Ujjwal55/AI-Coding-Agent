/** Domain types for the AI Coding Control Plane UI.
 * Aligned with backend WorkflowEvent / WorkflowRun where possible.
 */

export type RunStatus = "idle" | "pending" | "running" | "paused" | "completed" | "failed";

export type NodeRunStatus = "pending" | "running" | "completed" | "failed" | "waiting";

/** Which human gate the run is paused at (mirrors backend state_json.pause_reason). */
export type PauseReason =
  | "criteria_review"
  | "plan_review"
  | "code_review"
  | null;

/** A file entry from the uploaded workspace tree (backend /api/upload). */
export interface FileNode {
  path: string;
  is_dir: boolean;
  size?: number;
}

/** Matches backend WorkflowEvent.event_type values (+ UI-only prepared). */
export type UiEventType =
  | "prepared"
  | "run_started"
  | "node_started"
  | "node_completed"
  | "error"
  | "approval_requested"
  | "run_completed"
  | "run_cancelled";

export interface UiEvent {
  id: string;
  runId: string | null;
  eventType: UiEventType;
  nodeId: string | null;
  message: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface MissionState {
  objective: string;
  repoPath: string | null;
  attachments: string[];
  prepared: boolean;
  /** Backend workspace id returned after uploading & unzipping the repo. */
  workspaceId: string | null;
  /** File tree of the uploaded workspace. */
  fileTree: FileNode[];
  /** True while a folder is being zipped + uploaded. */
  uploading: boolean;
}

export interface RunIntent {
  objective: string;
  repoPath: string | null;
  graphJson: { nodes: unknown[]; edges: unknown[] };
}

export interface RunStartOptions {
  objective: string;
  repoPath?: string | null;
}

export interface WorkflowRecord {
  id: string;
  name: string;
  description?: string | null;
}

export interface WorkflowVersionRecord {
  id: string;
  workflow_id: string;
  version: number;
  graph_json: Record<string, unknown>;
}

export interface WorkflowRunRecord {
  id: string;
  version_id: string;
  status: string;
  state_json?: Record<string, unknown> | null;
}

export interface TimelineStep {
  nodeId: string;
  label: string;
  status: NodeRunStatus;
}

export interface NodeMetadata {
  execution_time_sec: number;
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  estimated_cost: number;
  files_touched: string[];
}

export interface ConsoleLine {
  id: string;
  timestamp: string;
  nodeId: string | null;
  message: string;
  tone: "default" | "active" | "error" | "success";
}

export interface NodeExecutionView {
  nodeId: string;
  status: NodeRunStatus;
  lastMessage: string | null;
  stdout: string | null;
}

export interface ModelUsageDetail {
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

export interface LlmUsage {
  total_calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  breakdown_by_model?: Record<string, ModelUsageDetail>;
}

