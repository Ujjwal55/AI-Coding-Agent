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
          <p className="text-xs text-slate-500">Select a node to configure</p>
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
          {selectedNode.id} ({nodeType})
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
              <Field label="Model">
                <select
                  value={String(selectedNode.data.model || "gemini-2.5-flash")}
                  onChange={(e) =>
                    onUpdateData(selectedNode.id, "model", e.target.value)
                  }
                  className="w-full rounded border border-slate-300 p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (recommended)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-flash-latest">Gemini Flash Latest</option>
                  <option value="openai/gpt-oss-20b">GPT-OSS 20B (Groq)</option>
                  <option value="openai/gpt-oss-120b">GPT-OSS 120B (Groq)</option>
                  <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Groq)</option>
                  <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Groq)</option>
                </select>
              </Field>
            )}

            {fields.includes("instructions") && (
              <Field label="Instructions">
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
                  placeholder="Implementation details..."
                  className="w-full rounded border border-slate-300 p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
            )}

            {fields.includes("maxRetries") && (
              <Field label="Max Retries">
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

            {fields.includes("command") && (
              <Field label="Command">
                <input
                  type="text"
                  value={String(
                    selectedNode.data.command || "npm run build && npm test",
                  )}
                  onChange={(e) =>
                    onUpdateData(selectedNode.id, "command", e.target.value)
                  }
                  className="w-full rounded border border-slate-300 p-2 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
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
            <Field label="STDOUT">
              <pre className="max-h-48 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-xs text-emerald-300">
                {executionView?.stdout ?? "# No stdout captured (mock)"}
              </pre>
            </Field>
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
      className={`rounded px-2.5 py-1 text-xs font-semibold ${
        active
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}
