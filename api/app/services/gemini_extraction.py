"""Document extraction via Mistral free tier.

Step 1: OCR each document with pixtral-12b-2409 (Mistral vision model, free tier).
        Uses the chat completions endpoint, which has a separate rate-limit bucket
        from the dedicated OCR endpoint (mistral-ocr-latest was consistently 429ing).
Step 2: One structured extraction call with mistral-small-latest using all OCR text.
"""
import base64
import json
import mimetypes
import time
from dataclasses import dataclass

from app.config import get_settings

_RETRY_DELAYS = [10, 30, 60]  # seconds between attempts on rate-limit (429)


def _is_rate_limit(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "429" in msg or "rate limit" in msg or "too many" in msg


def _call_with_retry(fn, *args, **kwargs):
    """Call fn(*args, **kwargs), retrying up to 3 times on rate-limit errors."""
    last_exc = None
    for delay in [0] + _RETRY_DELAYS:
        if delay:
            time.sleep(delay)
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            last_exc = e
            if not _is_rate_limit(e):
                raise
    raise last_exc


def _ocr_with_pixtral(client, file_bytes: bytes, mime_type: str) -> str:
    """Use pixtral-12b-2409 (Mistral free-tier vision model) to read a document."""
    b64 = base64.b64encode(file_bytes).decode()
    resp = _call_with_retry(
        client.chat.complete,
        model="pixtral-12b-2409",
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime_type};base64,{b64}"},
                },
                {
                    "type": "text",
                    "text": (
                        "Extract all text from this document exactly as it appears. "
                        "Return the complete text content as markdown, preserving "
                        "headings, tables, and structure. Do not summarise."
                    ),
                },
            ],
        }],
        max_tokens=4096,
    )
    return resp.choices[0].message.content or ""


EXTRACTION_PROMPT = """You are extracting structured data from vendor onboarding documents.

Below are OCR-extracted texts from vendor onboarding documents, each labelled with its type.
For each document, extract only what is actually printed on it.

Return a single JSON object keyed by document type, where each value has these fields
(use null for any field not found in that document):
- legal_name: the registered/legal company name
- address: the full registered address as a single string
- tax_id: any tax ID, EIN, VAT number, GSTIN, PAN, or registration number printed
- account_holder_name: bank account holder name
- account_number: bank account number or IBAN
- bank_name: name of the bank

Example format:
{
  "registration_certificate": {"legal_name": "Acme Ltd", "address": "123 Main St", "tax_id": null, "account_holder_name": null, "account_number": null, "bank_name": null},
  "bank_confirmation_letter": {"legal_name": null, "address": null, "tax_id": null, "account_holder_name": "John Smith", "account_number": "12345678", "bank_name": "HDFC Bank"}
}

Only include keys for document types that were provided. Here are the documents:

"""


@dataclass
class DocumentInput:
    file_bytes: bytes
    filename: str
    doc_type: str


def extract_all_documents(
    documents: list[DocumentInput],
    vendor_id: str | None = None,
) -> dict[str, dict]:
    """OCR all docs with pixtral-12b-2409, then one structured extraction with mistral-small-latest."""
    from mistralai import Mistral
    from app.services import process_log

    if not documents:
        return {}

    settings = get_settings()
    client = Mistral(api_key=settings.mistral_api_key)
    doc_labels = [d.doc_type.replace("_", " ") for d in documents]

    if vendor_id:
        process_log.write(
            vendor_id=vendor_id,
            step="mistral_request",
            level="info",
            message=f"OCR-ing {len(documents)} doc(s) with pixtral-12b-2409 ({', '.join(doc_labels)})",
            details={"document_types": [d.doc_type for d in documents], "model": "pixtral-12b-2409 + mistral-small-latest"},
        )

    # Step 1: OCR each document with pixtral-12b-2409
    ocr_texts: dict[str, str] = {}
    for doc in documents:
        mime_type = mimetypes.guess_type(doc.filename)[0] or "application/pdf"
        try:
            ocr_texts[doc.doc_type] = _ocr_with_pixtral(client, doc.file_bytes, mime_type)
        except Exception as e:
            ocr_texts[doc.doc_type] = f"[OCR failed: {e}]"

    # Step 2: One structured extraction call with all OCR text combined
    combined = "\n\n".join(
        f"=== {doc_type} ===\n{text}" for doc_type, text in ocr_texts.items()
    )

    extraction_resp = _call_with_retry(
        client.chat.complete,
        model="mistral-small-latest",
        messages=[{"role": "user", "content": EXTRACTION_PROMPT + combined}],
        response_format={"type": "json_object"},
        temperature=0,
    )

    raw = extraction_resp.choices[0].message.content or "{}"
    try:
        result: dict[str, dict] = json.loads(raw)
    except json.JSONDecodeError:
        result = {}

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
            step="mistral_response",
            level="success" if any(summary.values()) else "warning",
            message="Extracted: " +
                    " | ".join(f"{dt}: {list(fields.keys())}" for dt, fields in summary.items() if fields),
            details={"extracted": result},
        )

    return result


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
