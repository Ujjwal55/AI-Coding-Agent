from orchestrator.state import GraphState
from typing import Dict, Any
import asyncio
import os

async def planner_node(state: GraphState) -> Dict[str, Any]:
    # Use LLM to generate plan based on objective and criteria
    plan = f"Plan for: {state['objective']}\nSteps:\n1. Analyze repo\n2. Modify logic\n3. Verify against criteria."
    return {"plan": plan}

async def executor_node(state: GraphState) -> Dict[str, Any]:
    config = state.get("_current_node_config", {})
    command = config.get("command", "echo 'No execution command specified in node inspector'")
    
    # Ensure it runs inside our sandbox
    repo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../target_repo"))
    
    try:
        process = await asyncio.create_subprocess_shell(
            command,
            cwd=repo_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        exit_code = process.returncode
        
        output = stdout.decode('utf-8')
        err_output = stderr.decode('utf-8')
        
        full_output = f"Command: {command}\nExit Code: {exit_code}\nSTDOUT:\n{output}\nSTDERR:\n{err_output}"
        
        return {
            "executor_output": full_output,
            "current_attempt": state.get("current_attempt", 0) + 1,
            "artifacts": [{"file": "terminal", "diff": "Command executed"}]
        }
    except Exception as e:
        return {
            "executor_output": f"Execution failed to start: {str(e)}",
            "current_attempt": state.get("current_attempt", 0) + 1,
            "artifacts": []
        }

async def validator_node(state: GraphState) -> Dict[str, Any]:
    # Mock Validator: uses LLM as a judge and runs deterministic checks
    # For simulation, we randomly pass or fail, or check attempt limits
    if state.get("current_attempt", 0) >= state.get("max_attempts", 3):
        return {"validation_status": "FAIL", "confidence_score": 0.9, "feedback": "Max attempts reached."}
    
    # Dummy condition for success
    if state.get("current_attempt", 0) > 1:
        return {"validation_status": "PASS", "confidence_score": 0.85, "feedback": "All tests passed."}
    else:
        return {"validation_status": "FAIL", "confidence_score": 0.6, "feedback": "Linter failed on main.py"}

async def human_approval_node(state: GraphState) -> Dict[str, Any]:
    # This node is a pause point. LangGraph will interrupt before this node if configured.
    # When resumed, we capture the human's decision.
    approved = state.get("human_approved", True)
    if not approved:
        return {"validation_status": "FAIL", "feedback": "Human rejected the changes."}
    return {"validation_status": "PASS"}
