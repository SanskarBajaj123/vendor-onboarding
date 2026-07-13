"""Document extraction via Mistral Document AI — all documents in one API call."""
import base64
import json
import mimetypes
from dataclasses import dataclass

from app.config import get_settings

EXTRACTION_PROMPT = """You are extracting structured data from vendor onboarding documents.

Each document above is labelled with its type. For each document, extract only what is
actually printed on it. Return a single JSON object keyed by document type, where each
value has these fields (use null for any field not present in that document):
- legal_name: the registered/legal company name
- address: the full registered address as a single string
- tax_id: any tax ID, EIN, VAT number, GSTIN, PAN, or registration number printed
- account_holder_name: bank account holder name
- account_number: bank account number or IBAN
- bank_name: name of the bank

Example format:
{
  "registration_certificate": {"legal_name": "Acme Ltd", "address": "...", "tax_id": null, ...},
  "bank_confirmation_letter": {"legal_name": null, "account_holder_name": "John", ...}
}

Only include keys for documents that were provided."""


@dataclass
class DocumentInput:
    file_bytes: bytes
    filename: str
    doc_type: str


def extract_all_documents(
    documents: list[DocumentInput],
    vendor_id: str | None = None,
) -> dict[str, dict]:
    """Send all documents to Mistral in one call, get extraction keyed by doc type."""
    from mistralai import Mistral
    from app.services import process_log

    if not documents:
        return {}

    settings = get_settings()
    model = "pixtral-large-latest"
    doc_labels = [d.doc_type.replace("_", " ") for d in documents]

    if vendor_id:
        process_log.write(
            vendor_id=vendor_id,
            step="gemini_request",
            level="info",
            message=f"Sending {len(documents)} document(s) to Mistral Document AI in one call ({', '.join(doc_labels)})",
            details={"document_types": [d.doc_type for d in documents], "model": model},
        )

    # Build content blocks: one document_url block per doc, then the prompt
    content = []
    for doc in documents:
        mime_type = mimetypes.guess_type(doc.filename)[0] or "application/pdf"
        b64 = base64.b64encode(doc.file_bytes).decode()
        content.append({
            "type": "text",
            "text": f"[Document type: {doc.doc_type}]",
        })
        content.append({
            "type": "document_url",
            "document_url": f"data:{mime_type};base64,{b64}",
        })

    content.append({
        "type": "text",
        "text": EXTRACTION_PROMPT,
    })

    client = Mistral(api_key=settings.mistral_api_key)
    response = client.chat.complete(
        model=model,
        messages=[{"role": "user", "content": content}],
        response_format={"type": "json_object"},
        temperature=0,
    )

    raw = response.choices[0].message.content or "{}"
    try:
        result: dict[str, dict] = json.loads(raw)
    except json.JSONDecodeError:
        result = {}

    # Ensure every submitted doc type has an entry (default to empty dict if missing)
    for doc in documents:
        if doc.doc_type not in result:
            result[doc.doc_type] = {}

    if vendor_id:
        summary = {
            dt: {k: v for k, v in fields.items() if v is not None}
            for dt, fields in result.items()
        }
        process_log.write(
            vendor_id=vendor_id,
            step="gemini_response",
            level="success" if any(summary.values()) else "warning",
            message=f"Mistral extracted from {len(documents)} document(s): " +
                    " | ".join(f"{dt}: {list(fields.keys())}" for dt, fields in summary.items() if fields),
            details={"extracted": result},
        )

    return result


# Keep single-doc signature for backwards compatibility (used by process_log step labelling)
def extract_document(
    file_bytes: bytes,
    filename: str,
    document_type: str,
    vendor_id: str | None = None,
) -> dict:
    result = extract_all_documents(
        [DocumentInput(file_bytes=file_bytes, filename=filename, doc_type=document_type)],
        vendor_id=vendor_id,
    )
    return result.get(document_type, {})
