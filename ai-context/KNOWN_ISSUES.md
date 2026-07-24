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

## Orchestration semantics

7. **Empty `plan` string** used to pass the frontend `typeof plan === "string"` check and show “No plan content.” Planner now rejects empty and writes a fallback plan.
8. **Executor failure used to still PASS validation** (syntax check on untouched tree) and land in code review with an error summary. Validator now fails on executor failure markers.
9. **`pause_reason` must be inferred from `snapshot.next`**, not only from leftover state (stale `plan_review` after executor).
10. **`WorkflowEvent` table is unused**; Run Console progress is largely client-projected / mock-seeded — not a full receipt trail yet.
11. **Checkpointer is in-memory (`MemorySaver`).** Backend container restart loses pause/resume threads; DB `state_json` remains for inspection but cannot resume the LangGraph thread.

## Upload / workspaces

12. Zip Slip must stay guarded in `api/upload.py` (`_safe_extract`).
13. Workspaces persist under `backend/workspaces/` until manually cleaned; download via `GET /api/workspaces/{id}/download`.

## React Flow

14. Warning *“parent container needs a width and a height”* can appear during layout; usually cosmetic if the canvas eventually renders.
