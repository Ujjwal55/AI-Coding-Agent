"use client";

import { useState } from "react";
import type { Node } from "@xyflow/react";
import { getNodeTypeDefinition } from "@/application/nodeRegistry";
import type { NodeExecutionView } from "@/domain/types";

interface NodeInspectorProps {
  selectedNode: Node | null;
  executionView: NodeExecutionView | null;
  onUpdateData: (id: string, key: string, value: string) => void;
}

const MODEL_OPTIONS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (recommended)" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-flash-latest", label: "Gemini Flash Latest" },
  { value: "openai/gpt-oss-20b", label: "GPT-OSS 20B (Groq)" },
  { value: "openai/gpt-oss-120b", label: "GPT-OSS 120B (Groq)" },
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)" },
  { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant (Groq)" },
];

export default function NodeInspector({
  selectedNode,
  executionView,
  onUpdateData,
}: NodeInspectorProps) {
  const [tab, setTab] = useState<"config" | "execution">("config");

  if (!selectedNode) {
    return (
      <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 p-3">
          <h3 className="font-bold text-slate-800">Inspector</h3>
          <p className="text-xs text-slate-500">
            Select a node to configure its model / instructions
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-slate-400">
          No node selected
        </div>
      </aside>
    );
  }

  const nodeType = String(selectedNode.data.nodeType || "");
  const def = getNodeTypeDefinition(nodeType);
  const fields = def?.configFields ?? ["label"];

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 p-3">
        <h3 className="font-bold text-slate-800">Inspector</h3>
        <p className="text-xs text-slate-500">
          {def?.label ?? nodeType} · per-node settings used at Run
        </p>
        <div className="mt-2 flex gap-1">
          <TabButton
            active={tab === "config"}
            onClick={() => setTab("config")}
            label="Config"
          />
          <TabButton
            active={tab === "execution"}
            onClick={() => setTab("execution")}
            label="Execution"
          />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {tab === "config" ? (
          <>
            {fields.includes("label") && (
              <Field label="Label">
                <input
                  type="text"
                  value={String(selectedNode.data.label || "")}
                  onChange={(e) =>
                    onUpdateData(selectedNode.id, "label", e.target.value)
                  }
                  className="w-full rounded border border-slate-300 p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
            )}

            {fields.includes("model") && (
              <Field
                label="Model"
                hint="This node’s LLM only. Other agents keep their own model."
              >
                <select
                  value={String(selectedNode.data.model || "gemini-3.1-flash-lite")}
                  onChange={(e) =>
                    onUpdateData(selectedNode.id, "model", e.target.value)
                  }
                  className="w-full rounded border border-slate-300 p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {fields.includes("instructions") && (
              <Field
                label="Instructions"
                hint="Extra system guidance for this agent only."
              >
                <textarea
                  rows={5}
                  value={String(selectedNode.data.instructions || "")}
                  onChange={(e) =>
                    onUpdateData(
                      selectedNode.id,
                      "instructions",
                      e.target.value,
                    )
                  }
                  placeholder="e.g. Prefer a single Python file; include a small demo."
                  className="w-full rounded border border-slate-300 p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
            )}

            {fields.includes("maxRetries") && (
              <Field
                label="Max Retries"
                hint="How many times Decision may send FAIL back to the planner."
              >
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={String(selectedNode.data.maxRetries || "3")}
                  onChange={(e) =>
                    onUpdateData(selectedNode.id, "maxRetries", e.target.value)
                  }
                  className="w-full rounded border border-slate-300 p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
            )}

            {fields.includes("maxPlanRevisions") && (
              <Field
                label="Max Plan Revisions"
                hint="How many times Plan Review may send feedback to the planner."
              >
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={String(selectedNode.data.maxPlanRevisions || "3")}
                  onChange={(e) =>
                    onUpdateData(
                      selectedNode.id,
                      "maxPlanRevisions",
                      e.target.value,
                    )
                  }
                  className="w-full rounded border border-slate-300 p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
            )}

            {fields.length <= 1 && fields[0] === "label" && (
              <p className="text-xs text-slate-500">
                This step has no model settings — it is deterministic or a
                pass-through gate.
              </p>
            )}
          </>
        ) : (
          <div className="space-y-3 text-sm">
            <Field label="Status">
              <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 font-medium capitalize text-slate-800">
                {executionView?.status ?? "pending"}
              </p>
            </Field>
            <Field label="Last message">
              <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-700">
                {executionView?.lastMessage ?? "No execution data yet"}
              </p>
            </Field>
            {executionView?.stdout && (
              <Field label="Output">
                <pre className="max-h-48 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-xs text-emerald-300">
                  {executionView.stdout}
                </pre>
              </Field>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2.5 py-1 text-xs font-semibold ${active
        ? "bg-blue-600 text-white"
        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
        }`}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase text-slate-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
