from orchestrator.state import GraphState
from typing import Dict, Any
import asyncio
import os
from agents.llm import get_llm
from langchain_core.messages import SystemMessage, HumanMessage

async def planner_node(state: GraphState) -> Dict[str, Any]:
    config = state.get("_current_node_config", {})
    objective = state.get("objective", "Unknown objective")
    criteria = state.get("success_criteria", [])
    model_name = config.get("model", "gemini-1.5-pro")
    instructions = config.get("instructions", "Generate a step-by-step implementation plan.")
    
    llm = get_llm(model_name)
    prompt = f"Objective: {objective}\nCriteria: {', '.join(criteria)}"
    
    try:
        response = await llm.ainvoke([
            SystemMessage(content=instructions),
            HumanMessage(content=prompt)
        ])
        plan = response.content
    except Exception as e:
        # Fallback if API fails
        plan = f"Mock Plan for: {objective}\n1. Analyze repo\n2. Modify logic\n3. Verify against criteria.\n(Note: LLM failed - {str(e)[:30]})"
        
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
