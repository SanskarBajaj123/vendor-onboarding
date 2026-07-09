from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import CurrentUser, require_employee
from app.services import audit, email_service
from app.supabase_client import get_service_client

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("/vendors")
async def list_vendors(user: CurrentUser = Depends(require_employee)):
    client = get_service_client()

    # All vendor profiles (every account with role=vendor)
    profiles = (
        client.table("profiles")
        .select("id, email, created_at")
        .eq("role", "vendor")
        .execute()
        .data or []
    )

    # All submitted vendor rows
    submitted = client.table("vendors").select("*").order("updated_at", desc=True).execute().data or []
    submitted_ids = {r["id"] for r in submitted}

    # Profiles that signed up but never submitted → surface as status="registered"
    unsubmitted = [
        {
            "id": p["id"],
            "legal_name": None,
            "tax_id_country": None,
            "status": "registered",
            "updated_at": p["created_at"],
            "latest_reasoning": None,
            "email": p["email"],
        }
        for p in profiles
        if p["id"] not in submitted_ids
    ]

    return submitted + unsubmitted


@router.get("/vendors/{vendor_id}")
async def get_vendor(vendor_id: str, user: CurrentUser = Depends(require_employee)):
    client = get_service_client()
    vendor = client.table("vendors").select("*").eq("id", vendor_id).single().execute().data
    audit_trail = (
        client.table("audit_log")
        .select("*")
        .eq("vendor_id", vendor_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return {"vendor": vendor, "audit_trail": audit_trail}


class OverrideRequest(BaseModel):
    new_status: Literal["approved", "pending", "rejected"]
    reason: str


@router.post("/vendors/{vendor_id}/override")
async def override_status(
    vendor_id: str, payload: OverrideRequest, user: CurrentUser = Depends(require_employee)
):
    client = get_service_client()
    vendor = client.table("vendors").select("*").eq("id", vendor_id).single().execute().data

    client.table("vendors").update({"status": payload.new_status}).eq("id", vendor_id).execute()

    audit.log(
        vendor_id=vendor_id,
        actor_type="employee",
        actor_id=user.id,
        action="status_override",
        previous_status=vendor["status"],
        new_status=payload.new_status,
        reason=payload.reason,
    )

    email_service.send_decision_email(
        to=vendor["current_contact_email"] or vendor["original_email"],
        legal_name=vendor["legal_name"],
        status=payload.new_status,
        reasoning=f"An employee reviewed your submission and set the status to "
        f"{payload.new_status}. Reason: {payload.reason}",
        reapply_url=None,
    )

    return {"status": "ok"}


class FlagRequest(BaseModel):
    vendor_id: str | None = None
    note: str


@router.post("/dev-feedback")
async def flag_process_issue(payload: FlagRequest, user: CurrentUser = Depends(require_employee)):
    client = get_service_client()
    client.table("dev_feedback").insert(
        {
            "vendor_id": payload.vendor_id,
            "employee_id": user.id,
            "note": payload.note,
        }
    ).execute()
    return {"status": "ok"}


@router.get("/dev-feedback")
async def list_dev_feedback(user: CurrentUser = Depends(require_employee)):
    client = get_service_client()
    rows = client.table("dev_feedback").select("*").order("created_at", desc=True).execute()
    return rows.data
