import time
from typing import Dict, Any, List

# Global metadata store for node execution metrics.
# Format: { node_type: NodeMetadataDict }
NODE_METADATA: Dict[str, Dict[str, Any]] = {}

def start_node(node_type: str):
    global NODE_METADATA
    if node_type not in NODE_METADATA:
        NODE_METADATA[node_type] = {
            "execution_time_sec": 0.0,
            "model_name": "",
            "input_tokens": 0,
            "output_tokens": 0,
            "cached_tokens": 0,
            "estimated_cost": 0.0,
            "files_touched": [],
        }
    NODE_METADATA[node_type]["_start_time"] = time.time()

def add_llm_usage(node_type: str, model_name: str, input_tokens: int, output_tokens: int, cached_tokens: int = 0):
    global NODE_METADATA
    if node_type not in NODE_METADATA:
        return
        
    meta = NODE_METADATA[node_type]
    meta["model_name"] = model_name
    meta["input_tokens"] += input_tokens
    meta["output_tokens"] += output_tokens
    meta["cached_tokens"] += cached_tokens
    
    # Rough cost calculation based on model
    cost = 0.0
    mn = model_name.lower()
    if "gemini-1.5-pro" in mn:
        cost = (input_tokens * 1.25 / 1000000) + (output_tokens * 5.00 / 1000000)
    elif "gemini-1.5-flash" in mn or "gemini-3.1" in mn or "gemini-2.0" in mn:
        cost = (input_tokens * 0.075 / 1000000) + (output_tokens * 0.30 / 1000000)
    elif "gpt-oss-70b" in mn or "llama" in mn:
        cost = (input_tokens * 0.50 / 1000000) + (output_tokens * 0.50 / 1000000)
    
    meta["estimated_cost"] += cost

def add_files_touched(node_type: str, files: List[str]):
    global NODE_METADATA
    if node_type not in NODE_METADATA:
        return
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
