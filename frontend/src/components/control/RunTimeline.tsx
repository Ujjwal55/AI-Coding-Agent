"use client";

import type { TimelineStep } from "@/domain/types";

interface RunTimelineProps {
  steps: TimelineStep[];
}

const statusDot: Record<string, string> = {
  completed: "bg-emerald-500 ring-2 ring-emerald-300",
  running: "bg-blue-500 animate-pulse ring-2 ring-blue-300",
  in_progress: "bg-blue-500 animate-pulse ring-2 ring-blue-300",
  waiting: "bg-amber-400 ring-2 ring-amber-200",
  failed: "bg-red-500 ring-2 ring-red-300",
  pending: "bg-slate-300",
};

const statusBadgeText: Record<string, string> = {
  completed: "DONE",
  running: "RUNNING",
  in_progress: "RUNNING",
  waiting: "PAUSED",
  failed: "FAILED",
  pending: "PENDING",
};

const badgeColor: Record<string, string> = {
  completed: "text-emerald-700 bg-emerald-100 border-emerald-200",
  running: "text-blue-700 bg-blue-100 border-blue-200 animate-pulse",
  in_progress: "text-blue-700 bg-blue-100 border-blue-200 animate-pulse",
  waiting: "text-amber-700 bg-amber-100 border-amber-200",
  failed: "text-red-700 bg-red-100 border-red-200",
  pending: "text-slate-500 bg-slate-100 border-slate-200",
};

export default function RunTimeline({ steps }: RunTimelineProps) {
  return (
    <section className="flex flex-col bg-white w-full h-full min-w-0 border-r border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-800">Step Timeline</h3>
        <span className="text-[10px] text-slate-500 font-medium">Real-time status</span>
      </div>
      <div className="flex flex-1 items-center overflow-x-auto px-4 py-3">
        {steps.length === 0 ? (
          <p className="text-sm text-slate-400">No nodes on canvas</p>
        ) : (
          <ol className="flex min-w-max items-center gap-2">
            {steps.map((step, index) => {
              const statusKey = step.status || "pending";
              return (
                <li key={step.nodeId} className="flex items-center">
                  <div className="flex w-28 flex-col items-center gap-1.5 p-2 rounded bg-slate-50 border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${statusDot[statusKey] ?? statusDot.pending}`} />
                      <span className={`text-[9px] font-bold px-1 py-0.2 rounded border ${badgeColor[statusKey] ?? badgeColor.pending}`}>
                        {statusBadgeText[statusKey] ?? "PENDING"}
                      </span>
                    </div>
                    <span className="line-clamp-2 text-center text-xs font-semibold text-slate-800">
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="h-0.5 w-4 bg-slate-300" />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
