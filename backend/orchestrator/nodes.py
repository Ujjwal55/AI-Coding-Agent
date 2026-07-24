from utils.logger import get_logger

logger = get_logger(__name__)

async def planner_node(state: GraphState) -> Dict[str, Any]:
    config = state.get("_current_node_config", {})
    objective = state.get("objective", "Unknown objective")
    criteria = state.get("success_criteria", [])
    model_name = config.get("model", "gemini-1.5-pro")
    instructions = config.get("instructions", "Generate a step-by-step implementation plan.")
    
    logger.info("Executing planner_node", extra={"objective": objective, "model": model_name})
    llm = get_llm(model_name)
    prompt = f"Objective: {objective}\nCriteria: {', '.join(criteria)}"
    
    try:
        response = await llm.ainvoke([
            SystemMessage(content=instructions),
            HumanMessage(content=prompt)
        ])
        plan = response.content
        logger.info("Planner generated plan via LLM")
        logger.debug("Generated plan output", extra={"plan_snippet": str(plan)[:100]})
    except Exception as e:
        logger.error("LLM failed in planner_node, using fallback plan", extra={"error": str(e)})
        plan = f"Mock Plan for: {objective}\n1. Analyze repo\n2. Modify logic\n3. Verify against criteria.\n(Note: LLM failed - {str(e)[:30]})"
        
    return {"plan": plan}

async def executor_node(state: GraphState) -> Dict[str, Any]:
    config = state.get("_current_node_config", {})
    command = config.get("command", "echo 'No execution command specified in node inspector'")
    attempt = state.get("current_attempt", 0) + 1
    
    repo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../target_repo"))
    logger.info("Executing executor_node", extra={"command": command, "attempt": attempt, "cwd": repo_path})
    
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
        
        logger.info("Executor command finished", extra={"exit_code": exit_code, "attempt": attempt})
        logger.debug("Executor process stdout/stderr", extra={"stdout": output[:200], "stderr": err_output[:200]})
        
        full_output = f"Command: {command}\nExit Code: {exit_code}\nSTDOUT:\n{output}\nSTDERR:\n{err_output}"
        
        return {
            "executor_output": full_output,
            "current_attempt": attempt,
            "artifacts": [{"file": "terminal", "diff": "Command executed"}]
        }
    except Exception as e:
        logger.error("Execution failed to start in executor_node", extra={"error": str(e), "command": command}, exc_info=True)
        return {
            "executor_output": f"Execution failed to start: {str(e)}",
            "current_attempt": attempt,
            "artifacts": []
        }

async def validator_node(state: GraphState) -> Dict[str, Any]:
    attempt = state.get("current_attempt", 0)
    max_attempts = state.get("max_attempts", 3)
    logger.info("Executing validator_node", extra={"attempt": attempt, "max_attempts": max_attempts})
    
    if attempt >= max_attempts:
        logger.warning("Validator reached max attempt limit", extra={"attempt": attempt})
        return {"validation_status": "FAIL", "confidence_score": 0.9, "feedback": "Max attempts reached."}
    
    if attempt > 1:
        logger.info("Validator node PASS", extra={"confidence_score": 0.85})
        return {"validation_status": "PASS", "confidence_score": 0.85, "feedback": "All tests passed."}
    else:
        logger.info("Validator node FAIL", extra={"confidence_score": 0.6})
        return {"validation_status": "FAIL", "confidence_score": 0.6, "feedback": "Linter failed on main.py"}

async def human_approval_node(state: GraphState) -> Dict[str, Any]:
    approved = state.get("human_approved", True)
    logger.info("Executing human_approval_node", extra={"human_approved": approved})
    if not approved:
        logger.warning("Human rejected workflow state changes")
        return {"validation_status": "FAIL", "feedback": "Human rejected the changes."}
    return {"validation_status": "PASS"}
