import resend

from app.config import get_settings

_configured = False


def _ensure_configured() -> None:
    global _configured
    if not _configured:
        resend.api_key = get_settings().resend_api_key
        _configured = True


def _send(to: str, subject: str, html: str) -> None:
    _ensure_configured()
    resend.Emails.send(
        {
            "from": get_settings().resend_from_email,
            "to": [to],
            "subject": subject,
            "html": html,
        }
    )


def send_decision_email(
    to: str, legal_name: str, status: str, reasoning: str, reapply_url: str | None
) -> None:
    status_label = {"approved": "Approved", "pending": "Pending", "rejected": "Rejected"}[status]
    reapply_block = (
        f'<p>You can update and resubmit your details here: <a href="{reapply_url}">{reapply_url}</a></p>'
        if reapply_url
        else ""
    )
    html = f"""
    <p>Hi,</p>
    <p>Your vendor onboarding submission for <strong>{legal_name}</strong> has a new status:
    <strong>{status_label}</strong>.</p>
    <p><strong>Reasoning:</strong> {reasoning}</p>
    {reapply_block}
    """
    _send(to, f"Vendor onboarding: {status_label} — {legal_name}", html)


def send_no_change_email(to: str, legal_name: str) -> None:
    html = f"""
    <p>Hi,</p>
    <p>We received a resubmission for <strong>{legal_name}</strong>, but no fields were
    actually changed from what's on file. Your status remains <strong>Approved</strong>.</p>
    """
    _send(to, f"No changes detected — {legal_name}", html)


def send_security_verification_email(to: str, legal_name: str, confirm_url: str) -> None:
    html = f"""
    <p>Hi,</p>
    <p>We received a request to change details on file for <strong>{legal_name}</strong>,
    including sensitive fields. To confirm this change came from you, click the link below
    within <strong>2 minutes</strong>:</p>
    <p><a href="{confirm_url}">{confirm_url}</a></p>
    <p>If you didn't request this change, do nothing — the request will expire automatically
    and no changes will be applied.</p>
    """
    _send(to, f"Confirm changes to your vendor profile — {legal_name}", html)


def send_resubmission_rejected_email(to: str, legal_name: str, reapply_url: str) -> None:
    html = f"""
    <p>Hi,</p>
    <p>The verification link for changes to <strong>{legal_name}</strong> expired before it
    was confirmed, so no changes were applied. Your original details remain on file and your
    status is unchanged.</p>
    <p>To try again: <a href="{reapply_url}">{reapply_url}</a></p>
    """
    _send(to, f"Resubmission not confirmed in time — {legal_name}", html)
