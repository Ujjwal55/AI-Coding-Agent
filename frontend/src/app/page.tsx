"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import ResultPanel from "@/components/control/ResultPanel";
import HumanGatePanel from "@/components/control/HumanGatePanel";
import {
  downloadWorkflowFile,
  parseWorkflowFile,
} from "@/utils/nodeConverter";

const NODE_X = 320;
const NODE_GAP = 84;
const stack = (i: number) => ({ x: NODE_X, y: 40 + i * NODE_GAP });
const initialNodes: Node[] = [
  { id: "objective", position: stack(0), data: { label: "Feature Request", nodeType: "objective", status: "pending" }, type: "custom" },
  { id: "criteria", position: stack(1), data: { label: "Define Criteria", nodeType: "criteria", status: "pending" }, type: "custom" },
  { id: "planner", position: stack(2), data: { label: "Create Plan", nodeType: "planner", status: "pending" }, type: "custom" },
  { id: "plan_review", position: stack(3), data: { label: "Review Plan", nodeType: "plan_review", status: "pending" }, type: "custom" },
  { id: "executor", position: stack(4), data: { label: "Write Code", nodeType: "executor", status: "pending" }, type: "custom" },
  { id: "validator", position: stack(5), data: { label: "Validate", nodeType: "validator", status: "pending", maxRetries: "3" }, type: "custom" },
  { id: "human_approval", position: stack(6), data: { label: "Review Code", nodeType: "human_gate", status: "pending" }, type: "custom" },
  { id: "end", position: stack(7), data: { label: "Task Successful", nodeType: "end", status: "pending" }, type: "custom" },
];

const initialEdges: Edge[] = [
  { id: "e-obj-crit", source: "objective", target: "criteria" },
  { id: "e-crit-plan", source: "criteria", target: "planner" },
  { id: "e-plan-pr", source: "planner", target: "plan_review" },
  { id: "e-pr-exec", source: "plan_review", target: "executor" },
  { id: "e-pr-plan", source: "plan_review", target: "planner", type: "smoothstep" },
  { id: "e-exec-val", source: "executor", target: "validator" },
  { id: "e-val-hg", source: "validator", target: "human_approval" },
  { id: "e-val-plan", source: "validator", target: "planner", type: "smoothstep" },
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
  const JSZip = (await import("jszip")).default;
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

  // Empty folders (or folders that only contained ignored paths like .git) are allowed.
  // Create a valid empty zip so the backend can still allocate a workspace_id.
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
  });
  return { blob, count };
}

/** Build an empty workspace zip (no source files). */
async function zipEmptyWorkspace(): Promise<{ blob: Blob; count: number }> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
  });
  return { blob, count: 0 };
}

export default function ControlPlanePage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [events, setEvents] = useState<UiEvent[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
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
    successCriteria,
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

  const [consoleExpanded, setConsoleExpanded] = useState(false);

  useEffect(() => {
    const unsub = eventsPort.subscribe(setEvents);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const eventSource = new EventSource(`${API_BASE}/api/workflows/logs/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "node_status") {
          const eventType =
            data.status === "in_progress" ? "node_started" :
            data.status === "completed" ? "node_completed" :
            data.status === "failed" ? "error" : "node_completed";

          eventsPort.append({
            runId: null,
            eventType,
            nodeId: data.node_id,
            message: `${data.label || data.node_type || data.node_id}: ${String(data.status).toUpperCase()}`,
            payload: data.output || data.error ? { output: data.output, error: data.error } : null,
          });
        } else if (data.message) {
          eventsPort.append({
            runId: null,
            eventType: data.level === "ERROR" || data.level === "CRITICAL" ? "error" : "node_started",
            nodeId: null,
            message: `[${data.level || "INFO"}] ${data.message}`,
            payload: data.extra || null,
          });
        }
      } catch (err) {
        console.error("Error parsing SSE event:", err);
      }
    };

    return () => {
      unsub();
      eventSource.close();
    };
  }, []);

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

  const handleAddNode = useCallback(
    (nodeType: string, label: string) => {
      if (isGraphLocked) return;
      setNodes((nds) => {
        const lastNode = nds[nds.length - 1];
        const newY = lastNode ? lastNode.position.y + 84 : 100;
        const newNode: Node = {
          id: `${nodeType}-${Date.now()}`,
          type: "custom",
          position: { x: NODE_X, y: newY },
          data: { label, nodeType, status: "pending" },
        };
        return nds.concat(newNode);
      });
    },
    [isGraphLocked, setNodes],
  );

  // Dynamic vertical resizer for bottom panel (Run Console, Step Timeline & Review Panels)
  const [bottomHeight, setBottomHeight] = useState(280);
  const [consoleWidth, setConsoleWidth] = useState(350);
  const [reviewWidth, setReviewWidth] = useState(350);
  const effectiveBottomHeight = consoleExpanded
    ? Math.max(bottomHeight, 480)
    : bottomHeight;

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.min(Math.max(startHeight + deltaY, 140), 650);
      setBottomHeight(newHeight);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleConsoleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = consoleWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = startWidth + deltaX;
      const maxWidth = document.body.clientWidth - reviewWidth - 300;
      setConsoleWidth(Math.min(Math.max(newWidth, 200), maxWidth));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleReviewResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = reviewWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newWidth = startWidth + deltaX;
      const maxWidth = document.body.clientWidth - consoleWidth - 300;
      setReviewWidth(Math.min(Math.max(newWidth, 250), maxWidth));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

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
        message:
          result.count === 0
            ? `Uploaded empty workspace → ${workspace_id.slice(0, 8)} (no source files after filtering; agents can create files here)`
            : `Uploaded repo: ${result.count} files → workspace ${workspace_id.slice(0, 8)}`,
      });
    } catch (error) {
      alert(
        `Upload failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      setMission((m) => ({ ...m, uploading: false }));
    }
  };

  const handleEmptyWorkspace = async () => {
    setMission((m) => ({ ...m, uploading: true, prepared: false }));
    try {
      const result = await zipEmptyWorkspace();
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
        message: `Created empty workspace → ${workspace_id.slice(0, 8)}`,
      });
    } catch (error) {
      alert(
        `Failed to create empty workspace: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      setMission((m) => ({ ...m, uploading: false }));
    }
  };

  const handleExport = () => {
    downloadWorkflowFile(nodes, edges);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseWorkflowFile(text);
      setNodes(parsed.nodes);
      setEdges(parsed.edges);
      setImportError(null);
      eventsPort.append({
        runId: null,
        eventType: "run_started",
        nodeId: null,
        message: `Imported workflow from ${file.name} (${parsed.nodes.length} nodes)`,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to import workflow file";
      setImportError(message);
    }
  };

  const handleRun = async () => {
    if (!mission.objective.trim()) {
      alert("Enter an objective before Run.");
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

  // After a successful run, refresh the workspace file list so ResultPanel can browse it.
  useEffect(() => {
    if (runStatus !== "completed" || !mission.workspaceId) return;
    let cancelled = false;
    workflowApi
      .getWorkspaceTree(mission.workspaceId)
      .then((res) => {
        if (!cancelled) {
          setMission((m) => ({ ...m, fileTree: res.file_tree }));
        }
      })
      .catch(() => {
        /* keep previous tree */
      });
    return () => {
      cancelled = true;
    };
  }, [runStatus, mission.workspaceId]);

  const isPaused = runStatus === "paused";
  const isCompleted = runStatus === "completed";

  return (
    <div className="flex h-screen w-full flex-col bg-slate-100">
      <MissionBar
        mission={mission}
        runStatus={runStatus}
        isBusy={isBusy}
        importError={importError}
        onObjectiveChange={(value) =>
          setMission((m) => ({ ...m, objective: value }))
        }
        onUploadFolder={handleUploadFolder}
        onEmptyWorkspace={handleEmptyWorkspace}
        onExport={handleExport}
        onImportFile={handleImportFile}
        onPrepare={handlePrepare}
        onRun={handleRunOrResume}
        onPause={pauseLocal}
        onRestart={handleRestart}
      />

      {lastError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {lastError}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <NodeLibrary
          locked={isGraphLocked}
          onDragStart={onDragStart}
          onAddNode={handleAddNode}
        />
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
          fetchMetadata={workflowApi.fetchMetadata.bind(workflowApi)}
        />
      </div>

      {/* Resizable Bottom Control Panel (Run Console, Step Timeline & Review Panels) */}
      <div
        style={{ height: `${effectiveBottomHeight}px` }}
        className="relative flex shrink-0 border-t border-slate-300 bg-white shadow-lg"
      >
        {/* Top Resize Drag Handle */}
        <div
          onMouseDown={handleMouseDownResize}
          className="absolute -top-2 inset-x-0 h-4 cursor-ns-resize z-30 group flex items-center justify-center transition-colors"
          title="Drag vertically to resize console and review panels"
        >
          <div className="h-1.5 w-16 rounded-full bg-slate-300 group-hover:bg-sky-500 group-hover:w-24 transition-all shadow-sm" />
        </div>

        <div style={{ width: consoleWidth }} className="shrink-0 flex h-full">
          <RunConsole
            lines={consoleLines}
            runStatus={runStatus}
            expanded={consoleExpanded}
            onToggleExpand={() => setConsoleExpanded((v) => !v)}
          />
        </div>

        {/* Left Resize Drag Handle (Console) */}
        <div
          onMouseDown={handleConsoleResize}
          className="absolute bottom-0 top-0 cursor-col-resize z-30 group flex items-center justify-center transition-colors"
          style={{ left: consoleWidth - 4, width: "8px" }}
          title="Drag horizontally to resize console"
        >
          <div className="w-1.5 h-16 rounded-full bg-slate-300 group-hover:bg-sky-500 transition-all shadow-sm" />
        </div>

        <div className="flex-1 min-w-[300px] flex h-full overflow-hidden">
          <RunTimeline steps={timelineSteps} />
        </div>

        {/* Right Resize Drag Handle (Review) */}
        <div
          onMouseDown={handleReviewResize}
          className="absolute bottom-0 top-0 cursor-col-resize z-30 group flex items-center justify-center transition-colors"
          style={{ right: reviewWidth - 4, width: "8px" }}
          title="Drag horizontally to resize review panel"
        >
          <div className="w-1.5 h-16 rounded-full bg-slate-300 group-hover:bg-sky-500 transition-all shadow-sm" />
        </div>

        <div style={{ width: reviewWidth }} className="shrink-0 flex h-full">
          {isCompleted ? (
            <ResultPanel
              isOpen
              summary={codeChangesSummary}
              downloadUrl={downloadUrl}
              fileTree={mission.fileTree}
              onOpenFile={async (path) => {
                if (!mission.workspaceId) {
                  throw new Error("No workspace uploaded");
                }
                return workflowApi.getWorkspaceFile(mission.workspaceId, path);
              }}
            />
          ) : pauseReason === "code_review" ? (
            <CodeReviewPanel
              key={`code-${planRevision}`}
              isOpen={isPaused}
              summary={codeChangesSummary}
              downloadUrl={downloadUrl}
              onApprove={approveCode}
              onRequestChanges={requestCodeChanges}
              isBusy={isBusy}
            />
          ) : pauseReason === "plan_review" ? (
            <PlanReviewPanel
              key={`plan-${planRevision}`}
              isOpen={isPaused}
              plan={currentPlan}
              planRevision={planRevision}
              onApprove={approvePlan}
              onSendFeedback={sendPlanFeedback}
              isBusy={isBusy}
            />
          ) : (
            <HumanGatePanel
              key={`gate-${successCriteria.join("|")}-${pauseReason}`}
              isOpen={isPaused && pauseReason === "criteria_review"}
              initialCriteria={
                successCriteria.length > 0
                  ? successCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")
                  : ""
              }
              onApprove={(text) => approveCriteria(text)}
              isBusy={isBusy}
            />
          )}
        </div>
      </div>
    </div>
  );
}