# Frontend ↔ Backend Wiring Guide

Handoff map for connecting the 3-layer Control Plane UI to the FastAPI / LangGraph backend.  
UI is built as a **microservice-ready modular monolith** (ports & adapters). Do **not** rewrite L1/L2/L3 components when swapping transports.

---

## 1. SOLID / module ownership

| Layer | Location | Owns | Must not own |
|---|---|---|---|
| Presentation L1 | `frontend/src/components/mission/` | Mission UI only | `fetch`, mock seeds |
| Presentation L2 | `frontend/src/components/workflow/` | Canvas / library / inspector UI | Run orchestration |
| Presentation L3 | `frontend/src/components/control/` | Console / timeline / gate UI | HTTP URLs |
| Application | `frontend/src/application/` | Prepare / Run / Resume / projections / `nodeRegistry` | JSX layout |
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
| `WorkflowApiPort.run` | `HttpWorkflowAdapter` | `POST /api/workflows/{version_id}/run` | `backend/api/workflow.py`, `backend/orchestrator/runtime.py`, `backend/orchestrator/graph.py` | Build LangGraph from JSON, `ainvoke`, checkpoint |
| `WorkflowApiPort.resume` | `HttpWorkflowAdapter` | `POST /api/workflows/{run_id}/resume` | `backend/api/workflow.py`, `backend/orchestrator/runtime.py` | Resume from `MemorySaver` with `state_updates` |
| `RunEventsPort.*` | `MockRunEventsAdapter` | **Local only** (no HTTP yet) | `backend/models/workflow.py` (`WorkflowEvent`), unused | Future: write/stream events during node execution |
| Prepare (local) | `usePrepareMission` | No API | Future: `GraphState.objective` in `backend/orchestrator/state.py` | Syncs mission text into Objective node data |
| Executor `data.command` | Via `graph_json` on saveVersion | Carried in node config | `backend/orchestrator/nodes.py` | Shell command in `target_repo/` |
| Decision routing | Graph edges + node type | Compiled at run | `backend/agents/decision.py`, `backend/orchestrator/graph.py` | Conditional edges / retries |
| Criteria agent | Pause before planner | Returned in `state_json` | `backend/agents/success_criteria.py`, interrupt in `graph.py` | HITL criteria edit |

Base URL: `process.env.NEXT_PUBLIC_API_URL` || `http://localhost:8000`  
(`HttpWorkflowAdapter`)

---

## 3. UI component → wiring

| UI piece | User action | Calls today | Future connection |
|---|---|---|---|
| `MissionBar` Prepare | Validate + sync objective | `usePrepareMission` → local nodes + `RunEventsPort.append(prepared)` | POST RunIntent / mission prepare endpoint |
| `MissionBar` Attach / Select repo | Local chips | Mission state in `page.tsx` | Workspace service: upload + repo mount for Executor cwd |
| `MissionBar` Run | Start orchestrator | `useWorkflowRun.startRun` → `WorkflowApiPort` + `RunEventsPort.seedDemoRun` | Same API, plus kick off real event stream |
| `NodeLibrary` / `WorkflowCanvas` | Edit topology | React Flow state | Still `graph_json` on version save |
| `NodeInspector` Config | Edit model/prompt/command | Node `data` fields | Already consumed by dynamic compiler / executor |
| `NodeInspector` Execution | Read-only | `projectNodeExecution(events)` | Same projection fed by real `WorkflowEvent` stream |
| `RunConsole` | Observe logs | `projectConsoleLines(events)` | SSE/poll `GET /api/workflows/runs/{id}/events` |
| `RunTimeline` | Observe steps | `projectTimeline(events)` | Same events; include attempt ids for retries |
| `HumanGatePanel` Approve | Resume paused run | `WorkflowApiPort.resume` with `success_criteria` | Also `human_approved` for human_gate interrupt |
| `HumanGatePanel` / Cancel | Local cancel | `cancelLocal` + `eventsPort.reset` | Need real cancel/interrupt API |
| `CustomNode` status badge | Visual | `projectNodeStatuses(events)` → `data.status` | Same |

---

## 4. Working today vs gaps

### Working
- Create workflow → save version (`graph_json`) → run → pause → resume criteria
- Dynamic graph compile (`NODE_MAP` in `backend/orchestrator/graph.py`)
- L1/L2/L3 shell always visible (inspector + console not XOR)
- Mock events drive console, timeline, node colors

### Gaps (backend + thin FE adapter swap)
1. **Event stream** — `WorkflowEvent` model exists; nothing writes or serves it. Add writers in runtime/nodes + `GET` or SSE endpoint. FE: new `SseRunEventsAdapter` implementing `RunEventsPort`.
2. **RunIntent** — objective / repo / attachments not sent on run. Extend run request body → `GraphState`.
3. **Async run** — `ainvoke` blocks HTTP; live mid-run UI needs background job + events.
4. **Cancel** — UI-only today.
5. **Repo / attachments** — mock strings; Executor still uses fixed `target_repo/`.
6. **Human gate approve flag** — criteria resume works; explicit `human_approved` for approval node still thin.

---

## 5. Event schema (align FE ↔ BE)

Backend (`WorkflowEvent` / `WorkflowEventRead`):

```text
id, run_id, event_type, node_id, payload, created_at
event_type: node_started | node_completed | error | approval_requested
```

Frontend (`UiEvent` in `domain/types.ts`):

```text
id, runId, eventType, nodeId, message, payload, createdAt
eventType also allows: prepared | run_started | run_completed | run_cancelled
```

When implementing SSE, map snake_case API → camelCase `UiEvent` inside the adapter (keep domain types stable).

---

## 6. Swap mock events → real (no UI rewrite)

1. Implement `SseRunEventsAdapter` (or `PollingRunEventsAdapter`) in `frontend/src/adapters/http/` satisfying `RunEventsPort`.
2. In `page.tsx` composition root only:

```ts
// const eventsPort = new MockRunEventsAdapter();
const eventsPort = new SseRunEventsAdapter();
```

3. Keep `projectRunView.ts` and all L3 components unchanged.

---

## 7. Future microservice seams (docs only)

| Future service | Owns | Today’s code to extract later |
|---|---|---|
| Workspace / Mission | objective, files, repo | Mission state + Prepare; new BE module |
| Workflow Definition | graph CRUD / versions | `api/workflow.py` version routes, `models/workflow.py` |
| Orchestrator | compile + run graph | `orchestrator/graph.py`, `runtime.py`, agents |
| Events | stream node lifecycle | `WorkflowEvent` + new stream API |
| HITL / Control | approvals, cancel | resume + future approval queue |

FE already mirrors these as folders/ports so the UI does not need a rewrite when services split.

---

## 8. Quick file index

```text
frontend/src/
  domain/types.ts
  ports/WorkflowApiPort.ts
  ports/RunEventsPort.ts
  adapters/http/HttpWorkflowAdapter.ts
  adapters/mock/MockRunEventsAdapter.ts
  application/usePrepareMission.ts
  application/useWorkflowRun.ts
  application/projectRunView.ts
  application/nodeRegistry.ts
  components/mission/MissionBar.tsx
  components/workflow/{NodeLibrary,WorkflowCanvas,NodeInspector}.tsx
  components/control/{RunConsole,RunTimeline,HumanGatePanel}.tsx
  components/CustomNode.tsx
  app/page.tsx                    # composition root

backend/
  api/workflow.py
  models/workflow.py              # WorkflowEvent unused for streaming
  schemas/workflow.py             # WorkflowEventRead ready
  orchestrator/{graph,runtime,nodes,state}.py
  agents/{success_criteria,decision}.py
```
