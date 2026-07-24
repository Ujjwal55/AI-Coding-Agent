import type { WorkflowApiPort } from "@/ports/WorkflowApiPort";
import type {
  WorkflowRecord,
  WorkflowRunRecord,
  WorkflowVersionRecord,
} from "@/domain/types";

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Concrete HTTP adapter for today's FastAPI orchestrator. */
export class HttpWorkflowAdapter implements WorkflowApiPort {
  constructor(private readonly baseUrl: string = getBaseUrl()) {}

  async createWorkflow(input: {
    name: string;
    description?: string;
  }): Promise<WorkflowRecord> {
    const res = await fetch(`${this.baseUrl}/api/workflows/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseJson<WorkflowRecord>(res);
  }

  async saveVersion(
    workflowId: string,
    graphJson: { nodes: unknown[]; edges: unknown[] },
  ): Promise<WorkflowVersionRecord> {
    const res = await fetch(
      `${this.baseUrl}/api/workflows/${workflowId}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph_json: graphJson }),
      },
    );
    return parseJson<WorkflowVersionRecord>(res);
  }

  async run(versionId: string): Promise<WorkflowRunRecord> {
    const res = await fetch(
      `${this.baseUrl}/api/workflows/${versionId}/run`,
      { method: "POST" },
    );
    return parseJson<WorkflowRunRecord>(res);
  }

  async resume(
    runId: string,
    stateUpdates?: Record<string, unknown>,
  ): Promise<WorkflowRunRecord> {
    const res = await fetch(
      `${this.baseUrl}/api/workflows/${runId}/resume`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state_updates: stateUpdates ?? null }),
      },
    );
    return parseJson<WorkflowRunRecord>(res);
  }
}
