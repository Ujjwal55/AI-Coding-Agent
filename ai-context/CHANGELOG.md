# Changelog (repo evolution for agents)

Append newest entries at the top. Keep bullets outcome-focused (“why”), with file pointers.

---

## 2026-07-25 — Diff / budget / language badge

- Code Review shows **unified diffs** + touched-file chips (executor stores `artifacts` / `touched_files`).
- MissionBar **spend budget** chip (`cost_budget_usd`) — stops further planner/executor LLM calls when exceeded.
- Upload chip shows language detection (e.g. `Detected: Go · 42 files`) via extension/manifest heuristics.

---

## 2026-07-25 — BYOK (bring your own key)

- MissionBar optional BYOK panel: provider (Gemini / Groq / OpenAI / Anthropic Claude / OpenAI-compatible) + API key.
- With a key, **any model id** the provider accepts (free-text + suggestions); optional base URL for OpenAI / compatible endpoints.
- Key lives in `sessionStorage` only; sent on Run/Resume; redacted in persisted `state_json`.
- `agents/llm.py` uses ContextVar BYOK → prefer user key/model (no remap), fall back to platform env keys.
- OpenAI-compatible path via `langchain-openai` (`byok_base_url`).

---

## 2026-07-25 — Intent guardrail

- Objective node classifies the input as `coding_task` / `conversation` / `unclear` (`agents/intent_guard.py`).
- Fast heuristic for greetings / short gibberish (e.g. “Hi”) — **no LLM**, exits before Criteria delays.
- Ambiguous inputs may use a single cheap LLM classify; clear coding tasks continue the loop.
- Graph: `after_objective_route` → continue to Criteria or END.
- UI: `ResultPanel` shows “Not a coding task” + `guardrail_message` instead of Task Successful.
- **Human feedback guardrail:** Plan Review / Code Review reject chat/gibberish via `classify_human_feedback` on `/resume` + client-side `feedbackGuardrail.ts` (inline amber error; run stays paused).

---

### Product / loop
- Default canvas reduced to **8 nodes**: drop explicit Code Understanding + Decision from the template graph.
- End label: **Task Successful** (workspace-only; no GitHub merge story).
- `ResultPanel` after completion: browse workspace files + download ZIP.
- MissionBar: **Export / Import** workflow JSON (`utils/nodeConverter.ts`); empty workspace; LLM usage chip (tokens / estimated cost).

### Backend
- Planner **inlines** `code_understanding_node` when `code_summary` is missing (`orchestrator/nodes.py`).
- Validator owns FAIL → retry tagging (`skip_plan_review`, `plan_feedback`) via `_validation_fail`; `maxRetries` read from Validator config.
- Graph compiler: if no Decision node, attach `should_human_approve` conditional edges on **Validator** (`graph.py`).
- `after_planner_route` keys off `plan_approved` (planner consumes `skip_plan_review` before routing).
- LLM usage aggregated into `GraphState.llm_usage` (criteria / understanding / planner / executor).

### Frontend
- `nodeRegistry`: `maxRetries` on Validator; hide `code_understanding` + `decision` from Node Library.
- `useWorkflowRun` completed-before lists match the slim graph.
- HumanGatePanel still wired for `criteria_review`, but default graph does **not** interrupt before criteria.

### Explicitly not shipped
- Reusable **template gallery** / `is_template` column — prototyped then **reverted** (keep using Export JSON + Run-side DB versions only).

---

## 2026-07-24 — Spec-driven loop + Gemini model fix (branch `ujjwal`)

### Product / loop
- Spec-driven path: upload folder → objective → plan review HITL → execute in workspace → validate → code review HITL.
- Canvas nodes: `code_understanding`, `plan_review` added; default graph updated (later simplified — see 2026-07-25).
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

- Persist real `WorkflowEvent`s (replace / complement mock event bus).
- Richer validation “receipt” UI (checks exist; evidence is console/inspector-heavy).
- Criteria edit HITL in the **default** interrupt path (panel exists).
- Git rollback / green workspace on budget exhaustion.
- Clarification gate for ambiguous requirements.
- Optional real coding-agent harness (Aider / Claude Code / Codex) behind executor.
- Named reusable **template gallery** (Export JSON covers save/share for now).
- Git worktrees / per-attempt containers (today: per-run workspace dirs + Compose for the app).
