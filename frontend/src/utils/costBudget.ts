/** Soft USD spend budget for a run. Stored in sessionStorage. */

const STORAGE_KEY = "dtdl.cost_budget.v1";

export function loadCostBudgetUsd(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveCostBudgetUsd(value: number | null): void {
  if (typeof window === "undefined") return;
  if (value == null || !(value > 0)) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, String(value));
}
