from typing import Optional

from app.supabase_client import get_service_client


def log(
    vendor_id: str,
    actor_type: str,  # 'system' | 'employee'
    action: str,
    previous_status: Optional[str] = None,
    new_status: Optional[str] = None,
    reason: Optional[str] = None,
    actor_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    client = get_service_client()
    client.table("audit_log").insert(
        {
            "vendor_id": vendor_id,
            "actor_type": actor_type,
            "actor_id": actor_id,
            "action": action,
            "previous_status": previous_status,
            "new_status": new_status,
            "reason": reason,
            "metadata": metadata or {},
        }
    ).execute()
