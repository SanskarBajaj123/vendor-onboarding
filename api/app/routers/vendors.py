import logging

from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, require_vendor
from app.config import get_settings
from app.models.vendor import VendorSubmission
from app.services import audit
from app.services import diff as diff_service
from app.services import email_service, storage, verification_tokens
from app.services.decision_flow import run_decision, vendor_row_from_submission
from app.supabase_client import get_service_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("/me")
async def get_my_vendor_record(user: CurrentUser = Depends(require_vendor)):
    client = get_service_client()
    row = client.table("vendors").select("*").eq("id", user.id).maybe_single().execute()
    return row.data if row and row.data else None


@router.post("/upload-url")
async def get_upload_url(
    document_type: str, filename: str, user: CurrentUser = Depends(require_vendor)
):
    return storage.create_upload_url(user.id, document_type, filename)


@router.post("/submit")
async def submit_vendor(
    payload: VendorSubmission, user: CurrentUser = Depends(require_vendor)
):
    client = get_service_client()
    existing = client.table("vendors").select("*").eq("id", user.id).maybe_single().execute()
    existing_row = existing.data if existing else None

    # Already-approved vendor editing their record -> diff + security verification path
    if existing_row and existing_row["status"] == "approved":
        diff_result = diff_service.diff_submission(payload, existing_row)

        if not diff_result["changed"]:
            try:
                email_service.send_no_change_email(existing_row["original_email"], payload.legal_name)
            except Exception as e:
                logger.warning("No-change email failed: %s", e)
            return {"status": "approved", "message": "No changes detected. Status remains Approved."}

        token_row = verification_tokens.create_token(
            vendor_id=user.id,
            pending_changes=payload.model_dump(mode="json"),
            sent_to_email=existing_row["original_email"],
        )
        settings = get_settings()
        confirm_url = f"{settings.frontend_url}/verify/{token_row['token']}"
        try:
            email_service.send_security_verification_email(
                existing_row["original_email"], payload.legal_name, confirm_url
            )
        except Exception as e:
            logger.warning("Security verification email failed: %s", e)

        audit.log(
            vendor_id=user.id,
            actor_type="system",
            action="security_verification_sent",
            previous_status="approved",
            metadata={
                "changed_fields": diff_result["changed_fields"],
                "bank_changed": diff_result["bank_changed"],
            },
        )
        return {
            "status": "verification_pending",
            "message": "A confirmation link was sent to your original email on file. It expires in 2 minutes.",
        }

    # New submission or resubmission on a pending/rejected record
    row_data = vendor_row_from_submission(payload)
    previous_status = existing_row["status"] if existing_row else None

    if existing_row is None:
        row_data["id"] = user.id
        row_data["original_email"] = payload.contact_email
        row_data["status"] = "pending"
        try:
            client.table("vendors").insert(row_data).execute()
        except Exception:
            raise HTTPException(409, "This tax ID is already registered to another vendor account.")
    else:
        client.table("vendors").update(row_data).eq("id", user.id).execute()

    return run_decision(user.id, payload, previous_status)
