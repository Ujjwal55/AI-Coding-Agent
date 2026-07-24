"use client";

import { useEffect, useRef } from "react";
import type { ConsoleLine, RunStatus } from "@/domain/types";

interface RunConsoleProps {
  lines: ConsoleLine[];
  runStatus: RunStatus;
  onCancel: () => void;
}

export default function RunConsole({
  lines,
  runStatus,
  onCancel,
}: RunConsoleProps) {
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const badge =
    runStatus === "running"
      ? "bg-amber-100 text-amber-800"
      : runStatus === "paused"
        ? "bg-sky-100 text-sky-800"
        : runStatus === "completed"
          ? "bg-emerald-100 text-emerald-800"
          : runStatus === "failed"
            ? "bg-red-100 text-red-800"
            : "bg-slate-100 text-slate-600";

  return (
    <section className="flex min-h-0 flex-1 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 shrink-0">
        <h3 className="text-sm font-bold text-slate-800">Run Console</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badge}`}
        >
          {runStatus}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 font-mono text-xs select-text">
        {lines.length === 0 ? (
          <p className="text-slate-400">No events yet. Prepare or Run a mission.</p>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="leading-relaxed">
              <span className="text-slate-400">{line.timestamp}</span>{" "}
              <span
                className={
                  line.tone === "active"
                    ? "text-blue-600 font-semibold"
                    : line.tone === "error"
                      ? "text-red-600 font-semibold"
                      : line.tone === "success"
                        ? "text-emerald-700 font-semibold"
                        : "text-slate-700"
                }
              >
                {line.message}
              </span>
            </div>
          ))
        )}
        <div ref={consoleEndRef} />
      </div>

      <div className="border-t border-slate-200 bg-slate-50 p-2 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
