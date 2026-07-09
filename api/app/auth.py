from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.supabase_client import get_service_client

bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser:
    def __init__(self, id: str, email: str, role: str):
        self.id = id
        self.email = email
        self.role = role


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    client = get_service_client()
    try:
        user_resp = client.auth.get_user(credentials.credentials)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    user = user_resp.user if user_resp else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    profile = (
        client.table("profiles").select("role, email").eq("id", user.id).single().execute()
    )
    if not profile.data:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No profile found for this user")

    return CurrentUser(id=user.id, email=profile.data["email"], role=profile.data["role"])


async def require_employee(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "employee":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Employee role required")
    return user


async def require_vendor(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "vendor":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Vendor role required")
    return user
