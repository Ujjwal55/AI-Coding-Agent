# File map — “where is X?”

## Backend

| Want… | Look at… |
|---|---|
| Mount routers / CORS / startup migrations | `backend/main.py` |
| Run / resume / objective+workspace into state | `backend/api/workflow.py` |
| Zip upload / tree / download / zip-slip | `backend/api/upload.py` |
| Graph compile + interrupts + conditional edges | `backend/orchestrator/graph.py` |
| Plan (incl. inline understanding) / execute / validate | `backend/orchestrator/nodes.py` |
| Pause/resume + MemorySaver + pause_reason | `backend/orchestrator/runtime.py` |
| Shared LangGraph state fields (`llm_usage`, plan flags) | `backend/orchestrator/state.py` |
| Replan / validation / code-review routers | `backend/agents/decision.py` |
| Model factory, remaps, content normalize, cost metrics | `backend/agents/llm.py` |
| Criteria generation | `backend/agents/success_criteria.py` |
| Repo analysis summary | `backend/agents/code_understanding.py` |
| DB models | `backend/models/workflow.py` |
| Alembic | `backend/alembic/` |
| Uploaded repos on disk | `backend/workspaces/` (gitignored) |
| Local Qwen GGUF cache | `backend/models_cache/` (gitignored) |
| API keys | `backend/.env` (see `.env.example`) |

## Frontend

| Want… | Look at… |
|---|---|
| Composition root / default 8 nodes & edges | `frontend/src/app/page.tsx` |
| Folder zip + upload + export/import + run wiring | same + `MissionBar.tsx` |
| Pause routing / approve plan / code / criteria | `frontend/src/application/useWorkflowRun.ts` |
| HTTP client | `frontend/src/adapters/http/HttpWorkflowAdapter.ts` |
| API port contract | `frontend/src/ports/WorkflowApiPort.ts` |
| Mock live events | `frontend/src/adapters/mock/MockRunEventsAdapter.ts` |
| Node type registry (library hides CU + Decision) | `frontend/src/application/nodeRegistry.ts` |
| Plan / code review / result / criteria panels | `frontend/src/components/control/*` |
| Workflow JSON export/import | `frontend/src/utils/nodeConverter.ts` |
| Domain types (`PauseReason`, `LlmUsage`, mission) | `frontend/src/domain/types.ts` |

## Ops / docs

| Want… | Look at… |
|---|---|
| Compose services | `docker-compose.yml` |
| Older wiring notes (partially outdated) | `docs/FRONTEND_BACKEND_WIRING.md` |
| **Current** agent onboarding | `ai-context/` (this pack) |
| Stale high-level doc | `ARCHITECTURE_AND_FEATURES.md` → prefer `ai-context/` |

## Adding a new graph node type

1. Implement / import the Python callable  
2. Register in `NODE_MAP` (`graph.py`)  
3. If it needs special routing, extend the conditional edge block in `build_dynamic_graph`  
4. Add to `NODE_REGISTRY` + `CustomNode` icon/color (and `HIDDEN_FROM_LIBRARY` if internal)  
5. Wire default edges in `page.tsx` only if it belongs in the **default** loop  
6. Update `ai-context/CHANGELOG.md`

## Default canvas nodes (current)

`objective` → `criteria` → `planner` → `plan_review` → `executor` → `validator` → `human_gate` → `end` (“Task Successful”)
