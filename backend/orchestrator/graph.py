import asyncio
from langgraph.graph import StateGraph, END
from orchestrator.state import GraphState
from orchestrator.nodes import planner_node, executor_node, validator_node, human_approval_node
from agents.success_criteria import criteria_node
from agents.code_understanding import code_understanding_node
from agents.decision import (
    should_human_approve,
    should_replan,
    should_finish_after_review,
    decision_node,
    plan_review_node,
)
from utils.logger import get_logger
from utils.broadcaster import broadcast_event

logger = get_logger(__name__)

NODE_MAP = {
    'criteria': criteria_node,
    'code_understanding': code_understanding_node,
    'planner': planner_node,
    'plan_review': plan_review_node,
    'executor': executor_node,
    'validator': validator_node,
    'decision': decision_node,
    'human_gate': human_approval_node,
}

def create_node_wrapper(base_func, node_id: str, node_data: dict):
    """Wraps the original node function to inject UI configuration and broadcast node status events."""
    async def wrapper(state: GraphState):
        state["_current_node_config"] = node_data
        node_type = node_data.get("nodeType", "node")
        label = node_data.get("label", node_type.capitalize())
        
        # 1. Broadcast IN_PROGRESS
        broadcast_event({
            "type": "node_status",
            "node_id": node_id,
            "node_type": node_type,
            "label": label,
            "status": "in_progress"
        })
        
        try:
            result = await base_func(state)
            
            val_status = result.get("validation_status") if isinstance(result, dict) else None
            final_status = "failed" if val_status == "FAIL" else "completed"
            
            # 2. Broadcast COMPLETED / FAILED
            broadcast_event({
                "type": "node_status",
                "node_id": node_id,
                "node_type": node_type,
                "label": label,
                "status": final_status,
                "output": result
            })
            return result
        except Exception as e:
            broadcast_event({
                "type": "node_status",
                "node_id": node_id,
                "node_type": node_type,
                "label": label,
                "status": "failed",
                "error": str(e)
            })
            raise e

    return wrapper

def build_dynamic_graph(graph_json: dict):
    """Compiles a LangGraph StateGraph dynamically from React Flow JSON."""
    nodes = graph_json.get("nodes", [])
    edges = graph_json.get("edges", [])
    logger.info("Building dynamic LangGraph from graph JSON", extra={"node_count": len(nodes), "edge_count": len(edges)})
    
    workflow = StateGraph(GraphState)
    valid_node_ids = set()
    
    # 1. Add nodes
    for node in nodes:
        node_id = node["id"]
        node_type = node.get("data", {}).get("nodeType", "planner")
        
        if node_type == "objective":
            async def dummy_objective(state: GraphState, nid=node_id, ndata=node.get("data", {})):
                label = ndata.get("label", "Objective")
                logger.info(f"⚡ [START] Objective Node processing... ({nid})", extra={"node_id": nid, "label": label})
                broadcast_event({"type": "node_status", "node_id": nid, "node_type": "objective", "label": label, "status": "in_progress"})
                await asyncio.sleep(2)
                logger.info(f"✅ [FINISH] Objective Node completed", extra={"node_id": nid, "label": label})
                broadcast_event({"type": "node_status", "node_id": nid, "node_type": "objective", "label": label, "status": "completed"})
                return {}
            workflow.add_node(node_id, dummy_objective)
            valid_node_ids.add(node_id)
        elif node_type == "end":
            pass # END is a special LangGraph constant
        elif node_type in NODE_MAP and NODE_MAP[node_type] is not None:
            wrapped = create_node_wrapper(NODE_MAP[node_type], node_id, node.get("data", {}))
            workflow.add_node(node_id, wrapped)
            valid_node_ids.add(node_id)
            
    # Helper to find node by nodeType
    def find_node_by_type(n_type):
        return next((n["id"] for n in nodes if n.get("data", {}).get("nodeType") == n_type), None)

    planner_id = find_node_by_type("planner")
    executor_id = find_node_by_type("executor")
    human_gate_id = find_node_by_type("human_gate")

    # Node types whose outgoing edges are replaced by deterministic conditional
    # routers. We only need one edge per such node to trigger wiring, so we
    # remember which we've already processed.
    processed_conditional_nodes = set()

    # 2. Add edges
    for edge in edges:
        source = edge["source"]
        target = edge["target"]

        # Map UI "end" node to LangGraph END
        target_node = next((n for n in nodes if n["id"] == target), None)
        if target_node and target_node.get("data", {}).get("nodeType") == "end":
            target = END

        source_node = next((n for n in nodes if n["id"] == source), None)
        if not source_node:
            continue

        source_type = source_node.get("data", {}).get("nodeType")

        if source_type == "decision":
            if source in processed_conditional_nodes:
                continue
            processed_conditional_nodes.add(source)
            # Validation outcome -> retry / code review / safe stop
            workflow.add_conditional_edges(
                source,
                should_human_approve,
                {
                    "planner": planner_id or target,
                    "human_approval": human_gate_id or target,
                    "end": END,
                },
            )
        elif source_type == "plan_review":
            if source in processed_conditional_nodes:
                continue
            processed_conditional_nodes.add(source)
            # Plan approved -> execute; feedback -> regenerate plan (bounded)
            workflow.add_conditional_edges(
                source,
                should_replan,
                {
                    "planner": planner_id or target,
                    "executor": executor_id or target,
                },
            )
        elif source_type == "human_gate":
            if source in processed_conditional_nodes:
                continue
            processed_conditional_nodes.add(source)
            # Code approved -> finish; changes requested -> loop back to planner
            workflow.add_conditional_edges(
                source,
                should_finish_after_review,
                {
                    "planner": planner_id or target,
                    "end": END,
                },
            )
        else:
            workflow.add_edge(source, target)

    # 3. Entry point
    targets = {e["target"] for e in edges}
    entry_nodes = [n["id"] for n in nodes if n["id"] not in targets and n["id"] in valid_node_ids]
    if entry_nodes:
        workflow.set_entry_point(entry_nodes[0])
    elif valid_node_ids:
        workflow.set_entry_point(list(valid_node_ids)[0])

    # Interrupt before the two human gates so the graph pauses for review:
    #   - plan_review: after the planner has produced a plan, before executing
    #   - human_gate:  after code changes, for code review
    interrupt_types = ["plan_review", "human_gate"]
    interrupts = [n["id"] for n in nodes if n.get("data", {}).get("nodeType") in interrupt_types]
    return workflow.compile(interrupt_before=interrupts if interrupts else None)
