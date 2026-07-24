"use client";

import type { MissionState, RunStatus } from "@/domain/types";
import { FileUp, FolderGit2, Play, Wrench } from "lucide-react";

interface MissionBarProps {
  mission: MissionState;
  runStatus: RunStatus;
  isBusy: boolean;
  onObjectiveChange: (value: string) => void;
  onAttachFile: () => void;
  onSelectRepo: () => void;
  onPrepare: () => void;
  onRun: () => void;
}

export default function MissionBar({
  mission,
  runStatus,
  isBusy,
  onObjectiveChange,
  onAttachFile,
  onSelectRepo,
  onPrepare,
  onRun,
}: MissionBarProps) {
  const canRun = mission.prepared && !isBusy;

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-sm font-bold tracking-wide text-slate-800">
          AI Coding Control Plane
        </h1>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          L1 Mission Layer
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={mission.objective}
          onChange={(e) => onObjectiveChange(e.target.value)}
          placeholder="What do you want to build?"
          className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          type="button"
          onClick={onAttachFile}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <FileUp className="h-4 w-4" />
          Attach file
        </button>

        <button
          type="button"
          onClick={onSelectRepo}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <FolderGit2 className="h-4 w-4" />
          Select repo
        </button>

        <button
          type="button"
          onClick={onPrepare}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50"
        >
          <Wrench className="h-4 w-4" />
          Prepare
        </button>

        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          Run
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Chip
          active={Boolean(mission.objective.trim())}
          label={
            mission.objective.trim() ? "objective set" : "objective empty"
          }
        />
        <Chip
          active={Boolean(mission.repoPath)}
          label={
            mission.repoPath
              ? `repo: ${mission.repoPath}`
              : "repo: not selected"
          }
        />
        <Chip
          active={mission.attachments.length > 0}
          label={
            mission.attachments.length > 0
              ? `${mission.attachments.length} attachment${mission.attachments.length === 1 ? "" : "s"}`
              : "no attachments"
          }
        />
        <Chip
          active={mission.prepared}
          label={mission.prepared ? "prepared" : "not prepared"}
        />
        <Chip active={runStatus !== "idle"} label={`run: ${runStatus}`} />
      </div>
    </header>
  );
}

function Chip({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
      }`}
    >
      {label}
    </span>
  );
}
