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
import HumanGatePanel from "@/components/control/HumanGatePanel";

const initialNodes: Node[] = [
  {
    id: "objective",
    position: { x: 250, y: 50 },
    data: { label: "Feature Request", nodeType: "objective", status: "pending" },
    type: "custom",
  },
  {
    id: "criteria",
    position: { x: 250, y: 150 },
    data: { label: "Define Criteria", nodeType: "criteria", status: "pending" },
    type: "custom",
  },
  {
    id: "planner",
    position: { x: 250, y: 250 },
    data: { label: "Create Plan", nodeType: "planner", status: "pending" },
    type: "custom",
  },
  {
    id: "executor",
    position: { x: 250, y: 350 },
    data: { label: "Write Code", nodeType: "executor", status: "pending" },
    type: "custom",
  },
  {
    id: "validator",
    position: { x: 250, y: 450 },
    data: { label: "Run Tests", nodeType: "validator", status: "pending" },
    type: "custom",
  },
  {
    id: "decision",
    position: { x: 250, y: 550 },
    data: { label: "Evaluate", nodeType: "decision", status: "pending" },
    type: "custom",
  },
  {
    id: "human_approval",
    position: { x: 250, y: 650 },
    data: { label: "Review PR", nodeType: "human_gate", status: "pending" },
    type: "custom",
  },
  {
    id: "end",
    position: { x: 250, y: 750 },
    data: { label: "Merged", nodeType: "end", status: "pending" },
    type: "custom",
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "objective", target: "criteria" },
  { id: "e2-3", source: "criteria", target: "planner" },
  { id: "e3-4", source: "planner", target: "executor" },
  { id: "e4-5", source: "executor", target: "validator" },
  { id: "e5-6", source: "validator", target: "decision" },
  { id: "e6-7", source: "decision", target: "human_approval" },
  {
    id: "e6-3",
    source: "decision",
    target: "planner",
    type: "smoothstep",
  },
  { id: "e7-8", source: "human_approval", target: "end" },
];

/** Composition root: construct adapters once and inject ports. */
const workflowApi = new HttpWorkflowAdapter();
const eventsPort = new MockRunEventsAdapter();

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
  });

  const { prepare } = usePrepareMission(eventsPort);
  const {
    runStatus,
    pausedRunId,
    editingCriteria,
    setEditingCriteria,
    lastError,
    isBusy,
    isGraphLocked,
    startRun,
    resumeRun,
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
        nodes.map((n) => ({
          id: n.id,
          label: String(n.data.label || n.id),
        })),
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

  const handleAttachFile = () => {
    const name = window.prompt("Attachment file name (mock)", "spec.md");
    if (!name?.trim()) return;
    setMission((m) => ({
      ...m,
      attachments: [...m.attachments, name.trim()],
      prepared: false,
    }));
  };

  const handleSelectRepo = () => {
    const path = window.prompt("Repo path (mock)", "target_repo");
    if (!path?.trim()) return;
    setMission((m) => ({
      ...m,
      repoPath: path.trim(),
      prepared: false,
    }));
  };

  const handleRun = async () => {
    if (!mission.prepared) {
      alert("Prepare the mission before Run.");
      return;
    }
    await startRun(nodes, edges);
  };

  const handleApprove = async () => {
    await resumeRun({
      success_criteria: editingCriteria
        .split("\n")
        .map((c) => c.trim())
        .filter(Boolean),
    });
  };

  const handleCancel = () => {
    cancelLocal();
    eventsPort.reset();
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-100">
      <MissionBar
        mission={mission}
        runStatus={runStatus}
        isBusy={isBusy}
        onObjectiveChange={(value) =>
          setMission((m) => ({ ...m, objective: value, prepared: false }))
        }
        onAttachFile={handleAttachFile}
        onSelectRepo={handleSelectRepo}
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

      <div className="flex h-56 shrink-0 border-t border-slate-300 bg-white">
        <RunConsole
          lines={consoleLines}
          runStatus={runStatus}
          onCancel={handleCancel}
        />
        <RunTimeline steps={timelineSteps} />
        <HumanGatePanel
          isOpen={Boolean(pausedRunId)}
          criteriaText={editingCriteria}
          onCriteriaChange={setEditingCriteria}
          onApprove={handleApprove}
          isBusy={isBusy}
        />
      </div>
    </div>
  );
}
