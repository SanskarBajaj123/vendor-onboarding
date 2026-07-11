import logging

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.models.vendor import VendorSubmission
from app.services import audit, email_service, verification_tokens
from app.services.decision_flow import run_decision, vendor_row_from_submission
from app.supabase_client import get_service_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/verify", tags=["verification"])


@router.post("/{token}")
async def confirm_verification(token: str):
    token_row = verification_tokens.get_token(token)
    if token_row is None:
        raise HTTPException(404, "This verification link is invalid.")

    client = get_service_client()
    vendor = client.table("vendors").select("*").eq("id", token_row["vendor_id"]).single().execute().data

    if token_row["confirmed_at"] is not None:
        return {"status": "already_confirmed", "message": "This link has already been used."}

    if verification_tokens.is_expired(token_row):
        try:
            email_service.send_resubmission_rejected_email(
                token_row["sent_to_email"], vendor["legal_name"], reapply_url_for(vendor)
            )
        except Exception as e:
            logger.warning("Resubmission rejected email failed: %s", e)
        audit.log(
            vendor_id=vendor["id"],
            actor_type="system",
            action="security_verification_expired",
            previous_status=vendor["status"],
            new_status=vendor["status"],
            reason="Verification link expired before confirmation. No changes applied.",
        )
        return {"status": "expired", "message": "This link expired. No changes were applied."}

    verification_tokens.mark_confirmed(token)

    submission = VendorSubmission.model_validate(token_row["pending_changes"])
    row_data = vendor_row_from_submission(submission)

    audit.log(
        vendor_id=vendor["id"],
        actor_type="system",
        action="security_verification_confirmed",
        previous_status=vendor["status"],
        metadata={"changed_fields": list(row_data.keys())},
    )

    client.table("vendors").update(row_data).eq("id", vendor["id"]).execute()

    result = run_decision(vendor["id"], submission, previous_status=vendor["status"])
    return {"status": "confirmed", "decision": result}


def reapply_url_for(vendor: dict) -> str:
    return f"{get_settings().frontend_url}/vendor"
