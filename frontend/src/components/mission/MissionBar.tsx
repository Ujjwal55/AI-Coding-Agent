"use client";

<<<<<<< HEAD
import { useRef } from "react";
import type { MissionState, RunStatus } from "@/domain/types";
import {
  Download,
  FolderGit2,
  FolderPlus,
  Loader2,
  Play,
  Upload,
  Wrench,
} from "lucide-react";
=======
import { useEffect, useRef, useState } from "react";
import type { LlmUsage, MissionState, RunStatus } from "@/domain/types";
import { Coins, FolderGit2, FolderPlus, Loader2, Play, Wrench, Zap } from "lucide-react";
>>>>>>> aniket

interface MissionBarProps {
  mission: MissionState;
  runStatus: RunStatus;
  isBusy: boolean;
<<<<<<< HEAD
  importError?: string | null;
=======
  llmUsage?: LlmUsage | null;
>>>>>>> aniket
  onObjectiveChange: (value: string) => void;
  onUploadFolder: (files: FileList) => void;
  onEmptyWorkspace: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onPrepare: () => void;
  onRun: () => void;
}

// Enables selecting a whole directory in the file picker (Chromium/WebKit).
const directoryProps = {
  webkitdirectory: "",
  directory: "",
} as unknown as Record<string, string>;

export default function MissionBar({
  mission,
  runStatus,
  isBusy,
<<<<<<< HEAD
  importError,
=======
  llmUsage,
>>>>>>> aniket
  onObjectiveChange,
  onUploadFolder,
  onEmptyWorkspace,
  onExport,
  onImportFile,
  onPrepare,
  onRun,
}: MissionBarProps) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canRun = mission.prepared && !isBusy;
  const fileCount = mission.fileTree.filter((f) => !f.is_dir).length;

  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const usagePopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUsageOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (usagePopoverRef.current && !usagePopoverRef.current.contains(event.target as globalThis.Node)) {
        setIsUsageOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsUsageOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isUsageOpen]);

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-sm font-bold tracking-wide text-slate-800">
          AI Coding Control Plane
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={mission.objective}
          onChange={(e) => onObjectiveChange(e.target.value)}
          placeholder="Describe the change you want (requirements)…"
          className="min-w-[240px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          ref={folderInputRef}
          type="file"
          multiple
          {...directoryProps}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              onUploadFolder(e.target.files);
            }
            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          disabled={mission.uploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {mission.uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderGit2 className="h-4 w-4" />
          )}
          {mission.uploading ? "Uploading…" : "Upload repo folder"}
        </button>

        <button
          type="button"
          onClick={onEmptyWorkspace}
          disabled={mission.uploading || isBusy}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          title="Create a blank workspace with no source files"
        >
          <FolderPlus className="h-4 w-4" />
          Empty workspace
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Upload className="h-4 w-4" />
          Import
        </button>

        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          Export
        </button>

        <button
          type="button"
          onClick={onPrepare}
          disabled={isBusy || mission.uploading}
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

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onImportFile(file);
          }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Chip
          active={Boolean(mission.objective.trim())}
          label={mission.objective.trim() ? "objective set" : "objective empty"}
        />
        <Chip
          active={Boolean(mission.workspaceId)}
          label={
            !mission.workspaceId
              ? "repo: not uploaded"
              : fileCount === 0
                ? "repo: empty workspace"
                : `repo: ${fileCount} files`
          }
        />
        <Chip
          active={mission.prepared}
          label={mission.prepared ? "prepared" : "not prepared"}
        />
        <Chip active={runStatus !== "idle"} label={`run: ${runStatus}`} />

        {llmUsage && llmUsage.total_calls > 0 && (
          <>
            <div className="h-4 w-px bg-slate-300 mx-1" />

            <div className="relative" ref={usagePopoverRef}>
              <button
                type="button"
                onClick={() => setIsUsageOpen((open) => !open)}
                aria-expanded={isUsageOpen}
                className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 ring-1 ring-purple-200 hover:bg-purple-100"
              >
                <Zap className="h-3 w-3 text-purple-600" />
                {llmUsage.total_calls} calls · ${llmUsage.estimated_cost_usd.toFixed(4)}
              </button>

              {isUsageOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 via-slate-50 to-indigo-50 p-3 shadow-lg">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                      <Zap className="h-4 w-4 text-purple-600" /> LLM Usage & Cost Telemetry
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-700">
                      <Coins className="inline-block h-3.5 w-3.5 mr-1" />
                      ${llmUsage.estimated_cost_usd.toFixed(6)} USD
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded bg-white p-1.5 border border-purple-100">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">Total Calls</div>
                      <div className="font-bold text-purple-700">{llmUsage.total_calls}</div>
                    </div>
                    <div className="rounded bg-white p-1.5 border border-amber-100">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">Total Tokens</div>
                      <div className="font-bold text-amber-700">{llmUsage.total_tokens.toLocaleString()}</div>
                    </div>
                    <div className="rounded bg-white p-1.5 border border-emerald-100">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">Prompt / Out</div>
                      <div className="font-bold text-slate-700">
                        {llmUsage.prompt_tokens.toLocaleString()} / {llmUsage.completion_tokens.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {llmUsage.breakdown_by_model && Object.keys(llmUsage.breakdown_by_model).length > 0 && (
                    <div className="mt-2.5 border-t border-purple-100 pt-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Model Breakdown
                      </div>
                      <div className="space-y-1">
                        {Object.entries(llmUsage.breakdown_by_model).map(([model, meta]) => (
                          <div key={model} className="flex items-center justify-between text-[11px] font-mono text-slate-600 bg-white/70 px-2 py-0.5 rounded">
                            <span className="truncate max-w-[140px] font-semibold text-slate-800">{model}</span>
                            <span>{meta.calls} calls | {meta.total_tokens.toLocaleString()} tok | ${meta.estimated_cost_usd.toFixed(6)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {importError && (
        <p className="mt-2 text-xs text-red-600">{importError}</p>
      )}
    </header>
  );
}

function Chip({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${active
        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
        : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
        }`}
    >
      {label}
    </span>
  );
}