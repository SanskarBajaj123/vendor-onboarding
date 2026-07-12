import json
import mimetypes
from concurrent.futures import ThreadPoolExecutor

from google import genai
from google.genai import types

from app.config import get_settings

_executor = ThreadPoolExecutor(max_workers=4)

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


def _call_gemini(file_bytes: bytes, mime_type: str, document_type: str) -> dict:
    """Runs in a thread pool so it gets a clean event-loop context.
    The genai sync client internally calls asyncio which conflicts with
    FastAPI's running event loop when invoked directly from an async handler."""
    client = genai.Client(api_key=get_settings().gemini_api_key)
    response = client.models.generate_content(
        model="gemini-2.0-flash",
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


def extract_document(file_bytes: bytes, filename: str, document_type: str) -> dict:
    mime_type = mimetypes.guess_type(filename)[0] or "application/pdf"
    future = _executor.submit(_call_gemini, file_bytes, mime_type, document_type)
    return future.result(timeout=120)
