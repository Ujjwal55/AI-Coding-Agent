# AI Context — Start Here

**Repo:** [Ujjwal55/AI-coding-loop](https://github.com/Ujjwal55/AI-coding-loop)  
**Hackathon track:** Track B — Loop Engineering Platform (Deutsche Telekom Digital Labs Talent Hack)  
**Purpose of this folder:** Onboard any new AI chat / developer onto the *current* architecture, flow, and change history without re-deriving it from scratch.

## Read order (new chat)

1. **This file** — orientation + how to use the pack  
2. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system shape, stack, modules  
3. [`SPEC_DRIVEN_FLOW.md`](./SPEC_DRIVEN_FLOW.md) — the product loop (upload → plan review → code → validate)  
4. [`MAP.md`](./MAP.md) — “where is X?” file map  
5. [`CHANGELOG.md`](./CHANGELOG.md) — what changed and why  
6. [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md) — traps that already burned time  

> Root `ARCHITECTURE_AND_FEATURES.md` is **stale** (pre–spec-driven / still mentions SQLite + mock validator). Prefer **this folder**.

## One-sentence product summary

A **visual control plane** (React Flow canvas) that lets an engineer upload a repo, state a coding objective, have agents propose a plan, **human-approve or revise that plan**, then apply code changes in an isolated workspace, validate deterministically, and pause again for code review — with bounded retries.

## Stack (current)

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, `@xyflow/react`, Tailwind 4, JSZip |
| Backend | FastAPI, LangGraph, LangChain (Gemini / Groq + local Qwen fallback) |
| DB | Postgres 15 (SQLAlchemy async + Alembic) |
| Run | `docker compose` (db + backend + frontend) |

## Quick start

```bash
# from repo root
docker compose up --build

# UI  http://localhost:3000
# API http://localhost:8000/health
```

Backend env: `backend/.env` with `GOOGLE_API_KEY` and/or `GROQ_API_KEY` (compose loads `env_file: ./backend/.env`).

**Default LLM:** `gemini-2.5-flash` (legacy `gemini-1.5-*` is remapped — those IDs 404 on current Google API keys).

## Default graph (canvas) — simplified 8-node loop

```
objective (+ intent guardrail)
   ├─ conversation / gibberish → END (ResultPanel explains)
   └─ coding_task → criteria → planner → plan_review
                                      ├─ (feedback) → planner   [bounded]
                                      └─ (approve)  → executor → validator
                                                                  ├─ FAIL → planner / end   [maxRetries]
                                                                  └─ PASS → human_gate (code review)
                                                                                      ├─ approve → Task Successful
                                                                                      └─ changes → planner
```
**Folded / internalized (not on the default canvas):**

| Former node | Where it lives now |
|---|---|
| Code Understanding | Runs **inside Planner** when `code_summary` is missing |
| Decision | Routing + `skip_plan_review` owned by **Validator** (`maxRetries` on Validator inspector). Legacy Decision node still compiles if present. |

Interrupts: `interrupt_before = [plan_review, human_gate]`.

Node library hides `code_understanding` and `decision` (still in registry for legacy graphs). Free-form extra nodes rarely help — routers resolve by **first node of each type**.

## How to keep this pack fresh

When you land a meaningful change, append a dated bullet to [`CHANGELOG.md`](./CHANGELOG.md) and update the relevant section in `ARCHITECTURE.md` / `SPEC_DRIVEN_FLOW.md` / `KNOWN_ISSUES.md`. Treat this folder as living docs for agents — not marketing.
