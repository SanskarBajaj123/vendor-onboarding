import secrets
from datetime import datetime, timedelta, timezone

from app.supabase_client import get_service_client

EXPIRY_SECONDS = 120


def create_token(vendor_id: str, pending_changes: dict, sent_to_email: str) -> dict:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=EXPIRY_SECONDS)

    client = get_service_client()
    row = (
        client.table("verification_tokens")
        .insert(
            {
                "vendor_id": vendor_id,
                "token": token,
                "pending_changes": pending_changes,
                "sent_to_email": sent_to_email,
                "expires_at": expires_at.isoformat(),
            }
        )
        .execute()
    )
    return row.data[0]


def get_token(token: str) -> dict | None:
    client = get_service_client()
    row = client.table("verification_tokens").select("*").eq("token", token).maybe_single().execute()
    return row.data if row else None


def mark_confirmed(token: str) -> None:
    client = get_service_client()
    client.table("verification_tokens").update(
        {"confirmed_at": datetime.now(timezone.utc).isoformat()}
    ).eq("token", token).execute()


def is_expired(token_row: dict) -> bool:
    expires_at = datetime.fromisoformat(token_row["expires_at"].replace("Z", "+00:00"))
    return datetime.now(timezone.utc) > expires_at
