"use client";

import { useMemo, useState } from "react";
import { FileCode2, FileMinus2, FilePlus2, FilePenLine } from "lucide-react";

export interface FileArtifact {
  file: string;
  action?: "created" | "modified" | "deleted" | string;
  unified_diff?: string;
}

interface DiffViewProps {
  artifacts: FileArtifact[];
  /** Fallback paths when artifacts lack diffs */
  touchedFiles?: string[];
}

function actionIcon(action: string | undefined) {
  if (action === "created") return FilePlus2;
  if (action === "deleted") return FileMinus2;
  if (action === "modified") return FilePenLine;
  return FileCode2;
}

function DiffLines({ diff }: { diff: string }) {
  const lines = diff.split("\n");
  return (
    <pre className="overflow-x-auto rounded border border-slate-800 bg-slate-950 p-2 font-mono text-[11px] leading-relaxed text-slate-200">
      {lines.map((line, i) => {
        let cls = "text-slate-300";
        if (line.startsWith("+++") || line.startsWith("---")) cls = "text-slate-400";
        else if (line.startsWith("@@")) cls = "text-sky-400";
        else if (line.startsWith("+")) cls = "bg-emerald-950/60 text-emerald-300";
        else if (line.startsWith("-")) cls = "bg-rose-950/50 text-rose-300";
        return (
          <div key={i} className={cls}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

export default function DiffView({ artifacts, touchedFiles = [] }: DiffViewProps) {
  const files = useMemo(() => {
    if (artifacts.length > 0) return artifacts;
    return touchedFiles.map((f) => ({ file: f, action: "modified" as const }));
  }, [artifacts, touchedFiles]);

  const [active, setActive] = useState(0);
  const current = files[Math.min(active, Math.max(files.length - 1, 0))];

  if (files.length === 0) {
    return (
      <p className="text-xs text-slate-500">No files were touched in this run.</p>
    );
  }

  const Icon = actionIcon(current?.action);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {files.map((a, i) => {
          const AIcon = actionIcon(a.action);
          const selected = i === active;
          return (
            <button
              key={`${a.file}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={
                selected
                  ? "inline-flex max-w-full items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-950 ring-1 ring-amber-300"
                  : "inline-flex max-w-full items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              }
              title={a.file}
            >
              <AIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{a.file}</span>
            </button>
          );
        })}
      </div>

      {current && (
        <div className="min-h-0 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            <Icon className="h-3.5 w-3.5" />
            {current.action || "change"} · {current.file}
          </div>
          {current.unified_diff ? (
            <DiffLines diff={current.unified_diff} />
          ) : (
            <p className="rounded border border-dashed border-slate-300 bg-white px-2 py-3 text-xs text-slate-500">
              No unified diff available for this file (summary only).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
