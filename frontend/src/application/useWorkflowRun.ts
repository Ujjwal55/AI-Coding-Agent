"use client";

import { useCallback, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { RunStatus, WorkflowRunRecord } from "@/domain/types";
import type { RunEventsPort } from "@/ports/RunEventsPort";
import type { WorkflowApiPort } from "@/ports/WorkflowApiPort";

interface UseWorkflowRunOptions {
  workflowApi: WorkflowApiPort;
  eventsPort: RunEventsPort;
}

export function useWorkflowRun({
  workflowApi,
  eventsPort,
}: UseWorkflowRunOptions) {
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [pausedRunId, setPausedRunId] = useState<string | null>(null);
  const [editingCriteria, setEditingCriteria] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const applyRunResult = useCallback(
    (runData: WorkflowRunRecord, nodeIds: string[]) => {
      if (runData.status === "paused") {
        setRunStatus("paused");
        setPausedRunId(runData.id);
        const criteriaList = (runData.state_json?.success_criteria as
          | string[]
          | undefined) || [];
        setEditingCriteria(criteriaList.join("\n"));
        eventsPort.append({
          runId: runData.id,
          eventType: "approval_requested",
          nodeId: "criteria",
          message: "Criteria change requested. Please review and approve to continue.",
          payload: { success_criteria: criteriaList },
        });
        return;
      }

      setPausedRunId(null);
      setRunStatus(runData.status === "failed" ? "failed" : "completed");
      eventsPort.append({
        runId: runData.id,
        eventType: runData.status === "failed" ? "error" : "run_completed",
        nodeId: nodeIds[nodeIds.length - 1] ?? null,
        message: `Run finished with status: ${runData.status}`,
      });
    },
    [eventsPort],
  );

  const startRun = useCallback(
    async (nodes: Node[], edges: Edge[]) => {
      setIsBusy(true);
      setLastError(null);
      setRunStatus("running");
      const nodeIds = nodes.map((n) => n.id);

      try {
        const wf = await workflowApi.createWorkflow({
          name: "UI Generated Workflow",
          description: "Created from canvas",
        });
        const version = await workflowApi.saveVersion(wf.id, { nodes, edges });
        eventsPort.seedDemoRun(version.id, nodeIds);
        const runData = await workflowApi.run(version.id);
        console.log("LangGraph Execution Result:", runData);
        applyRunResult(runData, nodeIds);
        return runData;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to run. Is the FastAPI backend running?";
        setLastError(message);
        setRunStatus("failed");
        eventsPort.append({
          runId: null,
          eventType: "error",
          nodeId: null,
          message,
        });
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [workflowApi, eventsPort, applyRunResult],
  );

  const resumeRun = useCallback(
    async (stateUpdates?: Record<string, unknown>) => {
      if (!pausedRunId) return null;
      setIsBusy(true);
      setLastError(null);
      setRunStatus("running");

      try {
        const runData = await workflowApi.resume(pausedRunId, stateUpdates);
        console.log("Resumed LangGraph Result:", runData);
        applyRunResult(runData, []);
        return runData;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Resume failed";
        setLastError(message);
        setRunStatus("paused");
        eventsPort.append({
          runId: pausedRunId,
          eventType: "error",
          nodeId: null,
          message,
        });
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [pausedRunId, workflowApi, eventsPort, applyRunResult],
  );

  const cancelLocal = useCallback(() => {
    eventsPort.append({
      runId: pausedRunId,
      eventType: "run_cancelled",
      nodeId: null,
      message: "Run cancelled locally (no backend cancel yet)",
    });
    setPausedRunId(null);
    setEditingCriteria("");
    setRunStatus("idle");
    setLastError(null);
  }, [eventsPort, pausedRunId]);

  const isGraphLocked =
    runStatus === "running" || runStatus === "paused" || isBusy;

  return {
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
  };
}
