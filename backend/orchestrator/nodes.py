from orchestrator.state import GraphState
from typing import Dict, Any
import asyncio
import os
from agents.llm import get_llm, normalize_llm_content
from langchain_core.messages import SystemMessage, HumanMessage
from utils.logger import get_logger

logger = get_logger(__name__)

WORKSPACES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspaces"))
STEP_DELAY_SECONDS = float(os.getenv("STEP_DELAY_SECONDS", "10"))


async def planner_node(state: GraphState) -> Dict[str, Any]:
    """
    AI Planner: Generates a spec-driven implementation plan using:
    - The user's objective
    - Success criteria
    - Codebase analysis (runs understanding inline when missing)
    - Any human feedback from a previous iteration
    """
    config = state.get("_current_node_config", {})
    objective = state.get("objective", "Build feature requirement")
    criteria = state.get("success_criteria", [])
    plan_feedback = state.get("plan_feedback", None)
    previous_plan = state.get("plan", None)
    model_name = config.get("model", "gemini-2.5-flash")
    extra_instructions = (config.get("instructions") or "").strip()

    # Fold Code Understanding into Planner when no prior summary exists
    # (e.g. simplified graphs without a separate understanding node).
    understand_updates: Dict[str, Any] = {}
    code_summary = (state.get("code_summary") or "").strip()
    if not code_summary or code_summary == "No codebase context available.":
        from agents.code_understanding import code_understanding_node

        understand_updates = await code_understanding_node(state)
        code_summary = (
            (understand_updates.get("code_summary") or "").strip()
            or "No codebase context available."
        )

    llm = get_llm(model_name)

    system_prompt = """You are an expert software architect and implementation planner.
Your job is to create a detailed, actionable implementation plan for modifying an existing codebase.

Your plan MUST include:
1. **Summary**: A brief overview of what will be changed and why.
2. **Files to Modify**: List each file that needs changes, with:
   - The file path
   - What specifically will change in that file
   - The reasoning behind the change
3. **Files to Create**: Any new files needed, with their purpose.
4. **Files to Delete**: Any files that should be removed.
5. **Implementation Steps**: A numbered, ordered list of steps to execute the changes.
6. **Testing Strategy**: How to verify the changes work correctly.

Format the plan in clean markdown. Be specific about file paths and code changes.
Reference actual files and structures from the codebase summary provided."""

    if extra_instructions:
        system_prompt += f"\n\nAdditional instructions from the engineer:\n{extra_instructions}"

    human_prompt_parts = [f"## Objective\n{objective}"]

    if criteria:
        human_prompt_parts.append(f"## Success Criteria\n" + "\n".join(f"- {c}" for c in criteria))

    human_prompt_parts.append(f"## Codebase Analysis\n{code_summary}")

    if plan_feedback and previous_plan:
        human_prompt_parts.append(f"## Previous Plan\n{previous_plan}")
        human_prompt_parts.append(f"## Human Feedback on Previous Plan\n{plan_feedback}")
        human_prompt_parts.append("\nPlease revise the implementation plan based on the feedback above.")
    else:
        human_prompt_parts.append("\nPlease generate a detailed implementation plan.")

    prompt = "\n\n".join(human_prompt_parts)

    def _fallback_plan(reason: str) -> str:
        criteria_block = "\n".join(f"- {c}" for c in criteria) if criteria else "- (none)"
        obj_l = (objective or "").lower()
        # Derive a sensible filename from the objective instead of always hello_world.py
        if "add" in obj_l or "sum" in obj_l:
            filename = "add.py"
            summary = "Create a Python module with an `add` function that returns the sum of its arguments."
            steps = (
                "1. Create `add.py` at the workspace root.\n"
                "2. Define `def add(a, b):` (and optionally `*args`) that returns the numeric sum.\n"
                "3. Include a small `if __name__ == '__main__':` demo that prints `add(2, 3)`.\n"
            )
            testing = (
                "- Run `python3 -c \"from add import add; assert add(2, 3) == 5\"`.\n"
                "- Run `python3 -m py_compile add.py`.\n"
            )
        else:
            safe = "".join(ch if ch.isalnum() else "_" for ch in (objective or "solution")[:24]).strip("_") or "solution"
            filename = f"{safe.lower()}.py"
            summary = f"Implement the objective in `{filename}`: {objective}"
            steps = (
                f"1. Create `{filename}` at the workspace root.\n"
                "2. Implement the requested behavior as clear functions with a small demo entrypoint.\n"
                "3. Avoid unrelated file changes.\n"
            )
            testing = (
                f"- Run `python3 -m py_compile {filename}`.\n"
                f"- Run `python3 {filename}` and confirm it executes without errors.\n"
            )

        return (
            f"## Implementation Plan\n\n"
            f"**Objective:** {objective}\n\n"
            f"### Summary\n{summary}\n\n"
            f"### Success Criteria\n{criteria_block}\n\n"
            f"### Files to Create\n"
            f"- `{filename}` — implements the requested behavior\n\n"
            f"### Implementation Steps\n{steps}\n"
            f"### Testing Strategy\n{testing}\n"
            f"*Note: {reason}*"
        )

    try:
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=prompt)
        ])
        plan = normalize_llm_content(response.content)

        if not plan:
            # Circuit-breaker / tiny local models often return "" without raising.
            logger.warning("Planner returned empty content; using fallback plan")
            plan = _fallback_plan("Primary/fallback LLM returned empty plan text")
    except Exception as e:
        logger.error(f"Planner LLM failed: {e}")
        plan = _fallback_plan(f"LLM call failed — {str(e)[:80]}")

    skip_review = bool(state.get("skip_plan_review"))
    return {
        **understand_updates,
        "plan": plan,
        # Auto-approve when this is a validation-driven retry (human already OK'd a plan).
        "plan_approved": True if skip_review else False,
        "plan_feedback": None,   # Clear previous feedback (consumed above)
        "plan_revision": state.get("plan_revision", 0) + 1,
        "skip_plan_review": False,  # consume the one-shot skip flag
        "pause_reason": None if skip_review else "plan_review",
    }



async def executor_node(state: GraphState) -> Dict[str, Any]:
    """
    AI Executor: Uses LLM to generate actual code changes based on the approved plan.
    Reads files from the workspace, asks LLM to modify them, writes changes back.
    """
    config = state.get("_current_node_config", {})
    workspace_id = state.get("workspace_id")
    plan = state.get("plan", "No plan provided")
    objective = state.get("objective", "")
    code_summary = state.get("code_summary", "")
    model_name = config.get("model", "gemini-2.5-flash")
    extra_instructions = (config.get("instructions") or "").strip()

    if not workspace_id:
        return {
            "executor_output": "No workspace uploaded. Cannot execute code changes.",
            "current_attempt": state.get("current_attempt", 0) + 1,
            "artifacts": [],
            "code_changes_summary": "No workspace available.",
        }

    workspace_path = os.path.join(WORKSPACES_DIR, workspace_id)
    if not os.path.isdir(workspace_path):
        return {
            "executor_output": f"Workspace {workspace_id} not found.",
            "current_attempt": state.get("current_attempt", 0) + 1,
            "artifacts": [],
            "code_changes_summary": "Workspace directory missing.",
        }

    llm = get_llm(model_name)

    # Parse the plan to identify files that need modification
    # Read those files from the workspace
    files_content = {}
    for root, dirs, files in os.walk(workspace_path):
        # Skip hidden dirs and common non-source dirs
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'venv', '.git']]
        for fname in files:
            fpath = os.path.join(root, fname)
            rel_path = os.path.relpath(fpath, workspace_path)
            # Only read text-like source files under 30KB
            if os.path.getsize(fpath) > 30 * 1024:
                continue
            try:
                with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                files_content[rel_path] = content
            except Exception:
                continue

    # Build context for LLM
    files_context = ""
    for path, content in list(files_content.items())[:20]:  # Limit to 20 files
        files_context += f"\n--- FILE: {path} ---\n{content}\n"

    system_prompt = """You are an expert software engineer. You are given:
1. An implementation plan
2. The current source code of a project

Your job is to generate the EXACT code changes needed to implement the plan.

For EACH file you need to modify or create, output in this EXACT format:

===== WRITE_FILE: <relative_path> =====
<entire new file content>
===== END_FILE =====

For files to delete:
===== DELETE_FILE: <relative_path> =====

IMPORTANT RULES:
- Output the COMPLETE file content for each modified file (not just diffs).
- Only modify files that are relevant to the plan.
- Preserve existing code that doesn't need to change.
- Follow the existing code style and conventions.
- Make sure all imports are correct.
- Do NOT wrap the file content in markdown code blocks."""

    if extra_instructions:
        system_prompt += f"\n\nAdditional instructions from the engineer:\n{extra_instructions}"

    human_prompt = f"""## Objective
{objective}

## Implementation Plan
{plan}

## Current Source Code
{files_context}

Please generate the code changes now."""

    try:
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_prompt)
        ])
        llm_output = normalize_llm_content(response.content)

        # Parse LLM output and write files
        changes_made = []
        import re

        # Parse WRITE_FILE blocks
        write_pattern = r'===== WRITE_FILE: (.+?) =====\n(.*?)===== END_FILE ====='
        for match in re.finditer(write_pattern, llm_output, re.DOTALL):
            file_path = match.group(1).strip()
            file_content = match.group(2).strip()

            full_path = os.path.join(workspace_path, file_path)
            # Security: ensure path stays within workspace
            if not os.path.abspath(full_path).startswith(os.path.abspath(workspace_path)):
                continue

            os.makedirs(os.path.dirname(full_path) if os.path.dirname(full_path) else workspace_path, exist_ok=True)

            # Read old content for diff
            old_content = ""
            if os.path.exists(full_path):
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    old_content = f.read()

            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(file_content)

            if old_content:
                changes_made.append(f"**Modified**: `{file_path}`")
            else:
                changes_made.append(f"**Created**: `{file_path}`")

        # Parse DELETE_FILE blocks
        delete_pattern = r'===== DELETE_FILE: (.+?) ====='
        for match in re.finditer(delete_pattern, llm_output):
            file_path = match.group(1).strip()
            full_path = os.path.join(workspace_path, file_path)
            if not os.path.abspath(full_path).startswith(os.path.abspath(workspace_path)):
                continue
            if os.path.exists(full_path):
                os.remove(full_path)
                changes_made.append(f"**Deleted**: `{file_path}`")

        if not changes_made:
            changes_made.append("No file changes were parsed from the LLM output. The AI may not have produced changes in the expected format.")

        code_changes_summary = "## Code Changes Made\n\n" + "\n".join(f"- {c}" for c in changes_made)

        return {
            "executor_output": llm_output,
            "current_attempt": state.get("current_attempt", 0) + 1,
            "artifacts": [{"file": c, "diff": "modified"} for c in changes_made],
            "code_changes_summary": code_changes_summary,
            "pause_reason": None,  # clear plan_review; next gate is code review
        }

    except Exception as e:
        logger.error(f"Executor LLM failed: {e}")
        return {
            "executor_output": f"Executor failed: {str(e)}",
            "current_attempt": state.get("current_attempt", 0) + 1,
            "artifacts": [],
            "code_changes_summary": f"Execution failed: {str(e)}",
        }


def _validation_fail(
    state: GraphState,
    *,
    feedback: str,
    confidence: float,
) -> Dict[str, Any]:
    """FAIL payload; tags retry loops to skip plan-review HITL (replaces Decision node)."""
    config = state.get("_current_node_config", {})
    max_retries = int(config.get("maxRetries", 3))
    result: Dict[str, Any] = {
        "validation_status": "FAIL",
        "confidence_score": confidence,
        "feedback": feedback,
    }
    if state.get("current_attempt", 0) < max_retries:
        result["skip_plan_review"] = True
        result["plan_feedback"] = (
            feedback or "Validation failed — revise the plan and implementation."
        )
    return result


async def validator_node(state: GraphState) -> Dict[str, Any]:
    """
    Validator: Checks that modified files are syntactically valid.
    Runs basic syntax checks on Python and JavaScript files.
    Also owns retry tagging (skip_plan_review) formerly done by Decision.
    """
    workspace_id = state.get("workspace_id")
    changes = state.get("code_changes_summary") or ""
    executor_output = state.get("executor_output") or ""

    # If the executor itself failed / wrote nothing, do not greenlight the run.
    failure_markers = (
        "Execution failed:",
        "Executor failed:",
        "No workspace uploaded",
        "Workspace directory missing",
        "No file changes were parsed",
    )
    if any(marker in changes or marker in executor_output for marker in failure_markers):
        return _validation_fail(
            state,
            feedback=f"Executor did not produce usable code changes.\n\n{changes or executor_output}",
            confidence=0.2,
        )

    if not workspace_id:
        return _validation_fail(
            state,
            feedback="No workspace uploaded — cannot validate code changes.",
            confidence=0.4,
        )

    workspace_path = os.path.join(WORKSPACES_DIR, workspace_id)
    if not os.path.isdir(workspace_path):
        return _validation_fail(
            state,
            feedback="Workspace directory not found.",
            confidence=0.5,
        )

    errors = []

    for root, dirs, files in os.walk(workspace_path):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'venv']]
        for fname in files:
            fpath = os.path.join(root, fname)
            rel_path = os.path.relpath(fpath, workspace_path)

            # Python syntax check
            if fname.endswith('.py'):
                try:
                    proc = await asyncio.create_subprocess_exec(
                        'python3', '-m', 'py_compile', fpath,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    _, stderr = await proc.communicate()
                    if proc.returncode != 0:
                        errors.append(f"Python syntax error in `{rel_path}`: {stderr.decode()[:200]}")
                except Exception as e:
                    errors.append(f"Could not check `{rel_path}`: {str(e)[:100]}")

            # JavaScript/TypeScript basic check (just verify it's valid UTF-8 with no null bytes)
            elif fname.endswith(('.js', '.ts', '.jsx', '.tsx')):
                try:
                    with open(fpath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    if '\x00' in content:
                        errors.append(f"Binary data detected in `{rel_path}`")
                except UnicodeDecodeError:
                    errors.append(f"Invalid encoding in `{rel_path}`")

    if errors:
        feedback = "## Validation Errors\n\n" + "\n".join(f"- {e}" for e in errors)
        return _validation_fail(state, feedback=feedback, confidence=0.3)

    # Check attempt limits
    if state.get("current_attempt", 0) >= state.get("max_attempts", 3):
        return {
            "validation_status": "PASS",
            "confidence_score": 0.7,
            "feedback": "Max attempts reached. Passing with lower confidence.",
        }

    return {
        "validation_status": "PASS",
        "confidence_score": 0.9,
        "feedback": "All syntax checks passed. Code looks valid.",
    }


async def human_approval_node(state: GraphState) -> Dict[str, Any]:
    """
    Human approval checkpoint for code review.
    LangGraph will interrupt before this node.
    When resumed, we check whether the human approved the code changes.
    """
    approved = state.get("human_approved", True)

    logger.info("⚡ [START] Human Approval Node processing...", extra={"node": "human_gate", "human_approved": approved})

    # Simulated 10-second gate check delay
    logger.info(f"⏳ Human Gate processing approval status... (waiting {STEP_DELAY_SECONDS} seconds)", extra={"status": "IN_PROGRESS"})
    await asyncio.sleep(STEP_DELAY_SECONDS)

    if not approved:
        return {
            "validation_status": "FAIL",
            "feedback": "Human rejected the code changes.",
            "pause_reason": None,
        }
    return {
        "validation_status": "PASS",
        "pause_reason": None,
    }
