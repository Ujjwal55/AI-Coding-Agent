export type InspectorField =
  | "label"
  | "model"
  | "instructions"
  | "maxRetries"
  | "command";

export interface NodeTypeDefinition {
  type: string;
  label: string;
  libraryLabel: string;
  configFields: InspectorField[];
}

/** Open/Closed registry: add a node type here instead of editing every panel. */
export const NODE_REGISTRY: NodeTypeDefinition[] = [
  {
    type: "objective",
    label: "Objective",
    libraryLabel: "Objective",
    configFields: ["label"],
  },
  {
    type: "criteria",
    label: "Criteria",
    libraryLabel: "Criteria",
    configFields: ["label", "model", "instructions"],
  },
  {
    type: "code_understanding",
    label: "Code Understanding",
    libraryLabel: "Code Understanding",
    configFields: ["label", "model"],
  },
  {
    type: "planner",
    label: "Planner",
    libraryLabel: "Planner",
    configFields: ["label", "model", "instructions", "maxRetries"],
  },
  {
    type: "plan_review",
    label: "Plan Review",
    libraryLabel: "Plan Review",
    configFields: ["label"],
  },
  {
    type: "executor",
    label: "Executor",
    libraryLabel: "Executor",
    configFields: ["label", "model", "instructions", "maxRetries", "command"],
  },
  {
    type: "validator",
    label: "Validator",
    libraryLabel: "Validator",
    configFields: ["label", "model", "instructions", "maxRetries"],
  },
  {
    type: "decision",
    label: "Decision",
    libraryLabel: "Decision",
    configFields: ["label"],
  },
  {
    type: "human_gate",
    label: "Human Gate",
    libraryLabel: "Human Gate",
    configFields: ["label"],
  },
  {
    type: "end",
    label: "End",
    libraryLabel: "End",
    configFields: ["label"],
  },
];

export const LIBRARY_NODE_TYPES = NODE_REGISTRY.filter(
  (n) => n.type !== "end",
);

export function getNodeTypeDefinition(
  type: string,
): NodeTypeDefinition | undefined {
  return NODE_REGISTRY.find((n) => n.type === type);
}
