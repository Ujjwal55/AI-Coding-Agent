# Frontend ↔ Backend Wiring Guide

Handoff map for connecting the 3-layer Control Plane UI to the FastAPI / LangGraph backend.  
UI is built as a **microservice-ready modular monolith** (ports & adapters). Do **not** rewrite L1/L2/L3 components when swapping transports.

---

## 1. SOLID / module ownership

| Layer | Location | Owns | Must not own |
|---|---|---|---|
| Presentation L1 | `frontend/src/components/mission/` | Ask, Select repo, Import/Export, Run | `fetch`, mock seeds |
| Presentation L2 | `frontend/src/components/workflow/` | Canvas / library / inspector UI | Run orchestration |
| Presentation L3 | `frontend/src/components/control/` | Console / timeline / gate UI | HTTP URLs |
| Application | `frontend/src/application/` | Run / Resume / projections / `nodeRegistry` | JSX layout |
| Utils | `frontend/src/utils/nodeConverter.ts` | Import/Export node ↔ JSON | HTTP |
| Ports | `frontend/src/ports/` | Interfaces only | Implementations |
| Adapters | `frontend/src/adapters/` | HTTP + mock I/O | React components |
| Domain | `frontend/src/domain/types.ts` | Shared FE contracts | UI |
| Composition root | `frontend/src/app/page.tsx` | Construct adapters, wire hooks | Business rules in JSX |

**Dependency rule:** Presentation → Application → Ports ← Adapters.

---

## 2. Ports → adapters → API → backend

| FE port / method | Adapter (now) | HTTP / behavior | Backend file(s) | Logic |
|---|---|---|---|---|
| `WorkflowApiPort.createWorkflow` | `HttpWorkflowAdapter` | `POST /api/workflows/` | `backend/api/workflow.py` | Insert `Workflow` row |
| `WorkflowApiPort.saveVersion` | `HttpWorkflowAdapter` | `POST /api/workflows/{id}/versions` | `backend/api/workflow.py`, `backend/models/workflow.py` | Persist React Flow `graph_json` as `WorkflowVersion` |
| `WorkflowApiPort.run` | `HttpWorkflowAdapter` | `POST /api/workflows/{version_id}/run` body `{ objective, repo_path }` | `backend/api/workflow.py` `RunRequest`, `runtime.py`, `graph.py` | Build LangGraph; seed `GraphState.objective` + `repo_path` |
| `WorkflowApiPort.resume` | `HttpWorkflowAdapter` | `POST /api/workflows/{run_id}/resume` | `backend/api/workflow.py`, `runtime.py` | Resume with `state_updates` |
| `RunEventsPort.*` | `MockRunEventsAdapter` | Local only | `WorkflowEvent` unused | Future SSE stream |
| Import/Export | `nodeConverter.ts` | Local file only | N/A | Interchange `{ version: 1, nodes, edges }` |
| Executor `data.command` | Via `graph_json` | Node config | `nodes.py` | Shell in allowlisted cwd |
| Select repo | Mission state → Run body | `repo_path` | `nodes.resolve_repo_cwd` | cwd under `WORKSPACE_ROOT` / `backend/` |

Base URL: `process.env.NEXT_PUBLIC_API_URL` || `http://localhost:8000`

---

## 3. UI component → wiring

| UI piece | User action | Calls today |
|---|---|---|
| `MissionBar` Ask | Set objective | Mission state; required for Run |
| `MissionBar` Select repo | Set `repoPath` (default `target_repo`) | Sent on Run as `repo_path` |
| `MissionBar` Import / Export | Load/save workflow JSON | `parseWorkflowFile` / `downloadWorkflowFile` |
| `MissionBar` Run | Start orchestrator | `startRun` → save version + `run({ objective, repoPath })`; syncs objective into Objective node |
| Canvas (no Import) | Default template | `initialNodes` / `initialEdges` in `page.tsx` become `graph_json` |
| `HumanGatePanel` Approve | Resume | `resume` with `success_criteria` |

**Removed:** Attach file, Prepare.

---

## 4. Working today vs gaps

### Working
- Default canvas graph or Import → `graph_json`
- Ask prompt → `GraphState.objective` on Run
- Select repo → allowlisted Executor cwd (`repo_path`)
- Import/Export via `nodeConverter`
- Create → version → run → pause → resume

### Gaps
1. Event stream (SSE) still mock on FE
2. Async non-blocking runs
3. Real cancel API
4. Repo browser / clone-from-URL
5. Human gate `human_approved` still thin

---

## 5. Event schema (align FE ↔ BE)

Backend: `node_started | node_completed | error | approval_requested`  
Frontend also: `run_started | run_completed | run_cancelled`

---

## 6. Swap mock events → real

Replace `MockRunEventsAdapter` in `page.tsx` with an SSE adapter implementing `RunEventsPort`. Leave L1/L2/L3 unchanged.

---

## 7. Future microservice seams (docs only)

| Future service | Owns | Today |
|---|---|---|
| Workspace | objective, repo | Mission bar + RunRequest |
| Workflow Definition | graph CRUD | versions + Import/Export |
| Orchestrator | compile + run | `graph.py`, `runtime.py` |
| Events | stream | `WorkflowEvent` |
| HITL | approvals | resume |

---

## 8. Quick file index

```text
frontend/src/
  utils/nodeConverter.ts
  domain/types.ts
  ports/WorkflowApiPort.ts
  ports/RunEventsPort.ts
  adapters/http/HttpWorkflowAdapter.ts
  adapters/mock/MockRunEventsAdapter.ts
  application/useWorkflowRun.ts
  application/projectRunView.ts
  application/nodeRegistry.ts
  components/mission/MissionBar.tsx
  components/workflow/...
  components/control/...
  app/page.tsx

backend/
  api/workflow.py          # RunRequest: objective, repo_path
  orchestrator/state.py    # repo_path on GraphState
  orchestrator/runtime.py  # initial_state from API
  orchestrator/nodes.py    # resolve_repo_cwd allowlist
```
