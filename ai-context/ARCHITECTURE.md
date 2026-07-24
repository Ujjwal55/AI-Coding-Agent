# Architecture (current)

## High-level

```
┌──────────────────────── Frontend (Next.js) ────────────────────────┐
│ MissionBar │ NodeLibrary │ React Flow Canvas │ NodeInspector       │
│ RunConsole │ RunTimeline │ PlanReviewPanel │ CodeReviewPanel       │
│ ports → adapters (HTTP / mock events)                              │
└───────────────────────────────┬────────────────────────────────────┘
                                │ HTTP
┌───────────────────────────────▼────────────────────────────────────┐
│ FastAPI  /api/workflows/*  /api/upload  /api/workspaces/*          │
│ orchestrator: dynamic LangGraph compiler + MemorySaver             │
│ agents: criteria, code_understanding, planner, executor, validator │
│ Postgres: Workflow / WorkflowVersion / WorkflowRun / WorkflowEvent │
│ workspaces/<uuid>/  ← unzipped user repos (gitignored)             │
└────────────────────────────────────────────────────────────────────┘
```

## Backend

### Entry & API

| Path | Role |
|---|---|
| `backend/main.py` | FastAPI app, CORS, Alembic on startup, mounts routers |
| `backend/api/workflow.py` | CRUD workflows/versions; `POST .../run`; `POST .../resume` |
| `backend/api/upload.py` | Zip upload (zip-slip guarded), tree, file read, re-zip download |
| `backend/database/core.py` | Async SQLAlchemy engine (`DATABASE_URL`, Postgres) |
| `backend/models/workflow.py` | ORM: Workflow, WorkflowVersion, WorkflowRun, WorkflowEvent |

### Orchestrator

| Path | Role |
|---|---|
| `backend/orchestrator/state.py` | `GraphState` TypedDict (objective, workspace, plan flags, validation, etc.) |
| `backend/orchestrator/graph.py` | **Dynamic** `StateGraph` from React Flow JSON; `NODE_MAP`; conditional edges |
| `backend/orchestrator/nodes.py` | planner / executor / validator / human_approval node bodies |
| `backend/orchestrator/runtime.py` | `execute_workflow`, MemorySaver, pause_reason inference, serialize state |

### Agents / LLM

| Path | Role |
|---|---|
| `backend/agents/llm.py` | `get_llm`, `normalize_llm_content`, Gemini/Groq + Qwen circuit breaker |
| `backend/agents/success_criteria.py` | Hybrid criteria generation |
| `backend/agents/code_understanding.py` | Repo tree + key files → `code_summary` |
| `backend/agents/decision.py` | `should_replan`, `should_human_approve`, `should_finish_after_review` |

### Key design rules

1. **Generation ≠ acceptance.** Executor may use an LLM to write files; **validator** uses deterministic checks (`py_compile`, encoding). Executor failure must FAIL validation.
2. **Configurable graph.** Topology comes from the UI JSON — not a hardcoded sequence — compiled in `build_dynamic_graph`.
3. **Bounded autonomy.** `max_plan_revisions`, `max_attempts` / `maxRetries`; exhausted → safe stop / forced path.
4. **HITL gates.** LangGraph `interrupt_before` on `plan_review` and `human_gate`; resume via `/resume` with `action` + optional `feedback`.
5. **Workspace isolation.** Uploads land in `backend/workspaces/<uuid>/`; executor writes there (not the old hardcoded `target_repo` alone).

### Resume actions (`POST /api/workflows/{run_id}/resume`)

| `action` | Effect |
|---|---|
| `approve_plan` | `plan_approved=true` → route to executor |
| `send_plan_feedback` | set `plan_feedback`, replan |
| `approve_code` | `human_approved=true` → end |
| `request_code_changes` | feedback → planner |

`pause_reason` in `state_json` is **always inferred from the next interrupt node** (`plan_review` | `code_review` | optionally `criteria_review`).

### LLM defaults (important)

- Default: **`gemini-2.5-flash`**
- Retired IDs (`gemini-1.5-pro`, `gemini-1.5-flash`, etc.) are remapped in `get_llm`
- Unsupported UI labels (gpt/claude/o1) remap to Gemini Flash when `GOOGLE_API_KEY` is set
- Content may be `str` **or** list of blocks → always run through `normalize_llm_content`

## Frontend

Ports-and-adapters layout under `frontend/src/`:

| Layer | Path | Owns |
|---|---|---|
| Composition | `app/page.tsx` | Adapters, mission state, default graph, wiring |
| Domain | `domain/types.ts` | Mission, pause reason, run/event types |
| Ports | `ports/WorkflowApiPort.ts`, `ports/RunEventsPort.ts` | Interfaces |
| Adapters | `adapters/http/HttpWorkflowAdapter.ts`, `adapters/mock/MockRunEventsAdapter.ts` | HTTP + in-memory events |
| Application | `application/useWorkflowRun.ts`, `usePrepareMission.ts`, `nodeRegistry.ts`, `projectRunView.ts` | Run/prepare logic, projections |
| L1 Mission | `components/mission/MissionBar.tsx` | Objective, folder upload, Prepare/Run |
| L2 Workflow | `components/workflow/*`, `CustomNode.tsx` | Canvas, library, inspector |
| L3 Control | `components/control/*` | Console, timeline, PlanReview, CodeReview |

### Upload path

Browser folder picker (`webkitdirectory`) → client JSZip (skips `node_modules`/`.git`, size caps) → `POST /api/upload` → `workspaceId` on mission → passed into `run({ objective, workspaceId })`.

## Data model (Postgres)

- **Workflow** — named workflow metadata  
- **WorkflowVersion** — `graph_json` (nodes + edges)  
- **WorkflowRun** — `status` (`running|paused|completed|failed`), `state_json`  
- **WorkflowEvent** — schema exists; **not yet written by runtime** (UI still uses mock event bus)

## Docker notes

- `docker-compose.yml`: Postgres + backend (hot reload) + frontend (hot reload)
- Frontend mounts anonymous volumes for `/app/node_modules` and `/app/.next`  
  → **host `npm install` does not update the container**. After adding deps:  
  `docker compose exec frontend npm install` or rebuild with `--renew-anon-volumes`
- Backend: `env_file: ./backend/.env`
