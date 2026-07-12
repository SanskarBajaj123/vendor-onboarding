"""Thin wrapper that writes structured pipeline step logs to process_logs table."""
import logging
from typing import Any

logger = logging.getLogger(__name__)


def write(
    vendor_id: str,
    step: str,
    message: str,
    level: str = "info",
    details: dict[str, Any] | None = None,
) -> None:
    """Insert one step entry into process_logs. Non-fatal — any DB error is swallowed."""
    try:
        from app.supabase_client import get_service_client
        get_service_client().table("process_logs").insert({
            "vendor_id": vendor_id,
            "step": step,
            "level": level,
            "message": message,
            "details": details,
        }).execute()
    except Exception as exc:
        logger.warning("process_log.write failed (non-fatal): %s", exc)
