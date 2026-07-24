/** Domain types for the AI Coding Control Plane UI.
 * Aligned with backend WorkflowEvent / WorkflowRun where possible.
 */

export type RunStatus = "idle" | "pending" | "running" | "paused" | "completed" | "failed";

export type NodeRunStatus = "pending" | "running" | "completed" | "failed" | "waiting";

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
}

export interface RunIntent {
  objective: string;
  repoPath: string | null;
  attachments: string[];
  graphJson: { nodes: unknown[]; edges: unknown[] };
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
