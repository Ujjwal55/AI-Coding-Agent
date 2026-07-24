import asyncio
import json
from typing import Set

# Set of active subscriber queues
_subscribers: Set[asyncio.Queue] = set()


async def subscribe_events() -> asyncio.Queue:
    """Subscribes an SSE connection to receive live log and node status JSON events."""
    queue = asyncio.Queue()
    _subscribers.add(queue)
    
    # Use logger utility to log subscription event
    from utils.logger import get_logger
    logger = get_logger("broadcaster")
    logger.info("Client subscribed to SSE broadcaster", extra={"active_subscribers": len(_subscribers)})
    
    return queue


async def unsubscribe_events(queue: asyncio.Queue):
    """Unsubscribes an SSE connection from live events."""
    _subscribers.discard(queue)
    
    from utils.logger import get_logger
    logger = get_logger("broadcaster")
    logger.info("Client unsubscribed from SSE broadcaster", extra={"active_subscribers": len(_subscribers)})


def broadcast_event(data: dict):
    """Pushes a custom JSON event object (e.g. node_status) to all active SSE subscriber queues."""
    msg = json.dumps(data) if isinstance(data, dict) else str(data)
    for queue in list(_subscribers):
        try:
            queue.put_nowait(msg)
        except Exception:
            pass


def broadcast_raw(msg: str):
    """Pushes a pre-formatted log string to all active SSE subscriber queues."""
    for queue in list(_subscribers):
        try:
            queue.put_nowait(msg)
        except Exception:
            pass
