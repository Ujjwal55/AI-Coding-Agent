import os
import json
import sys

# Ensure backend directory is in python path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from utils.logger import get_logger

# Initialize logger
logger = get_logger(__name__)

def test_logging():
    print("--- Running Logger Verification ---")
    
    # Log at different levels
    logger.debug("Debug level log message", extra={"user_id": 42})
    logger.info("Info level log message", extra={"action": "create_workflow"})
    logger.warning("Warning level log message", extra={"attempt": 2})
    logger.error("Error level log message", extra={"error_code": "ERR_500"})
    logger.critical("Critical level log message", extra={"status": "system_down"})

    # Check log file existence and format
    logs_dir = os.path.join(backend_dir, "logs")
    log_file_path = os.path.join(logs_dir, "test_logger.log")

    assert os.path.exists(log_file_path), f"Log file expected at {log_file_path}"
    print(f"Log file successfully created at: {log_file_path}")

    # Read and validate JSON log entries
    with open(log_file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    print(f"Total lines in log file: {len(lines)}")
    assert len(lines) >= 5, "Expected at least 5 log entries"

    for idx, line in enumerate(lines[-5:]):
        parsed = json.loads(line.strip())
        print(f"Entry {idx + 1} JSON valid: Level={parsed.get('level')} | Msg={parsed.get('message')}")
        assert "timestamp" in parsed
        assert "level" in parsed
        assert "message" in parsed

    print("\n--- Logger Test Verification PASSED! ---")

if __name__ == "__main__":
    test_logging()
