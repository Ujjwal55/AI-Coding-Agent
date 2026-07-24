import os
import glob
from typing import Dict, Any, List

from langchain_core.messages import SystemMessage, HumanMessage
from agents.llm import get_llm
from orchestrator.state import GraphState

async def code_understanding_node(state: GraphState) -> Dict[str, Any]:
    workspace_id = state.get("workspace_id")
    if not workspace_id:
        return {'code_summary': 'No workspace uploaded. Working without codebase context.'}
    
    base_dir = os.path.join(os.path.dirname(__file__), '..', 'workspaces')
    workspace_path = os.path.join(base_dir, workspace_id)
    
    if not os.path.exists(workspace_path):
        return {'code_summary': 'No workspace uploaded. Working without codebase context.'}
    
    # Walk the workspace directory recursively to build a file tree string
    tree_lines = []
    file_paths = []
    
    for root, dirs, files in os.walk(workspace_path):
        # Exclude hidden directories or common ignores if we wanted to, but simple walk is fine
        if '.git' in dirs:
            dirs.remove('.git')
        if '__pycache__' in dirs:
            dirs.remove('__pycache__')
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
            
        level = root.replace(workspace_path, '').count(os.sep)
        indent = ' ' * 4 * level
        dir_name = os.path.basename(root)
        if dir_name:
            tree_lines.append(f"{indent}{dir_name}/")
        
        subindent = ' ' * 4 * (level + 1 if dir_name else level)
        for f in files:
            if not f.startswith('.'):
                tree_lines.append(f"{subindent}{f}")
                file_paths.append(os.path.join(root, f))
            
    tree_string = "\n".join(tree_lines)
    
    # Identify important files to read
    priority_patterns = [
        ["README.md", "README.rst", "README.txt"],
        ["package.json", "requirements.txt", "setup.py", "pyproject.toml", "Cargo.toml", "go.mod", "pom.xml"],
        ["main.py", "app.py", "index.js", "index.ts", "src/index.*", "src/main.*", "src/app.*"],
        [".env.example", "docker-compose.yml", "Dockerfile", "tsconfig.json"]
    ]
    
    prioritized_files: List[str] = []
    for group in priority_patterns:
        for p in group:
            if '*' in p:
                glob_path = os.path.join(workspace_path, p)
                matches = glob.glob(glob_path)
                for m in matches:
                    if os.path.isfile(m) and m not in prioritized_files:
                        prioritized_files.append(m)
            else:
                exact_path = os.path.join(workspace_path, p)
                if os.path.exists(exact_path) and os.path.isfile(exact_path) and exact_path not in prioritized_files:
                    prioritized_files.append(exact_path)
    
    file_contents = []
    read_count = 0
    
    for file_path in prioritized_files:
        if read_count >= 15:
            break
        try:
            # Skip files larger than 50KB
            if os.path.getsize(file_path) > 50 * 1024:
                continue
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                rel_path = os.path.relpath(file_path, workspace_path)
                file_contents.append(f"--- {rel_path} ---\n{content}\n")
                read_count += 1
        except Exception:
            continue
            
    files_str = "\n".join(file_contents)
    
    system_prompt = """You are a senior software architect. Analyze this codebase and provide a comprehensive summary including:
1. Tech stack and frameworks used
2. Project structure and architecture pattern
3. Key modules and their responsibilities
4. Entry points and main flows
5. Dependencies and external services
6. Database schema (if applicable)
Keep your analysis concise but thorough. This summary will be used by another AI agent to plan code changes."""

    human_prompt = f"Here is the directory tree:\n{tree_string}\n\nHere are the contents of important files:\n{files_str}"
    
    try:
        config = state.get("_current_node_config", {})
        model_name = config.get("model", "gemini-1.5-pro")
        llm = get_llm(model_name)
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_prompt)
        ]
        response = await llm.ainvoke(messages)
        return {'code_summary': response.content}
    except Exception as e:
        basic_summary = f"Codebase structure:\n{tree_string}\n\nImportant files found:\n{[os.path.relpath(p, workspace_path) for p in prioritized_files[:15]]}"
        return {'code_summary': f"LLM analysis failed. Basic structure:\n{basic_summary}"}

