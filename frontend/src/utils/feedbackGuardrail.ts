/**
 * Client-side mirror of backend `classify_human_feedback` heuristics.
 * Instant UX; server still enforces on /resume.
 */

const GREETING_RE =
  /^\s*(hi+|h+e+y+|hello+|howdy|yo+|sup|good\s*(morning|afternoon|evening|night)|thanks?|thank\s*you|ty|thx|bye+|goodbye|see\s*ya|ok+|okay|k+|sure|lol+|lmao+|haha+|hehe+|what'?s\s*up|how\s*are\s*you|who\s*are\s*you|test|testing|asdf+|qwerty+|xxx+)[\s!.?]*$/i;

const FEEDBACK_HINTS =
  /\b(add|remove|delete|change|update|fix|instead|also|don't|do\s*not|should|need|needs|prefer|please|make|use|rename|move|split|merge|simplify|refactor|include|exclude|missing|wrong|incorrect|broken|bug|error|fail|failing|test|file|function|class|api|endpoint|rate\s*limit|auth|login|ui|page|component|path|module|import|more|less|longer|shorter|clearer|specific|detail|step)\b/i;

const CODING_HINTS =
  /\b(add|create|implement|build|write|fix|bug|feature|refactor|update|delete|remove|rename|migrate|deploy|test|api|endpoint|function|method|class|module|file|folder|repo|code|python|javascript|typescript|react|fastapi|sql|database|schema|auth|login|ui|page|component|error|exception|crash|performance|optimize|docker|route|handler|script|cli|json|yaml|config)\b/i;

const FEEDBACK_REJECT =
  "That doesn’t look like actionable review feedback.\n\n" +
  "Describe a concrete change (e.g. “Also add input validation” or " +
  "“Use add.py instead of hello_world.py”). Chat like “Hi” / “ok” / " +
  "“lol” won’t replan — Approve if you’re happy with the current result.";

export function validateHumanFeedback(
  feedback: string,
  context: "plan" | "code" = "plan",
): { ok: boolean; message?: string } {
  const text = feedback.trim();
  const label = context === "plan" ? "plan" : "code";

  if (!text) {
    return {
      ok: false,
      message: `Feedback is empty. Write a concrete ${label} change request, or use Approve instead.`,
    };
  }

  if (GREETING_RE.test(text)) {
    return { ok: false, message: FEEDBACK_REJECT };
  }

  const words = text.match(/[A-Za-z0-9_+.-]+/g) ?? [];
  if (
    words.length <= 2 &&
    !FEEDBACK_HINTS.test(text) &&
    !CODING_HINTS.test(text)
  ) {
    return {
      ok: false,
      message: `“${text}” isn’t actionable ${label} feedback.\n\n${FEEDBACK_REJECT}`,
    };
  }

  if (
    words.length <= 4 &&
    !FEEDBACK_HINTS.test(text) &&
    !CODING_HINTS.test(text)
  ) {
    return {
      ok: false,
      message: `“${text}” is too vague to replan from.\n\n${FEEDBACK_REJECT}`,
    };
  }

  return { ok: true };
}

/** Pull a readable message from a FastAPI HTTP error body. */
export function parseApiErrorDetail(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail)) {
      return parsed.detail
        .map((d) =>
          typeof d === "object" && d && "msg" in d
            ? String((d as { msg: string }).msg)
            : String(d),
        )
        .join("; ");
    }
  } catch {
    /* use raw */
  }
  return raw || "Request failed";
}
