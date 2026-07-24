import type {
  ConsoleLine,
  NodeExecutionView,
  NodeRunStatus,
  TimelineStep,
  UiEvent,
} from "@/domain/types";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function projectNodeStatuses(
  events: UiEvent[],
  nodeIds: string[],
): Record<string, NodeRunStatus> {
  const statuses: Record<string, NodeRunStatus> = {};
  nodeIds.forEach((id) => {
    statuses[id] = "pending";
  });

  for (const event of events) {
    if (!event.nodeId || !(event.nodeId in statuses)) continue;
    if (event.eventType === "node_started") {
      statuses[event.nodeId] = "running";
    } else if (event.eventType === "node_completed") {
      statuses[event.nodeId] = "completed";
    } else if (event.eventType === "error") {
      statuses[event.nodeId] = "failed";
    } else if (event.eventType === "approval_requested") {
      statuses[event.nodeId] = "waiting";
    }
  }

  return statuses;
}

export function projectTimeline(
  events: UiEvent[],
  nodes: { id: string; label: string }[],
): TimelineStep[] {
  const statuses = projectNodeStatuses(
    events,
    nodes.map((n) => n.id),
  );
  return nodes.map((node) => ({
    nodeId: node.id,
    label: node.label,
    status: statuses[node.id] ?? "pending",
  }));
}

export function projectConsoleLines(events: UiEvent[]): ConsoleLine[] {
  return events.map((event) => {
    let tone: ConsoleLine["tone"] = "default";
    if (event.eventType === "node_started" || event.eventType === "run_started") {
      tone = "active";
    } else if (event.eventType === "error") {
      tone = "error";
    } else if (
      event.eventType === "node_completed" ||
      event.eventType === "run_completed"
    ) {
      tone = "success";
    }

    return {
      id: event.id,
      timestamp: formatTime(event.createdAt),
      nodeId: event.nodeId,
      message: event.message,
      tone,
    };
  });
}

export function projectNodeExecution(
  events: UiEvent[],
  nodeId: string,
): NodeExecutionView {
  const statuses = projectNodeStatuses(events, [nodeId]);
  const related = events.filter((e) => e.nodeId === nodeId);
  const last = related[related.length - 1];
  const stdout =
    last?.payload && typeof last.payload.stdout === "string"
      ? last.payload.stdout
      : null;

  return {
    nodeId,
    status: statuses[nodeId] ?? "pending",
    lastMessage: last?.message ?? null,
    stdout,
  };
}
