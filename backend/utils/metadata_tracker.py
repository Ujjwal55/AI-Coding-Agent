import time
from typing import Dict, Any, List

# Global metadata store for node execution metrics.
# Format: { node_type: NodeMetadataDict }
NODE_METADATA: Dict[str, Dict[str, Any]] = {}


def _empty_meta() -> Dict[str, Any]:
    return {
        "execution_time_sec": 0.0,
        "model_name": "",
        "input_tokens": 0,
        "output_tokens": 0,
        "cached_tokens": 0,
        "estimated_cost": 0.0,
        "files_touched": [],
    }


def clear_metadata():
    """Reset all node telemetry (call at the start of a fresh run)."""
    global NODE_METADATA
    NODE_METADATA = {}


def start_node(node_type: str):
    global NODE_METADATA
    if node_type not in NODE_METADATA:
        NODE_METADATA[node_type] = _empty_meta()
    NODE_METADATA[node_type]["_start_time"] = time.time()


def record_llm_metrics(node_type: str, metrics: Dict[str, Any]):
    """
    Record metrics produced by agents.llm.extract_llm_metrics into NODE_METADATA.
    Safe to call even when start_node was not invoked (e.g. folded sub-agents).
    """
    global NODE_METADATA
    if node_type not in NODE_METADATA:
        NODE_METADATA[node_type] = _empty_meta()

    meta = NODE_METADATA[node_type]
    model = metrics.get("model") or ""
    if model:
        meta["model_name"] = model
    meta["input_tokens"] += int(metrics.get("prompt_tokens") or 0)
    meta["output_tokens"] += int(metrics.get("completion_tokens") or 0)
    meta["cached_tokens"] += int(metrics.get("cached_tokens") or 0)
    meta["estimated_cost"] += float(metrics.get("estimated_cost_usd") or 0.0)


def add_llm_usage(
    node_type: str,
    model_name: str,
    input_tokens: int,
    output_tokens: int,
    cached_tokens: int = 0,
    estimated_cost_usd: float = 0.0,
):
    """Legacy helper — prefer record_llm_metrics with extract_llm_metrics output."""
    record_llm_metrics(
        node_type,
        {
            "model": model_name,
            "prompt_tokens": input_tokens,
            "completion_tokens": output_tokens,
            "cached_tokens": cached_tokens,
            "estimated_cost_usd": estimated_cost_usd,
        },
    )


def add_files_touched(node_type: str, files: List[str]):
    global NODE_METADATA
    if node_type not in NODE_METADATA:
        NODE_METADATA[node_type] = _empty_meta()
    for f in files:
        if f not in NODE_METADATA[node_type]["files_touched"]:
            NODE_METADATA[node_type]["files_touched"].append(f)


def end_node(node_type: str):
    global NODE_METADATA
    if node_type in NODE_METADATA:
        meta = NODE_METADATA[node_type]
        if "_start_time" in meta:
            meta["execution_time_sec"] += round(time.time() - meta["_start_time"], 2)
            del meta["_start_time"]


def get_metadata() -> Dict[str, Dict[str, Any]]:
    global NODE_METADATA
    # Filter out _start_time for clean API response
    result = {}
    for node, meta in NODE_METADATA.items():
        result[node] = {k: v for k, v in meta.items() if not k.startswith("_")}
    return result
