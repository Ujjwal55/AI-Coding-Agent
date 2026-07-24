import os
import uuid
import zipfile
import logging
from typing import Any, Dict, List
from io import BytesIO
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import StreamingResponse, PlainTextResponse

logger = logging.getLogger(__name__)

router = APIRouter()

WORKSPACES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'workspaces'))

# Ensure workspace directory exists on module load
os.makedirs(WORKSPACES_DIR, exist_ok=True)

def _build_file_tree(dir_path: str, base_path: str) -> List[Dict[str, Any]]:
    tree = []
    for entry in os.scandir(dir_path):
        rel_path = os.path.relpath(entry.path, base_path)
        if entry.is_dir(follow_symlinks=False):
            tree.append({
                "path": rel_path,
                "is_dir": True
            })
            tree.extend(_build_file_tree(entry.path, base_path))
        else:
            tree.append({
                "path": rel_path,
                "is_dir": False,
                "size": entry.stat().st_size
            })
    return tree

def _is_safe_path(basedir: str, path: str) -> bool:
    # Resolve absolute paths and verify the requested path is within the base directory
    basedir = os.path.realpath(os.path.abspath(basedir))
    path = os.path.realpath(os.path.abspath(path))
    return path == basedir or path.startswith(basedir + os.sep)


def _safe_extract(zip_ref: zipfile.ZipFile, dest_dir: str) -> None:
    """Extract a zip while guarding against Zip Slip (path traversal).

    Rejects any member whose resolved destination escapes ``dest_dir``
    (e.g. entries like ``../../etc/passwd`` or absolute paths).
    """
    dest_root = os.path.realpath(os.path.abspath(dest_dir))
    for member in zip_ref.infolist():
        # Normalize and resolve the target path for this member
        target_path = os.path.realpath(os.path.join(dest_root, member.filename))
        if not (target_path == dest_root or target_path.startswith(dest_root + os.sep)):
            raise HTTPException(
                status_code=400,
                detail=f"Unsafe path in archive: {member.filename}",
            )
    zip_ref.extractall(dest_dir)

@router.post("/upload")
async def upload_workspace(file: UploadFile = File(...)):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only .zip files are allowed")

    workspace_id = str(uuid.uuid4())
    workspace_path = os.path.join(WORKSPACES_DIR, workspace_id)
    
    os.makedirs(workspace_path, exist_ok=True)
    
    try:
        content = await file.read()
        with zipfile.ZipFile(BytesIO(content)) as zip_ref:
            _safe_extract(zip_ref, workspace_path)

        file_tree = _build_file_tree(workspace_path, workspace_path)
        return {"workspace_id": workspace_id, "file_tree": file_tree}
    except HTTPException:
        raise
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip file")
    except Exception as e:
        logger.error(f"Error extracting zip: {e}")
        raise HTTPException(status_code=500, detail="Failed to process zip file")

@router.get("/workspaces/{workspace_id}/tree")
async def get_workspace_tree(workspace_id: str):
    workspace_path = os.path.join(WORKSPACES_DIR, workspace_id)
    if not os.path.exists(workspace_path) or not os.path.isdir(workspace_path):
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    try:
        file_tree = _build_file_tree(workspace_path, workspace_path)
        return {"file_tree": file_tree}
    except Exception as e:
        logger.error(f"Error building file tree: {e}")
        raise HTTPException(status_code=500, detail="Failed to read workspace")

@router.get("/workspaces/{workspace_id}/file")
async def get_workspace_file(workspace_id: str, path: str = Query(...)):
    workspace_path = os.path.join(WORKSPACES_DIR, workspace_id)
    if not os.path.exists(workspace_path) or not os.path.isdir(workspace_path):
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    file_path = os.path.join(workspace_path, path)
    
    if not _is_safe_path(workspace_path, file_path):
        raise HTTPException(status_code=403, detail="Path traversal detected")
        
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=400, detail="Path is not a file")
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return PlainTextResponse(content)
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File is not plain text")
    except Exception as e:
        logger.error(f"Error reading file: {e}")
        raise HTTPException(status_code=500, detail="Failed to read file")

@router.get("/workspaces/{workspace_id}/download")
async def download_workspace(workspace_id: str):
    workspace_path = os.path.join(WORKSPACES_DIR, workspace_id)
    if not os.path.exists(workspace_path) or not os.path.isdir(workspace_path):
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    try:
        memory_file = BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(workspace_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, workspace_path)
                    zf.write(file_path, rel_path)
        
        memory_file.seek(0)
        
        return StreamingResponse(
            memory_file,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=workspace_{workspace_id}.zip"}
        )
    except Exception as e:
        logger.error(f"Error zipping workspace: {e}")
        raise HTTPException(status_code=500, detail="Failed to zip workspace")
