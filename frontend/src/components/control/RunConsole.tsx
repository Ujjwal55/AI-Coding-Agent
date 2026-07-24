"use client";

import { useEffect, useRef, useState } from "react";
import type { ConsoleLine, RunStatus } from "@/domain/types";
import { Maximize2, Minimize2, Trash2 } from "lucide-react";

interface RunConsoleProps {
  lines: ConsoleLine[];
  runStatus: RunStatus;
  onClear?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export default function RunConsole({
  lines,
  runStatus,
  onClear,
  expanded = false,
  onToggleExpand,
}: RunConsoleProps) {
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [localCleared, setLocalCleared] = useState(false);
  const [clearedAtCount, setClearedAtCount] = useState(0);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    if (lines.length > clearedAtCount) {
      setLocalCleared(false);
    }
  }, [lines.length, clearedAtCount]);

  const visibleLines = localCleared ? [] : lines;

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

  const handleClear = () => {
    setLocalCleared(true);
    setClearedAtCount(lines.length);
    onClear?.();
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col border-r border-slate-200 bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800">Run Console</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badge}`}
          >
            {runStatus}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleClear}
            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
            title="Clear console"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
              title={expanded ? "Collapse console" : "Expand console"}
            >
              {expanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-slate-950 p-3 font-mono text-xs select-text">
        {visibleLines.length === 0 ? (
          <p className="text-slate-500">
            No events yet. Prepare or Run a mission.
          </p>
        ) : (
          visibleLines.map((line) => (
            <div key={line.id} className="leading-relaxed">
              <span className="text-slate-500">{line.timestamp}</span>{" "}
              <span
                className={
                  line.tone === "active"
                    ? "font-semibold text-sky-300"
                    : line.tone === "error"
                      ? "font-semibold text-red-400"
                      : line.tone === "success"
                        ? "font-semibold text-emerald-400"
                        : "text-slate-200"
                }
              >
                {line.message}
              </span>
            </div>
          ))
        )}
        <div ref={consoleEndRef} />
      </div>
    </section>
  );
}
