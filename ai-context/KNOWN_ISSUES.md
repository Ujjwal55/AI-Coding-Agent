# Known issues & traps

Read this before debugging “why is my run weird?”

## LLM / models

1. **`gemini-1.5-pro` / `gemini-1.5-flash` → 404 NOT_FOUND** on current Google API keys.  
   Fix: use `gemini-2.5-flash` (default). Remaps exist in `agents/llm.py`, but any *hardcoded* old ID in node inspector data from an old canvas can still confuse humans reading logs.
2. **Circuit breaker message is misleading.** It fires on *any* primary failure (404, auth, quota), not only rate limits. Then Qwen 0.5B may return **empty** text → empty plan / no WRITE_FILE blocks.
3. **Gemini content shape.** Sometimes `response.content` is a **list of blocks**, not a string. Always use `normalize_llm_content`.
4. **Inspector used to offer gpt/claude/o1** — backend never supported them; they remapped to Groq/Gemini. Prefer Gemini Flash in the UI.

## Docker / frontend deps

5. **`Module not found: Can't resolve 'jszip'`** inside Compose: anonymous `/app/node_modules` volume. Host `npm install` does not help.  
   Fix: `docker compose exec frontend npm install` **or** rebuild with `--renew-anon-volumes`.  
   Historical jszip errors may still appear **above** newer “Ready” lines in the same compose log scrollback.
6. Backend hot-reload watches `/app`; **env_file changes need recreate** (`docker compose up -d --force-recreate backend`).
6b. **EC2 / remote UI calling `localhost:8000`.** The browser runs on the *user* machine, so `NEXT_PUBLIC_API_URL=http://localhost:8000` hits the laptop, not EC2 (often looks like a CORS error). Frontend now auto-uses `http(s)://{page-host}:8000` when the page is not on localhost. Ensure security group opens **8000** as well as 3000. CORS uses `allow_origins=*` with `allow_credentials=False` (wildcard + credentials is rejected by browsers).

## Orchestration semantics

7. **Empty `plan` string** used to pass the frontend `typeof plan === "string"` check and show “No plan content.” Planner now rejects empty and writes a fallback plan.
8. **Executor failure used to still PASS validation** (syntax check on untouched tree) and land in code review with an error summary. Validator now fails on executor failure markers.
9. **`pause_reason` must be inferred from `snapshot.next`**, not only from leftover state (stale `plan_review` after executor).
10. **`WorkflowEvent` table is unused**; Run Console progress is largely client-projected / mock-seeded — not a full receipt trail yet. SSE `/api/workflows/logs/stream` carries live backend logs separately.
11. **Checkpointer is in-memory (`MemorySaver`).** Backend container restart loses pause/resume threads; DB `state_json` remains for inspection but cannot resume the LangGraph thread.
12. **Validation retry + plan review.** Planner clears `skip_plan_review` in its return value. Routing must use `plan_approved` in `after_planner_route` (already fixed). Do not “fix” by only checking `skip_plan_review` after the planner node.
13. **Canvas wiring is not free-form.** Conditional routers find the *first* node of each type. Extra / orphan / after-End nodes are ignored. Adding library nodes rarely creates a second agent path.
14. **Criteria HumanGatePanel** can show for `criteria_review`, but default `interrupt_before` is only `[plan_review, human_gate]` — so criteria edit is usually skipped unless the graph is changed.

## Upload / workspaces

15. Zip Slip must stay guarded in `api/upload.py` (`_safe_extract`).
16. Workspaces persist under `backend/workspaces/` until manually cleaned; download via `GET /api/workspaces/{id}/download`.

## Templates / export

17. **No DB template gallery.** A short-lived `is_template` migration/UI was reverted. Use MissionBar **Export / Import** JSON for reusable graphs. Run still creates ephemeral Workflow + Version rows named like “UI Generated Workflow”.
18. If a local DB somehow has an `is_template` column from that attempt, it is unused; stamp Alembic to `001_initial` if upgrade complains about a missing `002` revision.

## React Flow

19. Warning *“parent container needs a width and a height”* can appear during layout; usually cosmetic if the canvas eventually renders.
