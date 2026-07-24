"use client";

import type { TimelineStep } from "@/domain/types";

interface RunTimelineProps {
  steps: TimelineStep[];
}

const statusDot: Record<string, string> = {
  completed: "bg-emerald-500",
  running: "bg-amber-400 animate-pulse",
  waiting: "bg-sky-500",
  failed: "bg-red-500",
  pending: "bg-slate-300",
};

export default function RunTimeline({ steps }: RunTimelineProps) {
  return (
    <section className="flex min-h-0 flex-[1.2] flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h3 className="text-sm font-bold text-slate-800">Timeline</h3>
      </div>
      <div className="flex flex-1 items-center overflow-x-auto px-4 py-3">
        {steps.length === 0 ? (
          <p className="text-sm text-slate-400">No nodes on canvas</p>
        ) : (
          <ol className="flex min-w-max items-center gap-0">
            {steps.map((step, index) => (
              <li key={step.nodeId} className="flex items-center">
                <div className="flex w-24 flex-col items-center gap-1">
                  <span
                    className={`h-3 w-3 rounded-full ${statusDot[step.status] ?? statusDot.pending}`}
                  />
                  <span className="line-clamp-2 text-center text-[10px] font-medium text-slate-600">
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className="mb-4 h-0.5 w-6 bg-slate-200" />
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
