"""Document extraction via Mistral Document AI (single API call)."""
import base64
import json
import mimetypes

from app.config import get_settings

EXTRACTION_PROMPT = """You are extracting structured data from a vendor onboarding document.
The document type is: {doc_type}.

Extract only what is actually printed on this document. Return a JSON object with these fields
(use null for any field not found in this document):
- legal_name: the registered/legal company name
- address: the full registered address as a single string
- tax_id: any tax ID, EIN, VAT number, GSTIN, PAN, or registration number printed
- account_holder_name: bank account holder name
- account_number: bank account number or IBAN
- bank_name: name of the bank"""


def extract_document(
    file_bytes: bytes,
    filename: str,
    document_type: str,
    vendor_id: str | None = None,
) -> dict:
    from mistralai import Mistral
    from app.services import process_log

    settings = get_settings()
    mime_type = mimetypes.guess_type(filename)[0] or "application/pdf"
    doc_label = document_type.replace("_", " ")
    model = "pixtral-large-latest"

    if vendor_id:
        process_log.write(
            vendor_id=vendor_id,
            step="gemini_request",
            level="info",
            message=f"Sending {doc_label} to Mistral Document AI ({model})",
            details={"document_type": document_type, "filename": filename, "model": model},
        )

    b64 = base64.b64encode(file_bytes).decode()
    data_url = f"data:{mime_type};base64,{b64}"

    client = Mistral(api_key=settings.mistral_api_key)

    response = client.chat.complete(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document_url",
                        "document_url": data_url,
                    },
                    {
                        "type": "text",
                        "text": EXTRACTION_PROMPT.format(
                            doc_type=doc_label,
                        ),
                    },
                ],
            }
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )

    raw = response.choices[0].message.content or "{}"
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {}

    if vendor_id:
        non_null = {k: v for k, v in result.items() if v is not None}
        process_log.write(
            vendor_id=vendor_id,
            step="gemini_response",
            level="success" if non_null else "warning",
            message=f"Mistral extracted from {doc_label}: {', '.join(f'{k}={repr(v)}' for k, v in non_null.items()) or 'no fields found'}",
            details={"document_type": document_type, "extracted": result},
        )

    return result
