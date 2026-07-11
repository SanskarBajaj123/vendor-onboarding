import logging

from app.config import get_settings
from app.models.vendor import VendorSubmission
from app.services import audit, cross_check, email_service
from app.services.decision_engine import decide
from app.supabase_client import get_service_client

logger = logging.getLogger(__name__)


def vendor_row_from_submission(submission: VendorSubmission) -> dict:
    return {
        "tax_id": submission.tax_id,
        "tax_id_country": submission.country,
        "pan": submission.pan,
        "legal_name": submission.legal_name,
        "trading_name": submission.trading_name,
        "address": submission.address.model_dump(),
        "bank_name": submission.bank_name,
        "bank_account_holder_name": submission.bank_account_holder_name,
        "bank_account_number": submission.bank_account_number,
        "bank_routing_number": submission.bank_routing_number,
        "current_contact_email": submission.contact_email,
        "documents": [d.model_dump() for d in submission.documents],
    }


def run_decision(vendor_id: str, submission: VendorSubmission, previous_status: str) -> dict:
    """Runs Layer 2 + the decision engine, persists the result, and notifies the vendor.
    Used both for first-time/resubmission flow and after a confirmed security verification."""
    client = get_service_client()
    settings = get_settings()

    issues, extracted = cross_check.run_layer_2(submission, vendor_id)
    result = decide(issues)

    update = {
        "status": result.status,
        "latest_reasoning": {
            "issues": [i.model_dump() for i in result.issues],
            "reasoning": result.reasoning,
        },
    }
    if result.status == "approved":
        # original_email only gets (re)pinned to the currently-verified contact
        # email once a submission is actually approved.
        update["original_email"] = submission.contact_email

    client.table("vendors").update(update).eq("id", vendor_id).execute()

    audit.log(
        vendor_id=vendor_id,
        actor_type="system",
        action="automated_decision",
        previous_status=previous_status,
        new_status=result.status,
        reason=result.reasoning,
        metadata={"issues": [i.model_dump() for i in result.issues], "extracted": extracted},
    )

    reapply_url = None if result.status == "approved" else f"{settings.frontend_url}/vendor"
    try:
        email_service.send_decision_email(
            to=submission.contact_email,
            legal_name=submission.legal_name,
            status=result.status,
            reasoning=result.reasoning,
            reapply_url=reapply_url,
        )
    except Exception as e:
        logger.warning("Email notification failed (decision already committed): %s", e)

    return {"status": result.status, "reasoning": result.reasoning, "issues": [i.model_dump() for i in result.issues]}
