"use client";

interface HumanGatePanelProps {
  isOpen: boolean;
  criteriaText: string;
  onCriteriaChange: (value: string) => void;
  onApprove: () => void;
  onEditFocus?: () => void;
  isBusy?: boolean;
}

export default function HumanGatePanel({
  isOpen,
  criteriaText,
  onCriteriaChange,
  onApprove,
  onEditFocus,
  isBusy = false,
}: HumanGatePanelProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h3 className="text-sm font-bold text-slate-800">
          Human Gate / Criteria Edit
        </h3>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {!isOpen ? (
          <p className="text-sm text-slate-400">
            No approval requested. Waiting for a pause / human gate interrupt.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-700">
              Criteria change requested. Please review and approve to continue.
            </p>
            <textarea
              value={criteriaText}
              onChange={(e) => onCriteriaChange(e.target.value)}
              onFocus={onEditFocus}
              rows={6}
              className="w-full rounded border border-slate-300 p-2 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1. Must pass tests..."
            />
            <div className="mt-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onEditFocus}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit Criteria
              </button>
              <button
                type="button"
                onClick={onApprove}
                disabled={isBusy}
                className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve & Continue
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
