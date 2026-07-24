"use client";
import React, { useState, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CustomNode from '@/components/CustomNode';

const nodeTypes = {
  custom: CustomNode,
};

const initialNodes: Node[] = [
  { id: 'objective', position: { x: 250, y: 50 }, data: { label: 'Feature Request', nodeType: 'objective' }, type: 'custom' },
  { id: 'criteria', position: { x: 250, y: 150 }, data: { label: 'Define Criteria', nodeType: 'criteria' }, type: 'custom' },
  { id: 'planner', position: { x: 250, y: 250 }, data: { label: 'Create Plan', nodeType: 'planner' }, type: 'custom' },
  { id: 'executor', position: { x: 250, y: 350 }, data: { label: 'Write Code', nodeType: 'executor' }, type: 'custom' },
  { id: 'validator', position: { x: 250, y: 450 }, data: { label: 'Run Tests', nodeType: 'validator' }, type: 'custom' },
  { id: 'decision', position: { x: 250, y: 550 }, data: { label: 'Evaluate', nodeType: 'decision' }, type: 'custom' },
  { id: 'human_approval', position: { x: 250, y: 650 }, data: { label: 'Review PR', nodeType: 'human_gate' }, type: 'custom' },
  { id: 'end', position: { x: 250, y: 750 }, data: { label: 'Merged', nodeType: 'end' }, type: 'custom' },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'objective', target: 'criteria' },
  { id: 'e2-3', source: 'criteria', target: 'planner' },
  { id: 'e3-4', source: 'planner', target: 'executor' },
  { id: 'e4-5', source: 'executor', target: 'validator' },
  { id: 'e5-6', source: 'validator', target: 'decision' },
  { id: 'e6-7', source: 'decision', target: 'human_approval' },
  { id: 'e6-3', source: 'decision', target: 'planner', type: 'smoothstep' },
  { id: 'e7-8', source: 'human_approval', target: 'end' },
];

export default function WorkflowBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType, label }));
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const typeData = event.dataTransfer.getData('application/reactflow');
      if (!typeData || !reactFlowInstance) return;

      const { nodeType, label } = JSON.parse(typeData);
      
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      const newId = `${nodeType}-${new Date().getTime()}`;

      const newNode = {
        id: newId,
        type: 'custom',
        position,
        data: { label, nodeType },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const selectedNode = nodes.find(n => n.selected);
  
  // Pause/Resume state
  const [pausedRunId, setPausedRunId] = useState<string | null>(null);
  const [editingCriteria, setEditingCriteria] = useState<string>('');

  const updateNodeData = (id: string, key: string, value: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n
      )
    );
  };

  const handleRunWorkflow = async () => {
    try {
      setIsConsoleOpen(true); 

      // 1. Create a Workflow record
      const wfRes = await fetch("http://localhost:8000/api/workflows/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "UI Generated Workflow", description: "Created from canvas" })
      });
      const wf = await wfRes.json();

      // 2. Save the React Flow JSON as a Version
      const vRes = await fetch(`http://localhost:8000/api/workflows/${wf.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph_json: { nodes, edges } })
      });
      const version = await vRes.json();

      // 3. Execute the Graph dynamically!
      const runRes = await fetch(`http://localhost:8000/api/workflows/${version.id}/run`, {
        method: "POST"
      });
      const runData = await runRes.json();
      
      console.log("LangGraph Execution Result:", runData);
      
      if (runData.status === "paused") {
         setPausedRunId(runData.id);
         const criteriaList = runData.state_json?.success_criteria || [];
         setEditingCriteria(criteriaList.join("\n"));
      } else {
         alert(`Backend LangGraph execution finished! Status: ${runData.status}\n\nFinal State logged to browser console.`);
      }
    } catch (error) {
      console.error("Run error:", error);
      alert("Failed to run. Is the FastAPI backend running on port 8000?");
    }
  };

  const handleResume = async () => {
     if (!pausedRunId) return;
     try {
       const res = await fetch(`http://localhost:8000/api/workflows/${pausedRunId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
             state_updates: {
                success_criteria: editingCriteria.split("\n").filter(c => c.trim())
             }
          })
       });
       const runData = await res.json();
       setPausedRunId(null);
       
       console.log("Resumed LangGraph Result:", runData);
       if (runData.status === "paused") {
          // If it paused again (e.g. at human gate)
          alert("Workflow paused again (Human Gate). Check console for state.");
       } else {
          alert(`Workflow resumed and finished! Status: ${runData.status}`);
       }
     } catch (e) {
       console.error(e);
     }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 relative">
      {/* Pause Modal */}
      {pausedRunId && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[500px]">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Hybrid Mode: Edit Success Criteria</h2>
            <p className="text-sm text-slate-600 mb-4">The Success Criteria Agent has generated the following rules. Edit them before the Planner begins.</p>
            
            <textarea
              value={editingCriteria}
              onChange={(e) => setEditingCriteria(e.target.value)}
              className="w-full h-40 p-3 border border-slate-300 rounded font-mono text-sm mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="1. Must pass tests..."
            />
            
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setPausedRunId(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded font-medium text-sm"
              >
                Cancel Run
              </button>
              <button 
                onClick={handleResume}
                className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 font-medium text-sm"
              >
                Approve & Continue Planning
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-64 bg-white border-r border-slate-200 p-4 shadow-sm flex flex-col z-20">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Node Library</h2>
        <div className="space-y-2">
          {['Objective', 'Criteria', 'Planner', 'Executor', 'Validator', 'Decision', 'Human Gate'].map((nodeName) => (
             <div 
               key={nodeName} 
               draggable
               onDragStart={(e) => onDragStart(e, nodeName.toLowerCase().replace(' ', '_'), nodeName)}
               className="p-3 bg-slate-100 rounded border border-slate-200 cursor-grab active:cursor-grabbing text-sm text-slate-700 font-medium hover:bg-slate-200 transition-colors"
             >
               {nodeName}
             </div>
          ))}
        </div>
      </div>
      
      <div className="flex-1 flex">
        <div className="flex-1 relative">
          <div className="absolute top-4 right-4 z-40 flex gap-2">
             <button 
               onClick={handleRunWorkflow}
               className="px-4 py-2 bg-blue-600 text-white rounded shadow-sm hover:bg-blue-700 font-medium text-sm"
             >
               Compile & Run Graph
             </button>
             {isConsoleOpen && (
               <button 
                 onClick={() => setIsConsoleOpen(false)}
                 className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded shadow-sm hover:bg-slate-50 font-medium text-sm"
               >
                 Close Console
               </button>
             )}
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            fitView
            className="w-full h-full"
          >
            <Controls />
            <MiniMap />
            <Background gap={12} size={1} />
          </ReactFlow>
        </div>

        {/* Execution Console / Timeline */}
        {isConsoleOpen && (
          <div className="w-96 bg-white border-l border-slate-200 shadow-xl flex flex-col z-20">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Run Console</h3>
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-bold">RUNNING</span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              <div className="text-sm">
                <p className="text-slate-500 font-medium mb-1">10:00:01 AM - Objective</p>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-700">
                  Parsed feature requirement: Lead Scoring & Routing
                </div>
              </div>
              <div className="text-sm">
                <p className="text-slate-500 font-medium mb-1">10:00:03 AM - Planner</p>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-700">
                  <p className="font-bold mb-2">Generated Plan:</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Create backend models</li>
                    <li>Add API routes</li>
                    <li>Implement Next.js views</li>
                  </ol>
                </div>
              </div>
              <div className="text-sm animate-pulse">
                <p className="text-blue-500 font-bold mb-1">10:00:05 AM - Executor (Running...)</p>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-slate-700">
                  <pre className="text-xs">
{`$ claude-code run --plan="plan.md"
> Reading twenty/backend/models...
> Writing field definition for Person...
> Running tests...`}
                  </pre>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
               <button className="flex-1 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded font-medium text-sm hover:bg-red-100">Cancel Run</button>
            </div>
          </div>
        )}

        {/* Node Inspector Panel */}
        {!isConsoleOpen && selectedNode && (
          <div className="w-80 bg-white border-l border-slate-200 shadow-xl flex flex-col z-20">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800">Node Inspector</h3>
              <p className="text-xs text-slate-500">{selectedNode.id} ({selectedNode.type})</p>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Node Label</label>
                <input 
                  type="text" 
                  value={selectedNode.data.label as string || ''}
                  onChange={(e) => updateNodeData(selectedNode.id, 'label', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {['planner', 'executor', 'validator'].includes(selectedNode.data.nodeType as string) && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Model</label>
                    <select 
                      value={(selectedNode.data.model as string) || 'gpt-4o'}
                      onChange={(e) => updateNodeData(selectedNode.id, 'model', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                      <option value="o1-mini">o1-mini</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">System Prompt / Instructions</label>
                    <textarea 
                      rows={5}
                      value={(selectedNode.data.instructions as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, 'instructions', e.target.value)}
                      placeholder="You are an expert engineer..."
                      className="w-full p-2 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Max Retries</label>
                    <input 
                      type="number" 
                      min="0"
                      max="10"
                      value={(selectedNode.data.maxRetries as string) || '3'}
                      onChange={(e) => updateNodeData(selectedNode.id, 'maxRetries', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {selectedNode.data.nodeType === 'executor' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Execution Command</label>
                  <input 
                    type="text" 
                    value={(selectedNode.data.command as string) || 'claude-code run'}
                    onChange={(e) => updateNodeData(selectedNode.id, 'command', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
