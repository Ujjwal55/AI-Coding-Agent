# Architecture (current)

## High-level

```
┌──────────────────────── Frontend (Next.js) ────────────────────────┐
│ MissionBar │ NodeLibrary │ React Flow Canvas │ NodeInspector       │
│ RunConsole │ RunTimeline │ PlanReview │ CodeReview │ ResultPanel   │
│ Export/Import JSON │ LLM usage chip (token/cost)                   │
│ ports → adapters (HTTP / mock events)                              │
└───────────────────────────────┬────────────────────────────────────┘
                                │ HTTP
┌───────────────────────────────▼────────────────────────────────────┐
│ FastAPI  /api/workflows/*  /api/upload  /api/workspaces/*          │
│ orchestrator: dynamic LangGraph compiler + MemorySaver             │
│ agents: criteria, code_understanding*, planner, executor,          │
│         validator (+ decision routers); *usually inlined in plan   │
│ Postgres: Workflow / WorkflowVersion / WorkflowRun / WorkflowEvent │
│ workspaces/<uuid>/  ← unzipped user repos (gitignored)             │
└────────────────────────────────────────────────────────────────────┘
```

## Backend

### Entry & API

| Path | Role |
|---|---|
| `backend/main.py` | FastAPI app, CORS, Alembic on startup, mounts routers |
| `backend/api/workflow.py` | CRUD workflows/versions; `POST .../run`; `POST .../resume`; SSE logs |
| `backend/api/upload.py` | Zip upload (zip-slip guarded), tree, file read, re-zip download |
| `backend/database/core.py` | Async SQLAlchemy engine (`DATABASE_URL`, Postgres) |
| `backend/models/workflow.py` | ORM: Workflow, WorkflowVersion, WorkflowRun, WorkflowEvent |

### Orchestrator

| Path | Role |
|---|---|
| `backend/orchestrator/state.py` | `GraphState` (objective, workspace, plan flags, validation, `llm_usage`, …) |
| `backend/orchestrator/graph.py` | **Dynamic** `StateGraph` from React Flow JSON; `NODE_MAP`; conditional edges |
| `backend/orchestrator/nodes.py` | planner (may inline understanding) / executor / validator / human_approval |
| `backend/orchestrator/runtime.py` | `execute_workflow`, MemorySaver, pause_reason inference, serialize state |

### Agents / LLM

| Path | Role |
|---|---|
| `backend/agents/llm.py` | `get_llm`, `normalize_llm_content`, metrics/cost helpers, Gemini/Groq + Qwen |
| `backend/agents/success_criteria.py` | Criteria generation (+ usage aggregation) |
| `backend/agents/code_understanding.py` | Repo tree + key files → `code_summary` (callable from Planner or as a canvas node) |
| `backend/agents/decision.py` | Routers: `after_planner_route`, `should_replan`, `should_human_approve`, `should_finish_after_review`; optional `decision_node` |

### Key design rules

1. **Generation ≠ acceptance.** Executor may use an LLM to write files; **validator** uses deterministic checks (`py_compile`, encoding). Executor failure must FAIL validation.
2. **Configurable graph.** Topology comes from the UI JSON — compiled in `build_dynamic_graph`. Conditional routers still resolve targets by **node type** (first planner / validator / human_gate / …).
3. **Simplified default.** Code understanding is inlined in Planner; validation routing runs from Validator when no Decision node is present. Decision + Code Understanding remain in `NODE_MAP` for legacy graphs.
4. **Bounded autonomy.** `max_plan_revisions` (Plan Review), `maxRetries` (Validator); exhausted → safe stop / forced path.
5. **HITL gates.** LangGraph `interrupt_before` on `plan_review` and `human_gate`; resume via `/resume` with `action` + optional `feedback`.
6. **Workspace isolation.** Uploads land in `backend/workspaces/<uuid>/`; executor writes there.
7. **Validation retries skip plan HITL.** On FAIL with retries left, validator sets `skip_plan_review` + `plan_feedback`. Planner sets `plan_approved=True` for that retry; `after_planner_route` keys off `plan_approved` (because planner consumes the skip flag).

### Graph compiler routing (important)

| Source type | Behavior |
|---|---|
| `planner` | Conditional → `plan_review` or `executor` (`after_planner_route`) |
| `plan_review` | Conditional → `planner` or `executor` (`should_replan`) |
| `validator` (no Decision on canvas) | Conditional → `planner` / `human_approval` / `end` (`should_human_approve`) |
| `decision` (legacy) | Same validation router as above |
| `human_gate` | Conditional → `planner` or `end` (`should_finish_after_review`) |
| other | Static edge |

Orphan / after-End / randomly wired nodes are mostly ignored; free-form canvas ≠ free-form control flow.

### Resume actions (`POST /api/workflows/{run_id}/resume`)

| `action` | Effect |
|---|---|
| `approve_plan` | `plan_approved=true` → route to executor |
| `send_plan_feedback` | set `plan_feedback`, replan |
| `approve_code` | `human_approved=true` → end |
| `request_code_changes` | feedback → planner |

`pause_reason` in `state_json` is **always inferred from the next interrupt node** (`plan_review` | `code_review`; optionally `criteria_review` if that gate is wired).

### LLM defaults (important)

- Default: **`gemini-2.5-flash`**
- Retired IDs (`gemini-1.5-pro`, `gemini-1.5-flash`, etc.) are remapped in `get_llm`
- Unsupported UI labels (gpt/claude/o1) remap to Gemini Flash when `GOOGLE_API_KEY` is set
- Content may be `str` **or** list of blocks → always run through `normalize_llm_content`
- Token/cost metrics aggregated into `state.llm_usage` and shown in MissionBar

## Frontend

Ports-and-adapters layout under `frontend/src/`:

| Layer | Path | Owns |
|---|---|---|
| Composition | `app/page.tsx` | Adapters, mission state, default 8-node graph, wiring |
| Domain | `domain/types.ts` | Mission, pause reason, run/event types, `LlmUsage` |
| Ports | `ports/WorkflowApiPort.ts`, `ports/RunEventsPort.ts` | Interfaces |
| Adapters | `adapters/http/HttpWorkflowAdapter.ts`, `adapters/mock/MockRunEventsAdapter.ts` | HTTP + in-memory events |
| Application | `application/useWorkflowRun.ts`, `usePrepareMission.ts`, `nodeRegistry.ts`, `projectRunView.ts` | Run/prepare logic, projections |
| L1 Mission | `components/mission/MissionBar.tsx` | Objective, upload, Prepare/Run, Export/Import, usage chip |
| L2 Workflow | `components/workflow/*`, `CustomNode.tsx` | Canvas, library, inspector |
| L3 Control | `components/control/*` | Console, timeline, PlanReview, CodeReview, ResultPanel, HumanGatePanel |
| Utils | `utils/nodeConverter.ts` | Workflow JSON export/import (`version: 1`) |

### Upload path

Browser folder picker (`webkitdirectory`) → client JSZip (skips `node_modules`/`.git`, size caps) → `POST /api/upload` → `workspaceId` on mission → passed into `run({ objective, workspaceId })`. Empty workspace supported.

### After Task Successful

`ResultPanel` shows change summary, file tree browse, and download ZIP (`/api/workspaces/{id}/download`).

## Data model (Postgres)

- **Workflow** — named workflow metadata  
- **WorkflowVersion** — `graph_json` (nodes + edges); also created as a side-effect of each **Run**  
- **WorkflowRun** — `status` (`running|paused|completed|failed`), `state_json`  
- **WorkflowEvent** — schema exists; **not yet written by runtime** (UI still uses mock event bus + SSE log stream)

There is **no** separate template gallery / `is_template` flag (attempted then reverted).

## Docker notes

- `docker-compose.yml`: Postgres + backend (hot reload) + frontend (hot reload)
- Frontend mounts anonymous volumes for `/app/node_modules` and `/app/.next`  
  → **host `npm install` does not update the container**. After adding deps:  
  `docker compose exec frontend npm install` or rebuild with `--renew-anon-volumes`
- Backend: `env_file: ./backend/.env`
