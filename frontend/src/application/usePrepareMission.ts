"use client";

import { useCallback } from "react";
import type { Node } from "@xyflow/react";
import type { MissionState } from "@/domain/types";
import type { RunEventsPort } from "@/ports/RunEventsPort";

interface PrepareResult {
  ok: boolean;
  error?: string;
  nextMission: MissionState;
  nextNodes: Node[];
}

/**
 * Local-only Prepare: syncs mission objective into the Objective node.
 * Does not call WorkflowApiPort (future seam).
 */
export function usePrepareMission(eventsPort: RunEventsPort) {
  const prepare = useCallback(
    (mission: MissionState, nodes: Node[]): PrepareResult => {
      const objective = mission.objective.trim();
      if (!objective) {
        return {
          ok: false,
          error: "Enter an objective before Prepare.",
          nextMission: mission,
          nextNodes: nodes,
        };
      }

      const nextNodes = nodes.map((node) => {
        if (node.data?.nodeType !== "objective") return node;
        return {
          ...node,
          data: {
            ...node.data,
            label:
              objective.length > 48 ? `${objective.slice(0, 48)}…` : objective,
            objective,
          },
        };
      });

      const nextMission: MissionState = {
        ...mission,
        prepared: true,
      };

      eventsPort.append({
        runId: null,
        eventType: "prepared",
        nodeId: "objective",
        message: mission.workspaceId
          ? `Mission prepared: ${objective}`
          : `Mission prepared (no repo uploaded): ${objective}`,
        payload: {
          workspaceId: mission.workspaceId,
          fileCount: mission.fileTree.filter((f) => !f.is_dir).length,
        },
      });

      return { ok: true, nextMission, nextNodes };
    },
    [eventsPort],
  );

  return { prepare };
}
