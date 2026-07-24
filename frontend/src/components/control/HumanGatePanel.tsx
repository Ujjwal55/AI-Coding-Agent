"use client";

import { useRef, useState } from "react";
import { User } from "lucide-react";

interface HumanGatePanelProps {
  isOpen: boolean;
  initialCriteria?: string;
  onApprove: (criteriaText: string) => void;
  isBusy?: boolean;
}

export default function HumanGatePanel({
  isOpen,
  initialCriteria = "",
  onApprove,
  isBusy = false,
}: HumanGatePanelProps) {
  const [criteriaText, setCriteriaText] = useState(initialCriteria);
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleEdit = () => {
    setEditing(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h3 className="text-sm font-bold text-slate-800">Human Gate</h3>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        {!isOpen ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100/80 px-4 py-6 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 shadow-md shadow-amber-200">
              <User className="h-7 w-7 text-white" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-950">
                No approval needed yet
              </p>
              <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-amber-800/75">
                When the run pauses for criteria review, Edit and Approve appear
                here.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-stretch gap-4 rounded-xl border border-amber-200 bg-[#FFF7ED] p-4 shadow-sm">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 shadow-sm">
                <User className="h-8 w-8 text-white" strokeWidth={2} />
              </div>
              <div>
                <p className="text-base font-bold text-slate-900">
                  Criteria change requested
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Please review before continuing.
                </p>
              </div>
            </div>

            {(editing || criteriaText.trim()) && (
              <textarea
                ref={textareaRef}
                value={criteriaText}
                onChange={(e) => setCriteriaText(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-amber-200 bg-white p-2.5 font-mono text-sm text-slate-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder={"1. Must pass tests...\n2. ..."}
              />
            )}

            <div className="mt-auto flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleEdit}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onApprove(criteriaText)}
                disabled={isBusy}
                className="flex-[1.4] rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve & Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
