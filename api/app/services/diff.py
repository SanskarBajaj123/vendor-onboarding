from app.models.vendor import VendorSubmission

# Fields on the vendors row that a submission can change. Maps submission
# field -> stored column name (identical for all but the nested address).
COMPARABLE_FIELDS = [
    "legal_name",
    "trading_name",
    "tax_id",
    "pan",
    "bank_name",
    "bank_account_holder_name",
    "bank_account_number",
    "bank_routing_number",
    "current_contact_email",
    "contact_phone",
]

BANK_FIELDS = {"bank_name", "bank_account_holder_name", "bank_account_number", "bank_routing_number"}


def diff_submission(submission: VendorSubmission, stored: dict) -> dict:
    """Returns {changed: bool, changed_fields: [...], bank_changed: bool}."""
    changed_fields: list[str] = []

    field_map = {
        "legal_name": submission.legal_name,
        "trading_name": submission.trading_name,
        "tax_id": submission.tax_id,
        "pan": submission.pan,
        "bank_name": submission.bank_name,
        "bank_account_holder_name": submission.bank_account_holder_name,
        "bank_account_number": submission.bank_account_number,
        "bank_routing_number": submission.bank_routing_number,
        "current_contact_email": submission.contact_email,
        "contact_phone": submission.contact_phone,
    }

    for field in COMPARABLE_FIELDS:
        if (stored.get(field) or None) != (field_map.get(field) or None):
            changed_fields.append(field)

    if (stored.get("address") or {}) != submission.address.model_dump():
        changed_fields.append("address")

    return {
        "changed": len(changed_fields) > 0,
        "changed_fields": changed_fields,
        "bank_changed": any(f in BANK_FIELDS for f in changed_fields),
    }
