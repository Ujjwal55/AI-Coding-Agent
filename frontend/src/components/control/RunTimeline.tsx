"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RunStatus, TimelineStep } from "@/domain/types";

interface RunTimelineProps {
  steps: TimelineStep[];
  runStatus: RunStatus;
}

const STEP_W = 112;
const GAP = 24;
const TIGER_SIZE = 40;

function isActiveStatus(status: string) {
  return status === "running" || status === "in_progress";
}

function segmentFill(status: string, nextStatus: string) {
  if (status === "completed" && (nextStatus === "completed" || nextStatus === "running" || nextStatus === "in_progress" || nextStatus === "waiting")) {
    return "bg-emerald-500";
  }
  return "bg-slate-200";
}

function nodeDotClass(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-500 border-emerald-300";
    case "running":
    case "in_progress":
      return "bg-amber-400 border-amber-200 animate-pulse";
    case "waiting":
      return "bg-amber-400 border-amber-200";
    case "failed":
      return "bg-red-500 border-red-300";
    default:
      return "bg-slate-300 border-slate-200";
  }
}

export default function RunTimeline({ steps, runStatus }: RunTimelineProps) {
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [tigerLeft, setTigerLeft] = useState(0);
  const [showTiger, setShowTiger] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const trackWidth = steps.length > 0 ? steps.length * STEP_W + (steps.length - 1) * GAP : 0;

  useEffect(() => {
    if (steps.length === 0) {
      setShowTiger(false);
      return;
    }
    
    // Find active step index
    let activeIndex = steps.findIndex(s => isActiveStatus(s.status || ""));
    if (activeIndex === -1) {
      activeIndex = steps.findIndex(s => s.status === "waiting");
    }
    if (activeIndex === -1 && runStatus === "completed") {
      activeIndex = steps.length - 1; // At the end
    }
    if (activeIndex === -1) {
      activeIndex = 0; // default to first
    }

    const activeRef = stepRefs.current[activeIndex];
    if (activeRef) {
      // The left position of the tiger is center of the active step
      setTigerLeft(activeIndex * (STEP_W + GAP) + STEP_W / 2);
      setShowTiger(true);
      
      // Auto-scroll logic if needed
      activeRef.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [steps, runStatus]);

  const bob = runStatus === "running" ? "animate-bounce" : "";

  return (
    <section className="flex flex-col bg-white w-full h-full min-w-0 border-r border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-800">Step Timeline</h3>
        <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Completed
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> In Progress
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-300" /> Pending
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto px-4 pb-3 pt-10">
        {steps.length === 0 ? (
          <p className="text-sm text-slate-400">No nodes on canvas</p>
        ) : (
          <div className="relative" style={{ width: Math.max(trackWidth, 480) }}>
            <div
              className="absolute left-0 right-0 top-[18px] flex h-1.5 overflow-hidden rounded-full bg-slate-200"
              style={{ marginLeft: STEP_W / 2, marginRight: STEP_W / 2 }}
            >
              {steps.slice(0, -1).map((step, i) => (
                <div
                  key={`seg-${step.nodeId}`}
                  className={`h-full flex-1 ${segmentFill(
                    step.status || "pending",
                    steps[i + 1]?.status || "pending",
                  )}`}
                />
              ))}
            </div>

            {showTiger && (
              <div
                className="pointer-events-none absolute z-20"
                style={{
                  left: tigerLeft,
                  top: -(TIGER_SIZE - 8),
                  width: TIGER_SIZE,
                  height: TIGER_SIZE,
                  transform: "translateX(-50%)",
                  transition: reducedMotion ? undefined : "left 400ms ease-out",
                }}
                title="Current progress"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/tiger.svg"
                  alt="Progress tiger"
                  width={TIGER_SIZE}
                  height={TIGER_SIZE}
                  className={`h-full w-full drop-shadow-md ${bob}`}
                />
              </div>
            )}

            <ol className="relative z-[1] flex items-start">
              {steps.map((step, index) => {
                const statusKey = step.status || "pending";
                return (
                  <li
                    key={step.nodeId}
                    ref={(el) => {
                      stepRefs.current[index] = el;
                    }}
                    className="flex flex-col items-center"
                    style={{
                      width: STEP_W,
                      marginRight: index < steps.length - 1 ? GAP : 0,
                    }}
                  >
                    <span
                      className={`mt-2 h-4 w-4 rounded-full border-2 shadow-sm ${nodeDotClass(statusKey)}`}
                    />
                    <span className="mt-2 line-clamp-2 text-center text-[11px] font-semibold leading-tight text-slate-800">
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
