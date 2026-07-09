"""One-off script to create an employee account (role='employee').

Public sign-up always creates role='vendor' (see auto_create_profile_on_signup
migration). Employee accounts are provisioned out-of-band, here, by passing
role='employee' in the new user's metadata so the same trigger picks it up.

Usage:
    venv/Scripts/python.exe scripts/seed_employee.py employee@example.com SomePassword123!
"""

import sys

from app.supabase_client import get_service_client


def create_employee(email: str, password: str) -> None:
    client = get_service_client()
    result = client.auth.admin.create_user(
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"role": "employee"},
        }
    )
    print(f"Created employee account: {result.user.email} ({result.user.id})")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python scripts/seed_employee.py <email> <password>")
        sys.exit(1)
    create_employee(sys.argv[1], sys.argv[2])
