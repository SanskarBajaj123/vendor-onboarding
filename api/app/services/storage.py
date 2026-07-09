import uuid

from app.supabase_client import get_service_client

BUCKET = "vendor-documents"


def create_upload_url(vendor_id: str, document_type: str, filename: str) -> dict:
    """Returns a short-lived signed URL the browser can PUT/POST the file to
    directly, plus the storage_path to reference the file afterward."""
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    storage_path = f"{vendor_id}/{document_type}/{uuid.uuid4()}.{ext}"

    client = get_service_client()
    result = client.storage.from_(BUCKET).create_signed_upload_url(storage_path)

    return {
        "storage_path": storage_path,
        "signed_url": result["signed_url"],
        "token": result["token"],
    }


def create_download_url(storage_path: str, expires_in: int = 300) -> str:
    client = get_service_client()
    result = client.storage.from_(BUCKET).create_signed_url(storage_path, expires_in)
    return result["signedURL"] if "signedURL" in result else result["signed_url"]


def download_document(storage_path: str) -> bytes:
    client = get_service_client()
    return client.storage.from_(BUCKET).download(storage_path)
