import base64
import io
import json
import mimetypes

from openai import OpenAI
from pypdf import PdfReader

from app.config import get_settings

EXTRACTION_PROMPT = """You are extracting structured data from a vendor onboarding
document for cross-checking against a submitted form. This document is a: {doc_type}.

Extract only what is actually printed on this document. Return a JSON object with these
fields (use null for any field not present on this document):
- legal_name: legal/registered company name
- address: full registered address as a single string
- tax_id: any tax ID, registration number, GSTIN, EIN, or VAT number printed
- account_holder_name: bank account holder name
- account_number: bank account number
- bank_name: name of the bank

Return only the JSON object, no explanation."""


def _get_client() -> OpenAI:
    settings = get_settings()
    return OpenAI(
        api_key=settings.xai_api_key,
        base_url="https://api.x.ai/v1",
    )


def _extract_pdf_text(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages).strip()


def _parse_json_response(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def extract_document(file_bytes: bytes, filename: str, document_type: str) -> dict:
    mime_type = mimetypes.guess_type(filename)[0] or "application/pdf"
    client = _get_client()
    prompt = EXTRACTION_PROMPT.format(doc_type=document_type)

    if mime_type == "application/pdf":
        # Extract text from PDF and send as a text message
        pdf_text = _extract_pdf_text(file_bytes)
        response = client.chat.completions.create(
            model="grok-3-mini",
            messages=[
                {
                    "role": "user",
                    "content": f"{prompt}\n\nDocument text:\n{pdf_text}",
                }
            ],
            response_format={"type": "json_object"},
        )
        return _parse_json_response(response.choices[0].message.content or "{}")
    else:
        # Image: send as base64 vision
        b64 = base64.b64encode(file_bytes).decode()
        response = client.chat.completions.create(
            model="grok-2-vision-1212",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{b64}"},
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
            response_format={"type": "json_object"},
        )
        return _parse_json_response(response.choices[0].message.content or "{}")
