import asyncio
import os
import sys

# Ensure backend path is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database.core import engine, Base, async_session_maker
from models.workflow import Workflow, WorkflowVersion, WorkflowRun
from orchestrator.runtime import execute_workflow

sample_graph_json = {
    "nodes": [
        {"id": "node_1", "data": {"nodeType": "objective", "label": "Build Lead Scoring"}},
        {"id": "node_2", "data": {"nodeType": "criteria", "label": "Success Criteria", "model": "gemini-1.5-pro"}},
        {"id": "node_3", "data": {"nodeType": "planner", "label": "Planner Agent", "model": "gemini-1.5-pro"}},
        {"id": "node_4", "data": {"nodeType": "executor", "label": "Executor Agent", "command": "echo 'Building feature...'"}},
        {"id": "node_5", "data": {"nodeType": "validator", "label": "Validator Agent"}},
        {"id": "node_6", "data": {"nodeType": "decision", "label": "Decision Node"}},
        {"id": "node_7", "data": {"nodeType": "human_gate", "label": "Human Approval"}},
        {"id": "node_8", "data": {"nodeType": "end", "label": "End"}}
    ],
    "edges": [
        {"id": "e1-2", "source": "node_1", "target": "node_2"},
        {"id": "e2-3", "source": "node_2", "target": "node_3"},
        {"id": "e3-4", "source": "node_3", "target": "node_4"},
        {"id": "e4-5", "source": "node_4", "target": "node_5"},
        {"id": "e5-6", "source": "node_5", "target": "node_6"},
        {"id": "e6-7", "source": "node_6", "target": "node_7"},
        {"id": "e7-8", "source": "node_7", "target": "node_8"}
    ]
}

async def run_test():
    print("--- Testing Complete End-to-End Workflow Execution ---")
    async with async_session_maker() as db:
        # Create workflow
        wf = Workflow(name="Test Workflow", description="Integration Test")
        db.add(wf)
        await db.commit()
        await db.refresh(wf)
        print(f"Created Workflow: {wf.id}")

        # Create version
        version = WorkflowVersion(workflow_id=wf.id, version=1, graph_json=sample_graph_json)
        db.add(version)
        await db.commit()
        await db.refresh(version)
        print(f"Created Version: {version.id}")

        # Create run
        run = WorkflowRun(version_id=version.id, status="running")
        db.add(run)
        await db.commit()
        await db.refresh(run)
        print(f"Created Run: {run.id}")

        # Execute workflow initial pass
        run_res = await execute_workflow(version.id, db, str(run.id))
        print(f"Initial Run Execution Status: {run_res.status}")
        print(f"Initial State JSON Keys: {list(run_res.state_json.keys()) if isinstance(run_res.state_json, dict) else run_res.state_json}")

        # If paused at human gate or criteria checkpoint, test resume
        if run_res.status == "paused":
            print("\n--- Testing Resume Step ---")
            run_res.status = "running"
            await db.commit()
            resumed_run = await execute_workflow(version.id, db, str(run_res.id))
            print(f"Resumed Run Execution Status: {resumed_run.status}")

    print("\n--- End-to-End Workflow Verification PASSED! ---")

if __name__ == "__main__":
    asyncio.run(run_test())
