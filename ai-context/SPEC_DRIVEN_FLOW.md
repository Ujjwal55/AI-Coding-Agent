# Spec-driven flow

This is the product loop the system implements (Track B + team “spec-driven” overlay).

## Happy path (default 8-node canvas)

```
1. Upload repo folder (zip client-side) or Empty workspace → workspace_id
2. Enter engineering objective / requirements
3. Prepare (sync objective into Objective node) → Run
4. Criteria agent generates success criteria (hybrid UI exists; graph currently auto-continues)
5. Planner:
      - If no code_summary yet → runs Code Understanding inline
      - Produces markdown implementation plan (objective + criteria + code_summary)
6. ★ PAUSE plan_review — PlanReviewPanel
      - Send Feedback → planner again (plan_revision++, bounded by max_plan_revisions)
      - Approve Plan  → executor
7. Executor: LLM file write protocol into workspaces/<id>/
      ===== WRITE_FILE: path =====
      ...full file...
      ===== END_FILE =====
8. Validator: deterministic syntax checks; FAIL if executor failed / parsed no changes
      - FAIL + retries left → planner with skip_plan_review (no second plan HITL)
      - FAIL + exhausted   → end (safe stop)
      - PASS               → human_gate
9. ★ PAUSE code_review — CodeReviewPanel
      - Request Changes → planner with feedback
      - Approve & Finish → Task Successful (end)
      - Download zip of modified workspace
10. ResultPanel (on completed): browse files + download ZIP
```

## Pause discrimination (frontend)

`useWorkflowRun` reads `state_json.pause_reason`:

| Value | UI |
|---|---|
| `plan_review` | `PlanReviewPanel` |
| `code_review` | `CodeReviewPanel` |
| `criteria_review` | `HumanGatePanel` (wired in UI; **not** in default `interrupt_before`) |

Backend sets pause reason from `snapshot.next` node type in `runtime.py` (do not trust stale state fields alone).

## Validation retry semantics

On FAIL with attempts remaining, validator sets:

- `skip_plan_review = true`
- `plan_feedback` from validation errors

Planner consumes the skip flag and sets `plan_approved = true` for that pass.  
`after_planner_route` then sends the run to **executor** (not plan_review).

## What “done” means for a demo

1. Objective entered  
2. Repo uploaded or empty workspace (file count chip)  
3. Optional: Export/Import workflow JSON; tweak model on Planner  
4. Plan visible in Plan Review (non-empty)  
5. Feedback → revised plan **or** Approve  
6. Executor writes real files under workspace  
7. Validation FAIL → automatic retry (or deliberate first fail) then PASS  
8. Code review + download / ResultPanel browse  
9. Optional: show LLM usage chip (tokens / estimated cost)

## Out of scope / still thin

- Real `WorkflowEvent` persistence (console still partly projected from mock events; SSE logs exist)
- Rich unified diffs in CodeReviewPanel (summary + file browse today)
- External coding harness (Aider/Claude Code) — executor is in-house LLM file writer
- Clarification agent for ambiguous requirements
- Git rollback to green on budget exhaustion
- Reusable **template gallery** (DB versions exist via Run; named template UI was reverted)
- Criteria edit HITL in the default interrupt list (panel exists; criteria node does not pause by default)
