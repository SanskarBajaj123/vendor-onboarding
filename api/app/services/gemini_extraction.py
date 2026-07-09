import json
import mimetypes

from google import genai
from google.genai import types

from app.config import get_settings

EXTRACTION_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "legal_name": types.Schema(type=types.Type.STRING, nullable=True),
        "address": types.Schema(type=types.Type.STRING, nullable=True),
        "tax_id": types.Schema(type=types.Type.STRING, nullable=True),
        "account_holder_name": types.Schema(type=types.Type.STRING, nullable=True),
        "account_number": types.Schema(type=types.Type.STRING, nullable=True),
        "bank_name": types.Schema(type=types.Type.STRING, nullable=True),
    },
)

EXTRACTION_PROMPT = """You are extracting structured data from a vendor onboarding
document for cross-checking against a submitted form. This document is a: {doc_type}.

Extract only what is actually printed on this document. Leave a field null if it
does not appear on this document (e.g. a bank letter won't have a tax ID).
Return: legal/registered company name, full registered address, any tax ID /
registration number / GSTIN / EIN / VAT number printed, bank account holder name,
bank account number, and bank name."""


def _client() -> genai.Client:
    return genai.Client(api_key=get_settings().gemini_api_key)


def extract_document(file_bytes: bytes, filename: str, document_type: str) -> dict:
    mime_type = mimetypes.guess_type(filename)[0] or "application/pdf"

    response = _client().models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
            EXTRACTION_PROMPT.format(doc_type=document_type),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=EXTRACTION_SCHEMA,
        ),
    )
    return json.loads(response.text)
