from typing import Literal

from pydantic import BaseModel

Severity = Literal["hard", "soft"]


class Issue(BaseModel):
    type: str  # e.g. "tax_id_mismatch", "name_mismatch", "address_mismatch", "missing_document"
    severity: Severity
    message: str  # human-readable, shown to the vendor as-is
    field: str | None = None


class DecisionResult(BaseModel):
    status: Literal["approved", "pending", "rejected"]
    issues: list[Issue]
    reasoning: str
