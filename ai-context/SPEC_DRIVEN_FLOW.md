# Spec-driven flow

This is the product loop the system implements (Track B + team “spec-driven” overlay).

## Happy path

```
1. Upload repo folder (zip client-side) → workspace_id
2. Enter engineering objective / requirements
3. Prepare (sync objective into Objective node) → Run
4. Criteria agent generates success criteria (hybrid; currently auto-continues)
5. Code Understanding summarizes uploaded tree → code_summary
6. Planner produces markdown implementation plan (uses objective + criteria + code_summary)
7. ★ PAUSE plan_review — PlanReviewPanel
      - Send Feedback → planner again (plan_revision++, bounded by max_plan_revisions)
      - Approve Plan  → executor
8. Executor: LLM file write protocol into workspaces/<id>/
      ===== WRITE_FILE: path =====
      ...full file...
      ===== END_FILE =====
9. Validator: deterministic syntax checks; FAIL if executor failed / parsed no changes
10. Decision:
      - FAIL + retries left → planner
      - FAIL + exhausted   → end (safe stop)
      - PASS               → human_gate
11. ★ PAUSE code_review — CodeReviewPanel
      - Request Changes → planner with feedback
      - Approve & Finish → end
      - Download zip of modified workspace
```

## Pause discrimination (frontend)

`useWorkflowRun` reads `state_json.pause_reason`:

| Value | UI |
|---|---|
| `plan_review` | `PlanReviewPanel` |
| `code_review` | `CodeReviewPanel` |

Backend sets this from `snapshot.next` node type in `runtime.py` (do not trust stale state fields alone).

## What “done” means for a demo

1. Objective entered  
2. Repo uploaded (file count chip)  
3. Plan visible in Plan Review (non-empty)  
4. Feedback → revised plan **or** Approve  
5. Executor writes real files under workspace  
6. Validation evidence visible / FAIL feeds retry  
7. Code review + download  

## Out of scope / still thin

- Real SSE/`WorkflowEvent` streaming (console still partly projected from mock events)
- Full inline unified diffs in CodeReviewPanel (summary-first today)
- External coding harness (Aider/Claude Code) — executor is in-house LLM file writer
- Clarification agent for ambiguous requirements
- Git rollback to green on budget exhaustion
