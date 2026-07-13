"""Document extraction via Mistral OCR + Mistral Small structured output."""
import base64
import json
import mimetypes

from app.config import get_settings

EXTRACTION_PROMPT = """You are extracting structured data from a vendor onboarding document.
The document type is: {doc_type}.

From the text below, extract only what is actually present. Return a JSON object with these fields
(use null for any field not found in this document):
- legal_name: the registered/legal company name
- address: the full registered address as a single string
- tax_id: any tax ID, EIN, VAT number, GSTIN, PAN, or registration number printed
- account_holder_name: bank account holder name
- account_number: bank account number or IBAN
- bank_name: name of the bank

Document text:
{text}"""


def _ocr(file_bytes: bytes, mime_type: str) -> str:
    """Call Mistral OCR and return extracted text."""
    from mistralai import Mistral

    settings = get_settings()
    client = Mistral(api_key=settings.mistral_api_key)

    b64 = base64.b64encode(file_bytes).decode()
    data_url = f"data:{mime_type};base64,{b64}"

    if mime_type == "application/pdf":
        document = {"type": "document_url", "document_url": data_url}
    else:
        document = {"type": "image_url", "image_url": data_url}

    response = client.ocr.process(
        model="mistral-ocr-latest",
        document=document,
    )

    # Collect text from all pages
    pages = getattr(response, "pages", None) or []
    if pages:
        return "\n\n".join(p.markdown for p in pages if getattr(p, "markdown", None))
    # Fallback for single-text response shapes
    return str(response)


def _extract_fields(text: str, document_type: str) -> dict:
    """Send OCR text to Mistral Small and get structured JSON."""
    from mistralai import Mistral

    settings = get_settings()
    client = Mistral(api_key=settings.mistral_api_key)

    response = client.chat.complete(
        model="mistral-small-latest",
        messages=[
            {
                "role": "user",
                "content": EXTRACTION_PROMPT.format(
                    doc_type=document_type.replace("_", " "),
                    text=text[:8000],  # stay within context limits
                ),
            }
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )

    raw = response.choices[0].message.content or "{}"
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def extract_document(
    file_bytes: bytes,
    filename: str,
    document_type: str,
    vendor_id: str | None = None,
) -> dict:
    from app.services import process_log

    mime_type = mimetypes.guess_type(filename)[0] or "application/pdf"
    doc_label = document_type.replace("_", " ")

    if vendor_id:
        process_log.write(
            vendor_id=vendor_id,
            step="gemini_request",
            level="info",
            message=f"Sending {doc_label} to Mistral OCR",
            details={"document_type": document_type, "filename": filename, "model": "mistral-ocr-latest"},
        )

    # Step 1: OCR
    text = _ocr(file_bytes, mime_type)

    # Step 2: Structured extraction
    result = _extract_fields(text, document_type)

    if vendor_id:
        non_null = {k: v for k, v in result.items() if v is not None}
        process_log.write(
            vendor_id=vendor_id,
            step="gemini_response",
            level="success" if non_null else "warning",
            message=f"Mistral extracted from {doc_label}: {', '.join(f'{k}={repr(v)}' for k, v in non_null.items()) or 'no fields found'}",
            details={"document_type": document_type, "ocr_text_length": len(text), "extracted": result},
        )

    return result
