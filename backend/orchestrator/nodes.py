from orchestrator.state import GraphState
from typing import Dict, Any
import asyncio
import os
from agents.llm import get_llm
from langchain_core.messages import SystemMessage, HumanMessage
import logging

logger = logging.getLogger(__name__)

WORKSPACES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspaces"))


async def planner_node(state: GraphState) -> Dict[str, Any]:
    """
    AI Planner: Generates a spec-driven implementation plan using:
    - The user's objective
    - Success criteria
    - Code summary from the code understanding node
    - Any human feedback from a previous iteration
    """
    config = state.get("_current_node_config", {})
    objective = state.get("objective", "Unknown objective")
    criteria = state.get("success_criteria", [])
    code_summary = state.get("code_summary", "No codebase context available.")
    plan_feedback = state.get("plan_feedback", None)
    previous_plan = state.get("plan", None)
    model_name = config.get("model", "gemini-1.5-pro")

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

    try:
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=prompt)
        ])
        plan = response.content
    except Exception as e:
        logger.error(f"Planner LLM failed: {e}")
        plan = (
            f"## Mock Plan for: {objective}\n"
            f"1. Analyze the codebase\n"
            f"2. Implement changes based on criteria\n"
            f"3. Verify against success criteria\n"
            f"\n*(Note: LLM call failed - {str(e)[:50]})*"
        )

    return {
        "plan": plan,
        "plan_approved": False,  # Reset approval — human must review
        "plan_feedback": None,   # Clear previous feedback (consumed above)
        "plan_revision": state.get("plan_revision", 0) + 1,  # bounded loop counter
        "pause_reason": "plan_review",
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
    model_name = config.get("model", "gemini-1.5-pro")

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
        llm_output = response.content

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

            os.makedirs(os.path.dirname(full_path), exist_ok=True)

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


async def validator_node(state: GraphState) -> Dict[str, Any]:
    """
    Validator: Checks that modified files are syntactically valid.
    Runs basic syntax checks on Python and JavaScript files.
    """
    workspace_id = state.get("workspace_id")

    if not workspace_id:
        # No workspace — use attempt-based mock logic
        if state.get("current_attempt", 0) >= state.get("max_attempts", 3):
            return {"validation_status": "FAIL", "confidence_score": 0.9, "feedback": "Max attempts reached."}
        return {"validation_status": "PASS", "confidence_score": 0.85, "feedback": "No workspace to validate against."}

    workspace_path = os.path.join(WORKSPACES_DIR, workspace_id)
    if not os.path.isdir(workspace_path):
        return {"validation_status": "FAIL", "confidence_score": 0.5, "feedback": "Workspace directory not found."}

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
        return {
            "validation_status": "FAIL",
            "confidence_score": 0.3,
            "feedback": feedback,
        }

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
