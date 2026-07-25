"use client";

import { useCallback, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import type {
  LlmUsage,
  PauseReason,
  RunStatus,
  WorkflowRunRecord,
} from "@/domain/types";
import type { RunEventsPort } from "@/ports/RunEventsPort";
import type {
  ResumeOptions,
  RunOptions,
  WorkflowApiPort,
} from "@/ports/WorkflowApiPort";

interface UseWorkflowRunOptions {
  workflowApi: WorkflowApiPort;
  eventsPort: RunEventsPort;
}

/** Node types considered "done" once the run pauses at a given gate. */
const COMPLETED_BEFORE: Record<string, string[]> = {
  criteria_review: ["objective"],
  plan_review: ["objective", "criteria", "planner"],
  code_review: [
    "objective",
    "criteria",
    "planner",
    "plan_review",
    "executor",
    "validator",
  ],
};

const WAITING_NODE: Record<string, string> = {
  criteria_review: "criteria",
  plan_review: "plan_review",
  code_review: "human_gate",
};

function idsByTypes(nodes: Node[], types: string[]): Node[] {
  const order = new Map(types.map((t, i) => [t, i]));
  return nodes
    .filter((n) => order.has(String(n.data?.nodeType)))
    .sort(
      (a, b) =>
        (order.get(String(a.data?.nodeType)) ?? 0) -
        (order.get(String(b.data?.nodeType)) ?? 0),
    );
}

function firstNodeOfType(nodes: Node[], type: string): Node | undefined {
  return nodes.find((n) => String(n.data?.nodeType) === type);
}

export function useWorkflowRun({
  workflowApi,
  eventsPort,
}: UseWorkflowRunOptions) {
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [pausedRunId, setPausedRunId] = useState<string | null>(null);
  const [pauseReason, setPauseReason] = useState<PauseReason>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [planRevision, setPlanRevision] = useState<number>(0);
  const [codeChangesSummary, setCodeChangesSummary] = useState<string | null>(
    null,
  );
  const [successCriteria, setSuccessCriteria] = useState<string[]>([]);
  const [llmUsage, setLlmUsage] = useState<LlmUsage | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Remember the canvas nodes for the active run so we can project statuses.
  const nodesRef = useRef<Node[]>([]);

  const emitProgress = useCallback(
    (runId: string, reason: PauseReason) => {
      const nodes = nodesRef.current;
      const key = reason ?? "";
      const completedTypes = COMPLETED_BEFORE[key] ?? [];
      idsByTypes(nodes, completedTypes).forEach((node) => {
        eventsPort.append({
          runId,
          eventType: "node_completed",
          nodeId: node.id,
          message: `${String(node.data?.label || node.id)} completed`,
        });
      });
      const waitingType = WAITING_NODE[key];
      if (waitingType) {
        const waitingNode = firstNodeOfType(nodes, waitingType);
        if (waitingNode) {
          eventsPort.append({
            runId,
            eventType: "approval_requested",
            nodeId: waitingNode.id,
            message:
              reason === "plan_review"
                ? "Plan ready — awaiting your review."
                : reason === "criteria_review"
                  ? "Criteria review — awaiting your approval."
                  : "Code changes ready — awaiting your review.",
          });
        }
      }
    },
    [eventsPort],
  );

  const emitAllCompleted = useCallback(
    (runId: string) => {
      nodesRef.current.forEach((node) => {
        eventsPort.append({
          runId,
          eventType: "node_completed",
          nodeId: node.id,
          message: `${String(node.data?.label || node.id)} completed`,
        });
      });
    },
    [eventsPort],
  );

  const applyRunResult = useCallback(
    (runData: WorkflowRunRecord) => {
      const state = (runData.state_json ?? {}) as Record<string, unknown>;
      const plan = typeof state.plan === "string" ? state.plan : null;
      const summary =
        typeof state.code_changes_summary === "string"
          ? state.code_changes_summary
          : null;
      const criteria = Array.isArray(state.success_criteria)
        ? (state.success_criteria as string[])
        : [];
      const revision =
        typeof state.plan_revision === "number" ? state.plan_revision : 0;
      const usage =
        typeof state.llm_usage === "object" && state.llm_usage !== null
          ? (state.llm_usage as LlmUsage)
          : null;

      setCurrentPlan(plan);
      setCodeChangesSummary(summary);
      setSuccessCriteria(criteria);
      setPlanRevision(revision);
      setLlmUsage(usage);

      if (runData.status === "paused") {
        const reason = (state.pause_reason as PauseReason) ?? "plan_review";
        setRunStatus("paused");
        setPausedRunId(runData.id);
        setPauseReason(reason);
        emitProgress(runData.id, reason);
        return;
      }

      // Terminal states
      setPausedRunId(null);
      setPauseReason(null);
      if (runData.status === "failed") {
        setRunStatus("failed");
        eventsPort.append({
          runId: runData.id,
          eventType: "error",
          nodeId: null,
          message:
            typeof state.error === "string"
              ? `Run failed: ${state.error}`
              : "Run failed.",
        });
      } else {
        setRunStatus("completed");
        emitAllCompleted(runData.id);
        const feedback =
          typeof state.feedback === "string" ? ` (${state.feedback})` : "";
        eventsPort.append({
          runId: runData.id,
          eventType: "run_completed",
          nodeId: null,
          message: `Task successful${feedback}.`,
        });
      }
    },
    [emitProgress, emitAllCompleted, eventsPort],
  );

  const startRun = useCallback(
    async (nodes: Node[], edges: Edge[], options?: RunOptions) => {
      setIsBusy(true);
      setLastError(null);
      setRunStatus("running");
      setCurrentPlan(null);
      setCodeChangesSummary(null);
      setLlmUsage(null);
      nodesRef.current = nodes;
      eventsPort.reset();

      try {
        // Ensure previous run's per-node telemetry does not linger in the inspector.
        await workflowApi.clearMetadata().catch(() => undefined);
        eventsPort.append({
          runId: null,
          eventType: "run_started",
          nodeId: null,
          message: `Run started: ${options?.objective ?? "(objective)"}`,
        });
        const wf = await workflowApi.createWorkflow({
          name: "UI Generated Workflow",
          description: options?.objective ?? "Created from canvas",
        });
        const version = await workflowApi.saveVersion(wf.id, { nodes, edges });
        const runData = await workflowApi.run(version.id, options);
        applyRunResult(runData);
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

  const resume = useCallback(
    async (options: ResumeOptions) => {
      if (!pausedRunId) return null;
      setIsBusy(true);
      setLastError(null);
      setRunStatus("running");
      try {
        const runData = await workflowApi.resume(pausedRunId, options);
        applyRunResult(runData);
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

  const approvePlan = useCallback(
    () => resume({ action: "approve_plan" }),
    [resume],
  );
  const sendPlanFeedback = useCallback(
    (feedback: string) => resume({ action: "send_plan_feedback", feedback }),
    [resume],
  );
  const approveCode = useCallback(
    () => resume({ action: "approve_code" }),
    [resume],
  );
  const requestCodeChanges = useCallback(
    (feedback: string) => resume({ action: "request_code_changes", feedback }),
    [resume],
  );
  const approveCriteria = useCallback(
    (criteriaText: string) => {
      const lines = criteriaText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      return resume({
        stateUpdates: {
          success_criteria: lines,
          pause_reason: null,
        },
      });
    },
    [resume],
  );

  const resumeLocal = useCallback(() => resume({}), [resume]);

  const cancelLocal = useCallback(() => {
    eventsPort.append({
      runId: pausedRunId,
      eventType: "run_cancelled",
      nodeId: null,
      message: "Run cancelled locally (no backend cancel yet)",
    });
    setPausedRunId(null);
    setPauseReason(null);
    setRunStatus("idle");
    setLastError(null);
    setCurrentPlan(null);
    setPlanRevision(0);
    setCodeChangesSummary(null);
    setSuccessCriteria([]);
    setLlmUsage(null);
  }, [eventsPort, pausedRunId]);

  const pauseLocal = useCallback(async () => {
    try {
      await workflowApi.pauseActive();
      eventsPort.append({
        runId: null,
        eventType: "node_started",
        nodeId: null,
        message: "Pause requested... Workflow will halt at next step.",
      });
    } catch (error) {
      console.error("Failed to request pause:", error);
    }
  }, [workflowApi, eventsPort]);

  const isGraphLocked =
    runStatus === "running" || runStatus === "paused" || isBusy;

  return {
    runStatus,
    pausedRunId,
    pauseReason,
    currentPlan,
    planRevision,
    codeChangesSummary,
    successCriteria,
    llmUsage,
    lastError,
    isBusy,
    isGraphLocked,
    startRun,
    approvePlan,
    sendPlanFeedback,
    approveCode,
    requestCodeChanges,
    approveCriteria,
    cancelLocal,
    pauseLocal,
    resumeLocal,
  };
}
