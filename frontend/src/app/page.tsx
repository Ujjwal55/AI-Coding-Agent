"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import {
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import { HttpWorkflowAdapter } from "@/adapters/http/HttpWorkflowAdapter";
import { MockRunEventsAdapter } from "@/adapters/mock/MockRunEventsAdapter";
import { usePrepareMission } from "@/application/usePrepareMission";
import { useWorkflowRun } from "@/application/useWorkflowRun";
import {
  projectConsoleLines,
  projectNodeExecution,
  projectNodeStatuses,
  projectTimeline,
} from "@/application/projectRunView";
import type { MissionState, UiEvent } from "@/domain/types";
import MissionBar from "@/components/mission/MissionBar";
import NodeLibrary from "@/components/workflow/NodeLibrary";
import WorkflowCanvas from "@/components/workflow/WorkflowCanvas";
import NodeInspector from "@/components/workflow/NodeInspector";
import RunConsole from "@/components/control/RunConsole";
import RunTimeline from "@/components/control/RunTimeline";
import PlanReviewPanel from "@/components/control/PlanReviewPanel";
import CodeReviewPanel from "@/components/control/CodeReviewPanel";

const NODE_X = 320;
const NODE_GAP = 84;
const stack = (i: number) => ({ x: NODE_X, y: 40 + i * NODE_GAP });
const initialNodes: Node[] = [
  { id: "objective", position: stack(0), data: { label: "Feature Request", nodeType: "objective", status: "pending" }, type: "custom" },
  { id: "criteria", position: stack(1), data: { label: "Define Criteria", nodeType: "criteria", status: "pending" }, type: "custom" },
  { id: "code_understanding", position: stack(2), data: { label: "Understand Repo", nodeType: "code_understanding", status: "pending" }, type: "custom" },
  { id: "planner", position: stack(3), data: { label: "Create Plan", nodeType: "planner", status: "pending" }, type: "custom" },
  { id: "plan_review", position: stack(4), data: { label: "Review Plan", nodeType: "plan_review", status: "pending" }, type: "custom" },
  { id: "executor", position: stack(5), data: { label: "Write Code", nodeType: "executor", status: "pending" }, type: "custom" },
  { id: "validator", position: stack(6), data: { label: "Validate", nodeType: "validator", status: "pending" }, type: "custom" },
  { id: "decision", position: stack(7), data: { label: "Evaluate", nodeType: "decision", status: "pending" }, type: "custom" },
  { id: "human_approval", position: stack(8), data: { label: "Review Code", nodeType: "human_gate", status: "pending" }, type: "custom" },
  { id: "end", position: stack(9), data: { label: "Merged", nodeType: "end", status: "pending" }, type: "custom" },
];

const initialEdges: Edge[] = [
  { id: "e-obj-crit", source: "objective", target: "criteria" },
  { id: "e-crit-cu", source: "criteria", target: "code_understanding" },
  { id: "e-cu-plan", source: "code_understanding", target: "planner" },
  { id: "e-plan-pr", source: "planner", target: "plan_review" },
  { id: "e-pr-exec", source: "plan_review", target: "executor" },
  { id: "e-pr-plan", source: "plan_review", target: "planner", type: "smoothstep" },
  { id: "e-exec-val", source: "executor", target: "validator" },
  { id: "e-val-dec", source: "validator", target: "decision" },
  { id: "e-dec-hg", source: "decision", target: "human_approval" },
  { id: "e-dec-plan", source: "decision", target: "planner", type: "smoothstep" },
  { id: "e-hg-end", source: "human_approval", target: "end" },
  { id: "e-hg-plan", source: "human_approval", target: "planner", type: "smoothstep" },
];

/** Composition root: construct adapters once and inject ports. */
const workflowApi = new HttpWorkflowAdapter();
const eventsPort = new MockRunEventsAdapter();

// Directories we never want to include when zipping an uploaded repo.
const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "venv",
  ".venv",
  "__pycache__",
  ".turbo",
  "coverage",
  ".cache",
]);
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB per file
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB total

async function zipSelectedFolder(
  files: FileList,
): Promise<{ blob: Blob; count: number } | { error: string }> {
  const zip = new JSZip();
  let count = 0;
  let total = 0;

  for (const file of Array.from(files)) {
    const rel = file.webkitRelativePath || file.name;
    const parts = rel.split("/");
    // Strip the top-level selected folder so files sit at the workspace root.
    const stripped = parts.length > 1 ? parts.slice(1).join("/") : rel;
    if (!stripped) continue;
    if (stripped.split("/").some((seg) => IGNORE_DIRS.has(seg))) continue;
    if (file.size > MAX_FILE_BYTES) continue;
    total += file.size;
    if (total > MAX_TOTAL_BYTES) {
      return {
        error: "Repository is too large after filtering (>50MB). Try a smaller repo.",
      };
    }
    zip.file(stripped, file);
    count++;
  }

  if (count === 0) return { error: "No files found to upload after filtering." };
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
  });
  return { blob, count };
}

export default function ControlPlanePage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [events, setEvents] = useState<UiEvent[]>([]);
  const [mission, setMission] = useState<MissionState>({
    objective: "",
    repoPath: null,
    attachments: [],
    prepared: false,
    workspaceId: null,
    fileTree: [],
    uploading: false,
  });

  const { prepare } = usePrepareMission(eventsPort);
  const {
    runStatus,
    pauseReason,
    currentPlan,
    planRevision,
    codeChangesSummary,
    lastError,
    isBusy,
    isGraphLocked,
    startRun,
    approvePlan,
    sendPlanFeedback,
    approveCode,
    requestCodeChanges,
    cancelLocal,
  } = useWorkflowRun({ workflowApi, eventsPort });

  useEffect(() => eventsPort.subscribe(setEvents), []);

  const nodeStatuses = useMemo(
    () => projectNodeStatuses(events, nodes.map((n) => n.id)),
    [events, nodes],
  );

  const nodesWithStatus = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          status: nodeStatuses[node.id] ?? "pending",
        },
      })),
    [nodes, nodeStatuses],
  );

  const timelineSteps = useMemo(
    () =>
      projectTimeline(
        events,
        nodes.map((n) => ({ id: n.id, label: String(n.data.label || n.id) })),
      ),
    [events, nodes],
  );

  const consoleLines = useMemo(() => projectConsoleLines(events), [events]);

  const selectedNode = nodesWithStatus.find((n) => n.selected) ?? null;
  const executionView = selectedNode
    ? projectNodeExecution(events, selectedNode.id)
    : null;

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onDragStart = (
    event: React.DragEvent,
    nodeType: string,
    label: string,
  ) => {
    event.dataTransfer.setData(
      "application/reactflow",
      JSON.stringify({ nodeType, label }),
    );
    event.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!reactFlowInstance || isGraphLocked) return;

      const typeData = event.dataTransfer.getData("application/reactflow");
      if (!typeData) return;

      const { nodeType, label } = JSON.parse(typeData) as {
        nodeType: string;
        label: string;
      };

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${nodeType}-${Date.now()}`,
        type: "custom",
        position,
        data: { label, nodeType, status: "pending" },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, isGraphLocked],
  );

  const updateNodeData = (id: string, key: string, value: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n,
      ),
    );
  };

  const handlePrepare = () => {
    const result = prepare(mission, nodes);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    setMission(result.nextMission);
    setNodes(result.nextNodes);
  };

  const handleUploadFolder = async (files: FileList) => {
    setMission((m) => ({ ...m, uploading: true, prepared: false }));
    const result = await zipSelectedFolder(files);
    if ("error" in result) {
      alert(result.error);
      setMission((m) => ({ ...m, uploading: false }));
      return;
    }
    try {
      const { workspace_id, file_tree } = await workflowApi.uploadRepo(
        result.blob,
        "workspace.zip",
      );
      setMission((m) => ({
        ...m,
        uploading: false,
        workspaceId: workspace_id,
        fileTree: file_tree,
      }));
      eventsPort.append({
        runId: null,
        eventType: "prepared",
        nodeId: null,
        message: `Uploaded repo: ${result.count} files → workspace ${workspace_id.slice(0, 8)}`,
      });
    } catch (error) {
      alert(
        `Upload failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      setMission((m) => ({ ...m, uploading: false }));
    }
  };

  const handleRun = async () => {
    if (!mission.prepared) {
      alert("Prepare the mission before Run.");
      return;
    }
    await startRun(nodes, edges, {
      objective: mission.objective,
      workspaceId: mission.workspaceId,
      maxPlanRevisions: 3,
    });
  };

  const handleCancel = () => {
    cancelLocal();
    eventsPort.reset();
  };

  const downloadUrl = mission.workspaceId
    ? workflowApi.downloadUrl(mission.workspaceId)
    : null;

  const isPaused = runStatus === "paused";

  return (
    <div className="flex h-screen w-full flex-col bg-slate-100">
      <MissionBar
        mission={mission}
        runStatus={runStatus}
        isBusy={isBusy}
        onObjectiveChange={(value) =>
          setMission((m) => ({ ...m, objective: value, prepared: false }))
        }
        onUploadFolder={handleUploadFolder}
        onPrepare={handlePrepare}
        onRun={handleRun}
      />

      {lastError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {lastError}
        </div>
      )}

      <div className="flex min-h-0 flex-[1.6]">
        <NodeLibrary locked={isGraphLocked} onDragStart={onDragStart} />
        <WorkflowCanvas
          nodes={nodesWithStatus}
          edges={edges}
          locked={isGraphLocked}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
        />
        <NodeInspector
          selectedNode={selectedNode}
          executionView={executionView}
          onUpdateData={updateNodeData}
        />
      </div>

      <div className="flex h-72 shrink-0 border-t border-slate-300 bg-white">
        <RunConsole
          lines={consoleLines}
          runStatus={runStatus}
          onCancel={handleCancel}
        />
        <RunTimeline steps={timelineSteps} />
        {pauseReason === "code_review" ? (
          <CodeReviewPanel
            key={`code-${planRevision}`}
            isOpen={isPaused}
            summary={codeChangesSummary}
            downloadUrl={downloadUrl}
            onApprove={approveCode}
            onRequestChanges={requestCodeChanges}
            isBusy={isBusy}
          />
        ) : (
          <PlanReviewPanel
            key={`plan-${planRevision}`}
            isOpen={isPaused && pauseReason === "plan_review"}
            plan={currentPlan}
            planRevision={planRevision}
            onApprove={approvePlan}
            onSendFeedback={sendPlanFeedback}
            isBusy={isBusy}
          />
        )}
      </div>
    </div>
  );
}