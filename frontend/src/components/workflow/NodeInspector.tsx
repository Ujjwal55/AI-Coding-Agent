"use client";

import { useEffect, useRef, useState } from "react";
import type { Node } from "@xyflow/react";
import { getNodeTypeDefinition } from "@/application/nodeRegistry";
import type { NodeExecutionView, NodeMetadata } from "@/domain/types";

interface NodeInspectorProps {
  selectedNode: Node | null;
  executionView: NodeExecutionView | null;
  onUpdateData: (id: string, key: string, value: string) => void;
  fetchMetadata?: () => Promise<Record<string, NodeMetadata>>;
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

function hasLlmTelemetry(meta: NodeMetadata): boolean {
  return Boolean(
    meta.model_name ||
      meta.input_tokens > 0 ||
      meta.output_tokens > 0 ||
      meta.estimated_cost > 0,
  );
}

export default function NodeInspector({
  selectedNode,
  executionView,
  onUpdateData,
  fetchMetadata,
}: NodeInspectorProps) {
  const [metadata, setMetadata] = useState<NodeMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const fetchMetaRef = useRef(fetchMetadata);
  fetchMetaRef.current = fetchMetadata;

  const selectedNodeId = selectedNode?.id ?? null;
  const selectedNodeType = selectedNode
    ? String(selectedNode.data.nodeType || "")
    : "";

  useEffect(() => {
    let mounted = true;
    let isFirstLoad = true;

    if (!selectedNodeId || !selectedNodeType) {
      queueMicrotask(() => {
        if (mounted) {
          setMetadata(null);
          setLoadingMeta(false);
        }
      });
      return () => {
        mounted = false;
      };
    }

    const load = async () => {
      if (!fetchMetaRef.current) return;
      try {
        if (isFirstLoad) setLoadingMeta(true);
        const allMeta = await fetchMetaRef.current();
        if (!mounted) return;
        const nodeMeta = allMeta[selectedNodeType];
        setMetadata(nodeMeta ?? null);
      } catch (e) {
        console.error("Failed to fetch metadata", e);
        if (mounted) setMetadata(null);
      } finally {
        if (mounted && isFirstLoad) {
          setLoadingMeta(false);
          isFirstLoad = false;
        }
      }
    };

    // Clear stale telemetry asynchronously, then poll for this node.
    queueMicrotask(() => {
      if (mounted) setMetadata(null);
    });
    load();
    const interval = setInterval(load, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [selectedNodeId, selectedNodeType]);

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

  const nodeType = selectedNodeType;
  const def = getNodeTypeDefinition(nodeType);
  const fields = def?.configFields ?? ["label"];
  const showLlm = metadata ? hasLlmTelemetry(metadata) : false;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 p-3">
        <h3 className="font-bold text-slate-800">Inspector</h3>
        <p className="text-xs text-slate-500">
          {def?.label ?? nodeType} · Settings & Telemetry
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-3">
        {/* Configuration Section */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase text-slate-400 mb-2 border-b border-slate-100 pb-1">Configuration</h4>
          
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
                value={String(selectedNode.data.model || "gemini-2.5-flash")}
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
              This step has no model settings — it is deterministic or a pass-through gate.
            </p>
          )}
        </div>

        {/* Execution & Telemetry Section */}
        <div className="space-y-4 text-sm pt-2">
          <h4 className="text-xs font-bold uppercase text-slate-400 mb-2 border-b border-slate-100 pb-1">Execution & Telemetry</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded border border-slate-200 bg-slate-50 p-2 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</div>
              <div className="mt-1 font-medium capitalize text-slate-800">
                {executionView?.status ?? "pending"}
              </div>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-2 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</div>
              <div className="mt-1 font-medium text-slate-800">
                {metadata?.execution_time_sec != null && metadata.execution_time_sec > 0
                  ? `${metadata.execution_time_sec}s`
                  : "-"}
              </div>
            </div>
          </div>

          {loadingMeta ? (
            <div className="animate-pulse flex space-x-4 p-4 items-center justify-center">
              <div className="h-4 bg-slate-200 rounded w-24"></div>
            </div>
          ) : showLlm && metadata ? (
            <>
              <Field label="Model">
                <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-800 text-xs font-mono">
                  {metadata.model_name || "Unknown"}
                </div>
              </Field>

              <Field label="Token Usage">
                <div className="rounded border border-slate-200 p-3 bg-white">
                  <div className="flex justify-between mb-1 text-xs text-slate-600">
                    <span>Input: {metadata.input_tokens.toLocaleString()}</span>
                    <span>Output: {metadata.output_tokens.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-blue-500" 
                      style={{ width: `${(metadata.input_tokens / (metadata.input_tokens + metadata.output_tokens + 0.0001)) * 100}%` }}
                    ></div>
                    <div 
                      className="h-full bg-emerald-500" 
                      style={{ width: `${(metadata.output_tokens / (metadata.input_tokens + metadata.output_tokens + 0.0001)) * 100}%` }}
                    ></div>
                  </div>
                  {metadata.cached_tokens > 0 && (
                    <div className="mt-2 text-xs text-slate-500">
                      Cached: {metadata.cached_tokens.toLocaleString()}
                    </div>
                  )}
                </div>
              </Field>

              <Field label="Est. Cost">
                <div className="text-sm font-semibold text-emerald-600">
                  ${metadata.estimated_cost.toFixed(5)}
                </div>
              </Field>

              {metadata.files_touched && metadata.files_touched.length > 0 && (
                <Field label="Files Modified">
                  <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700">
                    {metadata.files_touched.map((f, i) => (
                      <li key={i} className="break-all">{f}</li>
                    ))}
                  </ul>
                </Field>
              )}
            </>
          ) : metadata ? (
            <div className="text-center p-3 text-xs text-slate-500 border border-dashed border-slate-200 rounded">
              Step ran ({metadata.execution_time_sec}s) — no LLM call for this node.
            </div>
          ) : (
            <div className="text-center p-4 text-xs text-slate-500 italic border border-dashed border-slate-200 rounded">
              No telemetry metadata available yet.
            </div>
          )}

          <Field label="Last Message">
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
      </div>
    </aside>
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
