from app.models.decision import Issue
from app.models.vendor import REQUIRED_DOCUMENTS, VendorSubmission
from app.services import process_log, storage
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

    # Key fields we expect to find in each document type.
    # If ALL of these are null after extraction, the doc is irrelevant/unreadable.
    EXPECTED_FIELDS: dict[str, list[str]] = {
        "registration_certificate":  ["legal_name", "address"],
        "bank_confirmation_letter":  ["account_holder_name", "account_number", "bank_name"],
        "ein_confirmation_letter":   ["tax_id"],
        "vat_certificate":           ["tax_id"],
        "gst_certificate":           ["tax_id"],
        "pan_card_copy":             ["tax_id"],
    }

    process_log.write(
        vendor_id=vendor_id,
        step="submission",
        level="info",
        message=f"Layer 2 started for '{submission.legal_name}' ({submission.country}) — {len(submission.documents)} document(s) to process",
        details={"legal_name": submission.legal_name, "country": submission.country, "document_types": [d.type for d in submission.documents]},
    )

    # 2. Extract structured data from each uploaded document via Gemini
    extracted_by_type: dict[str, dict] = {}
    for doc in submission.documents:
        file_bytes = storage.download_document(doc.storage_path)
        try:
            data = extract_document(file_bytes, doc.filename, doc.type, vendor_id=vendor_id)
            extracted_by_type[doc.type] = data

            # Check if the document looks irrelevant (all expected fields null/empty)
            expected = EXPECTED_FIELDS.get(doc.type, [])
            if expected and not any(data.get(f) for f in expected):
                issues.append(
                    Issue(
                        type="irrelevant_document",
                        severity="soft",
                        message=(
                            f"The uploaded {doc.type.replace('_', ' ')} does not appear to "
                            f"contain the expected information. Please upload the correct document."
                        ),
                        field=doc.type,
                    )
                )
                process_log.write(
                    vendor_id=vendor_id,
                    step="cross_check",
                    level="warning",
                    message=f"Irrelevant document detected: {doc.type.replace('_', ' ')} — none of the expected fields ({', '.join(expected)}) were found",
                    details={"document_type": doc.type, "expected_fields": expected},
                )
        except Exception as e:
            issues.append(
                Issue(
                    type="extraction_failed",
                    severity="soft",
                    message=f"Could not read the {doc.type.replace('_', ' ')} document: {e}",
                    field=doc.type,
                )
            )
            process_log.write(
                vendor_id=vendor_id,
                step="gemini_error",
                level="error",
                message=f"Gemini extraction failed for {doc.type.replace('_', ' ')}: {e}",
                details={"document_type": doc.type, "error": str(e)},
            )

    registration = extracted_by_type.get("registration_certificate")
    bank_letter = extracted_by_type.get("bank_confirmation_letter")
    id_doc = extracted_by_type.get(ID_DOCUMENT_BY_COUNTRY.get(submission.country, ""))
    pan_doc = extracted_by_type.get("pan_card_copy")

    # 3. Legal name: form vs. registration certificate
    if registration and registration.get("legal_name"):
        match = names_match(submission.legal_name, registration["legal_name"])
        process_log.write(
            vendor_id=vendor_id,
            step="cross_check",
            level="success" if match else "warning",
            message=f"Legal name: form='{submission.legal_name}' vs doc='{registration['legal_name']}' → {'MATCH' if match else 'MISMATCH'}",
            details={"field": "legal_name", "form_value": submission.legal_name, "doc_value": registration["legal_name"], "match": match},
        )
        if not match:
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
        match = addresses_match(form_address, registration["address"])
        process_log.write(
            vendor_id=vendor_id,
            step="cross_check",
            level="success" if match else "warning",
            message=f"Address: form='{form_address}' vs doc='{registration['address']}' → {'MATCH' if match else 'MISMATCH'}",
            details={"field": "address", "form_value": form_address, "doc_value": registration["address"], "match": match},
        )
        if not match:
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
        match = tax_ids_match(submission.tax_id, id_doc["tax_id"])
        process_log.write(
            vendor_id=vendor_id,
            step="cross_check",
            level="success" if match else "error",
            message=f"Tax ID: form='{submission.tax_id}' vs doc='{id_doc['tax_id']}' → {'MATCH' if match else 'HARD MISMATCH (identity)'}",
            details={"field": "tax_id", "form_value": submission.tax_id, "doc_value": id_doc["tax_id"], "match": match, "severity": "hard"},
        )
        if not match:
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
        match = tax_ids_match(submission.pan, pan_doc["tax_id"])
        process_log.write(
            vendor_id=vendor_id,
            step="cross_check",
            level="success" if match else "error",
            message=f"PAN: form='{submission.pan}' vs doc='{pan_doc['tax_id']}' → {'MATCH' if match else 'HARD MISMATCH (identity)'}",
            details={"field": "pan", "form_value": submission.pan, "doc_value": pan_doc["tax_id"], "match": match, "severity": "hard"},
        )
        if not match:
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
        match = names_match(submission.bank_account_holder_name, bank_letter["account_holder_name"])
        process_log.write(
            vendor_id=vendor_id,
            step="cross_check",
            level="success" if match else "warning",
            message=f"Bank holder: form='{submission.bank_account_holder_name}' vs doc='{bank_letter['account_holder_name']}' → {'MATCH' if match else 'MISMATCH'}",
            details={"field": "bank_account_holder_name", "form_value": submission.bank_account_holder_name, "doc_value": bank_letter["account_holder_name"], "match": match},
        )
        if not match:
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

    # 7. Bank account number: form vs. bank confirmation letter (exact match — identity field)
    if bank_letter and bank_letter.get("account_number") and submission.bank_account_number:
        letter_acc = bank_letter["account_number"].strip().replace(" ", "").replace("-", "")
        form_acc = submission.bank_account_number.strip().replace(" ", "").replace("-", "")
        match = letter_acc == form_acc
        process_log.write(
            vendor_id=vendor_id,
            step="cross_check",
            level="success" if match else "warning",
            message=f"Bank account number: form='{submission.bank_account_number}' vs doc='{bank_letter['account_number']}' → {'MATCH' if match else 'MISMATCH'}",
            details={"field": "bank_account_number", "form_value": submission.bank_account_number, "doc_value": bank_letter["account_number"], "match": match},
        )
        if not match:
            issues.append(
                Issue(
                    type="bank_account_mismatch",
                    severity="soft",
                    message=(
                        f"Bank account number on the form ('{submission.bank_account_number}') "
                        f"does not match the account number on the bank confirmation letter "
                        f"('{bank_letter['account_number']}')."
                    ),
                    field="bank_account_number",
                )
            )

    # 8. Bank name: form vs. bank confirmation letter (fuzzy — "HDFC" vs "HDFC Bank" is fine)
    if bank_letter and bank_letter.get("bank_name") and submission.bank_name:
        match = names_match(submission.bank_name, bank_letter["bank_name"])
        process_log.write(
            vendor_id=vendor_id,
            step="cross_check",
            level="success" if match else "warning",
            message=f"Bank name: form='{submission.bank_name}' vs doc='{bank_letter['bank_name']}' → {'MATCH' if match else 'MISMATCH'}",
            details={"field": "bank_name", "form_value": submission.bank_name, "doc_value": bank_letter["bank_name"], "match": match},
        )
        if not match:
            issues.append(
                Issue(
                    type="bank_name_mismatch",
                    severity="soft",
                    message=(
                        f"Bank name on the form ('{submission.bank_name}') does not match the "
                        f"bank name on the bank confirmation letter ('{bank_letter['bank_name']}')."
                    ),
                    field="bank_name",
                )
            )

    return issues, extracted_by_type
