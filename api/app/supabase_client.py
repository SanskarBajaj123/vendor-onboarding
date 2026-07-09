from functools import lru_cache

from supabase import create_client, Client

from app.config import get_settings


@lru_cache
def get_service_client() -> Client:
    """Service-role client: bypasses RLS, used for all server-side writes
    (audit_log, verification_tokens, dev_feedback, and the decision engine)."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
