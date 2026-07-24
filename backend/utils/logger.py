import logging
import json
import os
import sys
import inspect
from datetime import datetime, timezone
from typing import Optional, Dict, Any


class JSONFormatter(logging.Formatter):
    """Custom Formatter to format log records as JSON strings."""

    def format(self, record: logging.LogRecord) -> str:
        log_record: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "file": record.filename,
            "line": record.lineno,
        }

        # Include exception traceback if present
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)

        # Include custom extra fields
        if hasattr(record, "extra_fields") and isinstance(record.extra_fields, dict):
            log_record.update(record.extra_fields)
        elif hasattr(record, "__dict__"):
            standard_attrs = {
                "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
                "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
                "created", "msecs", "relativeCreated", "thread", "threadName",
                "processName", "process", "message", "extra_fields", "taskName"
            }
            extra_keys = {k: v for k, v in record.__dict__.items() if k not in standard_attrs and v is not None}
            if extra_keys:
                log_record["extra"] = extra_keys

        return json.dumps(log_record)


def get_logger(name: Optional[str] = None, log_dir: Optional[str] = None) -> logging.Logger:
    """
    Creates and returns a configured logger instance that logs JSON formatted messages
    to both console (stdout) and a log file named after the module under the logs folder.
    """
    # Derive module filename
    if not name or name == "__main__":
        frame = inspect.stack()[1]
        filename = os.path.basename(frame.filename)
        base_name = os.path.splitext(filename)[0]
        if not name:
            name = base_name
    else:
        base_name = name.split(".")[-1]

    logger = logging.getLogger(name)

    # Avoid adding duplicate handlers if logger is already configured
    if logger.hasHandlers():
        return logger

    # Set base logging level (from LOG_LEVEL env var or default DEBUG)
    env_level = os.getenv("LOG_LEVEL", "DEBUG").upper()
    level = getattr(logging, env_level, logging.DEBUG)
    logger.setLevel(level)

    formatter = JSONFormatter()

    # 1. Console (Stdout) Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 2. File Handler under logs directory
    if not log_dir:
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        log_dir = os.path.join(backend_dir, "logs")

    os.makedirs(log_dir, exist_ok=True)
    log_file_path = os.path.join(log_dir, f"{base_name}.log")

    file_handler = logging.FileHandler(log_file_path, mode="a", encoding="utf-8")
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # Do not propagate to root logger to avoid double logging
    logger.propagate = False

    return logger
