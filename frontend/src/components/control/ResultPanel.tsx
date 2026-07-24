"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, FileCode2 } from "lucide-react";
import type { FileNode } from "@/domain/types";

interface ResultPanelProps {
  isOpen: boolean;
  summary: string | null;
  downloadUrl: string | null;
  fileTree: FileNode[];
  onOpenFile: (path: string) => Promise<string>;
}

export default function ResultPanel({
  isOpen,
  summary,
  downloadUrl,
  fileTree,
  onOpenFile,
}: ResultPanelProps) {
  const files = useMemo(
    () => fileTree.filter((f) => !f.is_dir).map((f) => f.path),
    [fileTree],
  );
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedPath(null);
    setFileContent(null);
    setFileError(null);
  }, [summary, fileTree]);

  const handleSelect = async (path: string) => {
    setSelectedPath(path);
    setLoadingFile(true);
    setFileError(null);
    try {
      const content = await onOpenFile(path);
      setFileContent(content);
    } catch (error) {
      setFileContent(null);
      setFileError(error instanceof Error ? error.message : "Failed to read file");
    } finally {
      setLoadingFile(false);
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-emerald-50 px-3 py-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-emerald-900">
          <CheckCircle2 className="h-4 w-4" /> Task Successful
        </h3>
        {downloadUrl && (
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
          >
            <Download className="h-3 w-3" /> Download ZIP
          </a>
        )}
      </div>

      {!isOpen ? (
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-slate-400">
          Finish a run to inspect generated files here.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
          <p className="text-xs text-slate-600">
            Code was written into an <strong>isolated workspace</strong> on the
            server — not merged to GitHub and no pull request was opened. Download
            the ZIP or open a file below.
          </p>

          {summary && (
            <pre className="max-h-20 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700 whitespace-pre-wrap">
              {summary}
            </pre>
          )}

          <div className="grid min-h-0 flex-1 grid-cols-5 gap-2">
            <div className="col-span-2 min-h-0 overflow-y-auto rounded border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">
                Workspace files
              </div>
              {files.length === 0 ? (
                <p className="p-2 text-xs text-slate-400">No files in workspace.</p>
              ) : (
                <ul className="p-1">
                  {files.map((path) => (
                    <li key={path}>
                      <button
                        type="button"
                        onClick={() => handleSelect(path)}
                        className={`flex w-full items-center gap-1 rounded px-2 py-1 text-left text-[11px] ${
                          selectedPath === path
                            ? "bg-emerald-100 text-emerald-900"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <FileCode2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{path}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="col-span-3 min-h-0 overflow-auto rounded border border-slate-200 bg-slate-950 p-2">
              {loadingFile ? (
                <p className="text-xs text-slate-400">Loading…</p>
              ) : fileError ? (
                <p className="text-xs text-red-400">{fileError}</p>
              ) : fileContent != null ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-emerald-300">
                  {fileContent}
                </pre>
              ) : (
                <p className="text-xs text-slate-500">
                  Select a file to preview its contents.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
