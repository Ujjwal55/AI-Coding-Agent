"use client";

import { useState } from "react";
import { ClipboardCheck, MessageSquare, ThumbsUp } from "lucide-react";

interface PlanReviewPanelProps {
  isOpen: boolean;
  plan: string | null;
  planRevision: number;
  onApprove: () => void;
  onSendFeedback: (feedback: string) => void;
  isBusy?: boolean;
}

export default function PlanReviewPanel({
  isOpen,
  plan,
  planRevision,
  onApprove,
  onSendFeedback,
  isBusy = false,
}: PlanReviewPanelProps) {
  const [feedback, setFeedback] = useState("");

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-sky-50 px-3 py-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-sky-900">
          <ClipboardCheck className="h-4 w-4" /> Plan Review
        </h3>
        {planRevision > 0 && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-700">
            revision {planRevision}
          </span>
        )}
      </div>

      {!isOpen ? (
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-slate-400">
          No plan awaiting review.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <div className="min-h-0 flex-1 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3">
            <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-slate-800">
              {plan?.trim()
                ? plan
                : "No plan content yet. The planner returned an empty response — check backend logs for Circuit Breaker / API key errors, then re-run or send feedback to regenerate."}
            </pre>
          </div>

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="Optional: request changes to the plan (e.g. 'also add rate limiting')…"
            className="w-full rounded border border-slate-300 p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy || !feedback.trim()}
              onClick={() => onSendFeedback(feedback.trim())}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <MessageSquare className="h-4 w-4" />
              Send Feedback &amp; Replan
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              <ThumbsUp className="h-4 w-4" />
              Approve Plan
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
