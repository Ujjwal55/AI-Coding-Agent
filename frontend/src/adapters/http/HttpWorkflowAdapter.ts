import type {
  RunOptions,
  ResumeOptions,
  WorkflowApiPort,
} from "@/ports/WorkflowApiPort";
import type {
  FileNode,
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

  async uploadRepo(
    zip: Blob,
    fileName = "workspace.zip",
  ): Promise<{ workspace_id: string; file_tree: FileNode[] }> {
    const form = new FormData();
    // Backend requires the uploaded filename to end with .zip
    form.append("file", zip, fileName.endsWith(".zip") ? fileName : `${fileName}.zip`);
    const res = await fetch(`${this.baseUrl}/api/upload`, {
      method: "POST",
      body: form,
    });
    return parseJson<{ workspace_id: string; file_tree: FileNode[] }>(res);
  }

  downloadUrl(workspaceId: string): string {
    return `${this.baseUrl}/api/workspaces/${workspaceId}/download`;
  }

  async getWorkspaceTree(
    workspaceId: string,
  ): Promise<{ file_tree: FileNode[] }> {
    const res = await fetch(
      `${this.baseUrl}/api/workspaces/${workspaceId}/tree`,
    );
    return parseJson<{ file_tree: FileNode[] }>(res);
  }

  async getWorkspaceFile(workspaceId: string, path: string): Promise<string> {
    const res = await fetch(
      `${this.baseUrl}/api/workspaces/${workspaceId}/file?path=${encodeURIComponent(path)}`,
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    return res.text();
  }

  async run(versionId: string, options?: RunOptions): Promise<WorkflowRunRecord> {
    const res = await fetch(`${this.baseUrl}/api/workflows/${versionId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: options?.objective ?? null,
        workspace_id: options?.workspaceId ?? null,
        success_criteria: options?.successCriteria ?? null,
        max_plan_revisions: options?.maxPlanRevisions ?? null,
      }),
    });
    return parseJson<WorkflowRunRecord>(res);
  }

  async resume(
    runId: string,
    options?: ResumeOptions,
  ): Promise<WorkflowRunRecord> {
    const res = await fetch(`${this.baseUrl}/api/workflows/${runId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: options?.action ?? null,
        feedback: options?.feedback ?? null,
        state_updates: options?.stateUpdates ?? null,
      }),
    });
    return parseJson<WorkflowRunRecord>(res);
  }
}
