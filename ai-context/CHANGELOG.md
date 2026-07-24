# Changelog (repo evolution for agents)

Append newest entries at the top. Keep bullets outcome-focused (“why”), with file pointers.

---

## 2026-07-24 — Spec-driven loop + Gemini model fix (branch `ujjwal`)

### Product / loop
- Spec-driven path: upload folder → objective → plan review HITL → execute in workspace → validate → code review HITL.
- Canvas nodes: `code_understanding`, `plan_review` added; default graph updated.
- Bounded plan revisions (`plan_revision` / `max_plan_revisions`).
- Decision always routes PASS → `human_gate` (code review); human gate can loop to planner.

### Backend
- `api/upload.py`: zip upload, tree, file, download; zip-slip guard.
- Spec-driven planner/executor/validator in `orchestrator/nodes.py` (LLM writes files via WRITE_FILE protocol).
- `code_understanding` agent; routers in `agents/decision.py`.
- `RunRequest` carries `objective`, `workspace_id`, `max_plan_revisions`.
- Resume actions: `approve_plan`, `send_plan_feedback`, `approve_code`, `request_code_changes`.
- Empty LLM plan rejected → structured fallback plan.
- Validator fails when executor failed / parsed no file changes.
- LLM: default `gemini-2.5-flash`; remap retired `gemini-1.5-*`; `normalize_llm_content` for list-shaped Gemini responses.
- Compose: `env_file: ./backend/.env`.

### Frontend
- Ports/adapters UI refactor (earlier) + PlanReviewPanel / CodeReviewPanel.
- MissionBar: real folder upload via JSZip (not `window.prompt`).
- Model dropdown: working Gemini/Groq IDs only.

### Commits (approx.)
- `6c3ecde` feat: llm / zip / spec-driven state  
- `9229d17` feat: upload and zip  
- `63e1223` fix: llm model issue  

---

## 2026-07-24 — Frontend control-plane UI layers (PR #9 / Ritish)

- Split monolith `page.tsx` into L1/L2/L3 + ports/adapters.
- MissionBar, RunConsole, RunTimeline, HumanGatePanel, nodeRegistry.
- Docs: `docs/FRONTEND_BACKEND_WIRING.md`.

---

## Earlier — Core platform foundations

- Dynamic LangGraph compiler from React Flow JSON.
- Workflow / Version / Run / Event models; Alembic; Docker Compose (Postgres).
- Circuit breaker + local Qwen 0.5B fallback (`agents/llm.py`).
- Hybrid criteria pause (original interrupt-before-planner pattern — later shifted toward plan/code gates).

---

## Still open (hackathon gaps)

- Persist + stream real `WorkflowEvent`s (replace mock event bus).
- Workflow YAML/JSON export-import UI.
- Git rollback / green workspace on budget exhaustion.
- Clarification gate for ambiguous requirements.
- Optional real coding-agent harness (Aider / Claude Code / Codex) behind executor.
- Cost / token / wall-clock receipts.
