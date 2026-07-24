import type { Edge, Node } from "@xyflow/react";
import { getNodeTypeDefinition } from "@/application/nodeRegistry";

export interface WorkflowNodeJson {
  id: string;
  /** Semantic agent type (objective, planner, …) — not React Flow's render type. */
  type: string;
  label: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface WorkflowFileJson {
  version: 1;
  nodes: WorkflowNodeJson[];
  edges: Edge[];
}

function assertValidNodeType(nodeType: string): void {
  if (!getNodeTypeDefinition(nodeType)) {
    throw new Error(`Unknown or invalid nodeType: ${nodeType}`);
  }
}

export function nodeToJSON(node: Node): WorkflowNodeJson {
  const nodeType = String(node.data?.nodeType || "planner");
  assertValidNodeType(nodeType);
  const label = String(node.data?.label ?? node.id);

  return {
    id: node.id,
    type: nodeType,
    label,
    position: node.position,
    data: { ...(node.data as Record<string, unknown>) },
  };
}

export function jsonToNode(
  json: WorkflowNodeJson | Record<string, unknown>,
): Node {
  const id = String(json.id ?? "");
  if (!id) throw new Error("Invalid node: missing id");

  const nodeType = String(
    (json as WorkflowNodeJson).type ||
      (json.data as Record<string, unknown> | undefined)?.nodeType ||
      "",
  );
  if (!nodeType) throw new Error(`Invalid node ${id}: missing type`);
  assertValidNodeType(nodeType);

  const position = (json.position as { x: number; y: number } | undefined) ?? {
    x: 0,
    y: 0,
  };
  const rawData =
    json.data && typeof json.data === "object"
      ? (json.data as Record<string, unknown>)
      : {};
  const label = String(
    (json as WorkflowNodeJson).label ?? rawData.label ?? nodeType,
  );

  return {
    id,
    type: "custom",
    position,
    data: {
      ...rawData,
      label,
      nodeType,
      status: rawData.status ?? "pending",
    },
  };
}

export function buildWorkflowFile(
  nodes: Node[],
  edges: Edge[],
): WorkflowFileJson {
  return {
    version: 1,
    nodes: nodes.map(nodeToJSON),
    edges,
  };
}

export function downloadWorkflowFile(nodes: Node[], edges: Edge[]): void {
  const payload = buildWorkflowFile(nodes, edges);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workflow-${new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseWorkflowFile(text: string): {
  nodes: Node[];
  edges: Edge[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid file: not valid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid file: expected an object");
  }

  const file = parsed as Partial<WorkflowFileJson> & {
    nodes?: unknown;
    edges?: unknown;
  };

  if (!Array.isArray(file.nodes)) {
    throw new Error("Invalid file: expected a `nodes` array");
  }

  const nodes = file.nodes.map((n, index) => {
    try {
      return jsonToNode(n as WorkflowNodeJson);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "invalid node";
      throw new Error(`Invalid node at index ${index}: ${msg}`);
    }
  });

  const edges = Array.isArray(file.edges) ? (file.edges as Edge[]) : [];

  return { nodes, edges };
}
