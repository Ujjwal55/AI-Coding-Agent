export type InspectorField =
  | "label"
  | "model"
  | "instructions"
  | "maxRetries"
  | "maxPlanRevisions";

export interface NodeTypeDefinition {
  type: string;
  label: string;
  libraryLabel: string;
  configFields: InspectorField[];
}

/**
 * Open/Closed registry: only fields the backend actually reads.
 * - model / instructions → LLM agent nodes (criteria, planner, executor)
 * - maxRetries → Validator (validation retry budget; Decision is optional/legacy)
 * - maxPlanRevisions → Plan Review (replan budget)
 *
 * Code Understanding is folded into Planner by default; Decision routing is
 * owned by Validator. Both remain in the registry for legacy graphs.
 */
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
    configFields: ["label", "model", "instructions"],
  },
  {
    type: "plan_review",
    label: "Plan Review",
    libraryLabel: "Plan Review",
    configFields: ["label", "maxPlanRevisions"],
  },
  {
    type: "executor",
    label: "Executor",
    libraryLabel: "Executor",
    configFields: ["label", "model", "instructions"],
  },
  {
    type: "validator",
    label: "Validator",
    libraryLabel: "Validator",
    configFields: ["label", "maxRetries"],
  },
  {
    type: "decision",
    label: "Decision",
    libraryLabel: "Decision",
    configFields: ["label", "maxRetries"],
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

/** Default palette — hide internals that the simplified loop folds away. */
const HIDDEN_FROM_LIBRARY = new Set(["end", "code_understanding", "decision"]);

export const LIBRARY_NODE_TYPES = NODE_REGISTRY.filter(
  (n) => !HIDDEN_FROM_LIBRARY.has(n.type),
);

export function getNodeTypeDefinition(
  type: string,
): NodeTypeDefinition | undefined {
  return NODE_REGISTRY.find((n) => n.type === type);
}
