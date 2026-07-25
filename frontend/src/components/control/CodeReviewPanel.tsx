"use client";

import { useState } from "react";
import { Download, GitPullRequestArrow, ThumbsUp } from "lucide-react";
import { validateHumanFeedback } from "@/utils/feedbackGuardrail";

interface CodeReviewPanelProps {
  isOpen: boolean;
  summary: string | null;
  downloadUrl: string | null;
  onApprove: () => void;
  onRequestChanges: (feedback: string) => void;
  isBusy?: boolean;
}

export default function CodeReviewPanel({
  isOpen,
  summary,
  downloadUrl,
  onApprove,
  onRequestChanges,
  isBusy = false,
}: CodeReviewPanelProps) {
  const [feedback, setFeedback] = useState("");
  const [guardError, setGuardError] = useState<string | null>(null);

  const handleRequestChanges = () => {
    const check = validateHumanFeedback(feedback, "code");
    if (!check.ok) {
      setGuardError(check.message ?? "Feedback rejected.");
      return;
    }
    setGuardError(null);
    onRequestChanges(feedback.trim());
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-amber-50 px-3 py-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-amber-900">
          <GitPullRequestArrow className="h-4 w-4" /> Code Review
        </h3>
        {downloadUrl && (
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
          >
            <Download className="h-3 w-3" /> Download
          </a>
        )}
      </div>

      {!isOpen ? (
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-slate-400">
          No code changes awaiting review.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <div className="min-h-0 flex-1 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3">
            <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-slate-800">
              {summary || "No code change summary."}
            </pre>
          </div>

          <textarea
            value={feedback}
            onChange={(e) => {
              setFeedback(e.target.value);
              if (guardError) setGuardError(null);
            }}
            rows={3}
            placeholder="Request code changes (e.g. 'rename to add.py and add tests')…"
            className="w-full rounded border border-slate-300 p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />

          {guardError && (
            <pre className="whitespace-pre-wrap rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950">
              {guardError}
            </pre>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy || !feedback.trim()}
              onClick={handleRequestChanges}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <GitPullRequestArrow className="h-4 w-4" />
              Request Changes
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              <ThumbsUp className="h-4 w-4" />
              Approve &amp; Finish
            </button>
          </div>
          {downloadUrl && (
            <p className="text-[11px] text-slate-500">
              Approving finishes the run in the isolated workspace — it does not
              open a GitHub PR. Use Download to get the ZIP.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
