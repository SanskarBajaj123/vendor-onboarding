from app.models.decision import Issue
from app.models.vendor import REQUIRED_DOCUMENTS, VendorSubmission
from app.services import storage
from app.services.fuzzy_match import addresses_match, names_match, tax_ids_match
from app.services.gemini_extraction import extract_document

ID_DOCUMENT_BY_COUNTRY = {
    "US": "ein_confirmation_letter",
    "UK": "vat_certificate",
    "IN": "gst_certificate",
}


def run_layer_2(submission: VendorSubmission, vendor_id: str) -> tuple[list[Issue], dict]:
    issues: list[Issue] = []

    # 1. Missing required documents for this country
    submitted_types = {d.type for d in submission.documents}
    for required_type in REQUIRED_DOCUMENTS[submission.country]:
        if required_type not in submitted_types:
            issues.append(
                Issue(
                    type="missing_document",
                    severity="soft",
                    message=f"Missing required document: {required_type.replace('_', ' ')}.",
                    field=required_type,
                )
            )

    # 2. Extract structured data from each uploaded document via Gemini
    extracted_by_type: dict[str, dict] = {}
    for doc in submission.documents:
        file_bytes = storage.download_document(doc.storage_path)
        try:
            extracted_by_type[doc.type] = extract_document(file_bytes, doc.filename, doc.type)
        except Exception as e:
            issues.append(
                Issue(
                    type="extraction_failed",
                    severity="soft",
                    message=f"Could not read the {doc.type.replace('_', ' ')} document: {e}",
                    field=doc.type,
                )
            )

    registration = extracted_by_type.get("registration_certificate")
    bank_letter = extracted_by_type.get("bank_confirmation_letter")
    id_doc = extracted_by_type.get(ID_DOCUMENT_BY_COUNTRY.get(submission.country, ""))
    pan_doc = extracted_by_type.get("pan_card_copy")

    # 3. Legal name: form vs. registration certificate
    if registration and registration.get("legal_name"):
        if not names_match(submission.legal_name, registration["legal_name"]):
            issues.append(
                Issue(
                    type="name_mismatch",
                    severity="soft",
                    message=(
                        f"Legal name on the form ('{submission.legal_name}') does not match "
                        f"the name on the registration certificate ('{registration['legal_name']}')."
                    ),
                    field="legal_name",
                )
            )

    # 4. Address: form vs. registration certificate
    if registration and registration.get("address"):
        form_address = ", ".join(
            [
                submission.address.street,
                submission.address.city,
                submission.address.region,
                submission.address.postal_code,
            ]
        )
        if not addresses_match(form_address, registration["address"]):
            issues.append(
                Issue(
                    type="address_mismatch",
                    severity="soft",
                    message=(
                        "Registered address on the form does not match the address on the "
                        "registration certificate."
                    ),
                    field="address",
                )
            )

    # 5. Tax ID: form vs. country ID document — HARD stop, not a formatting issue
    if id_doc and id_doc.get("tax_id"):
        if not tax_ids_match(submission.tax_id, id_doc["tax_id"]):
            issues.append(
                Issue(
                    type="tax_id_mismatch",
                    severity="hard",
                    message=(
                        f"Tax ID on the form ('{submission.tax_id}') does not match the tax ID "
                        f"printed on the submitted identification document ('{id_doc['tax_id']}')."
                    ),
                    field="tax_id",
                )
            )

    # 5b. India: PAN cross-check against the PAN card copy (also identity, also hard)
    if submission.country == "IN" and pan_doc and pan_doc.get("tax_id") and submission.pan:
        if not tax_ids_match(submission.pan, pan_doc["tax_id"]):
            issues.append(
                Issue(
                    type="tax_id_mismatch",
                    severity="hard",
                    message=(
                        f"PAN on the form ('{submission.pan}') does not match the PAN printed "
                        f"on the submitted PAN card copy ('{pan_doc['tax_id']}')."
                    ),
                    field="pan",
                )
            )

    # 6. Bank account ownership: form account holder vs. bank confirmation letter
    if bank_letter and bank_letter.get("account_holder_name"):
        if not names_match(
            submission.bank_account_holder_name, bank_letter["account_holder_name"]
        ):
            issues.append(
                Issue(
                    type="bank_ownership_mismatch",
                    severity="soft",
                    message=(
                        f"Bank account holder name on the form "
                        f"('{submission.bank_account_holder_name}') does not match the name on "
                        f"the bank confirmation letter ('{bank_letter['account_holder_name']}')."
                    ),
                    field="bank_account_holder_name",
                )
            )

    return issues, extracted_by_type
