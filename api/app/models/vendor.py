from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

Country = Literal["US", "UK", "IN"]

DOCUMENT_TYPES = Literal[
    "registration_certificate",
    "bank_confirmation_letter",
    "ein_confirmation_letter",  # US only
    "vat_certificate",  # UK only
    "gst_certificate",  # IN only
    "pan_card_copy",  # IN only
]

REQUIRED_DOCUMENTS: dict[Country, list[str]] = {
    "US": ["registration_certificate", "bank_confirmation_letter", "ein_confirmation_letter"],
    "UK": ["registration_certificate", "bank_confirmation_letter", "vat_certificate"],
    "IN": [
        "registration_certificate",
        "bank_confirmation_letter",
        "gst_certificate",
        "pan_card_copy",
    ],
}


class Address(BaseModel):
    street: str
    city: str
    region: str
    postal_code: str
    country: str


class DocumentRef(BaseModel):
    type: DOCUMENT_TYPES
    storage_path: str
    filename: str


class VendorSubmission(BaseModel):
    legal_name: str = Field(min_length=1)
    trading_name: Optional[str] = None
    country: Country
    address: Address

    tax_id: str = Field(min_length=1)  # EIN / VAT number / GSTIN
    pan: Optional[str] = None  # India only

    bank_name: str = Field(min_length=1)
    bank_account_holder_name: str = Field(min_length=1)
    bank_account_number: str = Field(min_length=1)
    bank_routing_number: str = Field(min_length=1)

    contact_name: str = Field(min_length=1)
    contact_email: EmailStr
    contact_phone: Optional[str] = None
    contact_phone_country_code: Optional[str] = None

    documents: list[DocumentRef]
