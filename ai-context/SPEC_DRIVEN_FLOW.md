# Spec-driven flow

This is the product loop the system implements (Track B + team “spec-driven” overlay).

## Happy path (default 8-node canvas)

```
1. Upload repo folder (zip client-side) or Empty workspace → workspace_id
2. Enter engineering objective / requirements
3. Prepare (sync objective into Objective node) → Run
4. ★ Intent guardrail (inside Objective):
      - conversation / gibberish → END immediately + guardrail_message (ResultPanel)
      - coding_task → continue
5. Criteria agent generates success criteria (hybrid UI exists; graph currently auto-continues)
6. Planner:
      - If no code_summary yet → runs Code Understanding inline
      - Produces markdown implementation plan (objective + criteria + code_summary)
7. ★ PAUSE plan_review — PlanReviewPanel
      - Send Feedback → planner again (plan_revision++, bounded by max_plan_revisions)
      - Approve Plan  → executor
8. Executor: LLM file write protocol into workspaces/<id>/
9. Validator → human_gate / retry / safe stop
10. ★ PAUSE code_review — CodeReviewPanel → Task Successful / ResultPanel
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
