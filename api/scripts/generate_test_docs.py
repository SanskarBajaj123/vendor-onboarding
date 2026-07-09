"""
Generate fake but realistic test PDF documents for all 4 edge cases.

Edge case layout:
  EC1 (happy path)   - India vendor, all fields match perfectly → Approved
  EC2 (name mismatch)- India vendor, bank letter has slightly different name → Pending
  EC3 (tax ID mismatch)- US vendor, EIN on form ≠ EIN on IRS letter → Rejected
  EC4 (approved resubmit)- India vendor to resubmit with changed bank → triggers security-verify

Run from the api/ directory:
    PYTHONPATH=. venv/Scripts/python.exe scripts/generate_test_docs.py
"""

import os
from fpdf import FPDF

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "test_docs")
os.makedirs(OUT, exist_ok=True)


def pdf(filename: str) -> FPDF:
    p = FPDF()
    p.set_margins(20, 20, 20)
    p.add_page()
    p.set_auto_page_break(auto=False)
    return p


def header(p: FPDF, title: str) -> None:
    p.set_font("Helvetica", "B", 16)
    p.cell(0, 10, title, ln=True)
    p.set_draw_color(180, 180, 180)
    p.line(20, p.get_y(), 190, p.get_y())
    p.ln(4)


def field(p: FPDF, label: str, value: str) -> None:
    p.set_font("Helvetica", "B", 9)
    p.cell(55, 7, label + ":", ln=False)
    p.set_font("Helvetica", "", 10)
    p.cell(0, 7, value, ln=True)


def spacer(p: FPDF, h: int = 4) -> None:
    p.ln(h)


def save(p: FPDF, name: str) -> str:
    path = os.path.join(OUT, name)
    p.output(path)
    print(f"  OK  {name}")
    return path


# ─── EC1 & EC4 shared vendor: Acme Manufacturing Pvt Ltd (India) ─────────────

def ec1_registration():
    p = pdf("ec1_registration_certificate.pdf")
    header(p, "Certificate of Incorporation")
    p.set_font("Helvetica", "", 10)
    p.cell(0, 6, "Ministry of Corporate Affairs - Government of India", ln=True)
    spacer(p)
    field(p, "Legal Company Name", "Acme Manufacturing Pvt Ltd")
    field(p, "CIN", "U28910MH2010PTC201234")
    field(p, "Date of Incorporation", "12 March 2010")
    field(p, "Registered Address", "123 Industrial Road, Pune, Maharashtra, 411001, India")
    field(p, "Company Type", "Private Limited Company")
    spacer(p)
    p.set_font("Helvetica", "I", 9)
    p.cell(0, 6, "This certificate is issued under the Companies Act, 2013.", ln=True)
    save(p, "ec1_registration_certificate.pdf")

def ec1_gst():
    p = pdf("ec1_gst_certificate.pdf")
    header(p, "GST Registration Certificate")
    p.set_font("Helvetica", "", 10)
    p.cell(0, 6, "Goods and Services Tax Network (GSTN)", ln=True)
    spacer(p)
    field(p, "Legal Name", "Acme Manufacturing Pvt Ltd")
    field(p, "GSTIN", "27ACBCA1234F1Z5")
    field(p, "Trade Name", "Acme Mfg")
    field(p, "Principal Place of Business", "123 Industrial Road, Pune, Maharashtra, 411001")
    field(p, "Registration Date", "01 July 2017")
    field(p, "Registration Type", "Regular")
    save(p, "ec1_gst_certificate.pdf")

def ec1_pan():
    p = pdf("ec1_pan_card.pdf")
    header(p, "Permanent Account Number Card")
    p.set_font("Helvetica", "", 10)
    p.cell(0, 6, "Income Tax Department - Government of India", ln=True)
    spacer(p)
    field(p, "Name", "ACME MANUFACTURING PVT LTD")
    field(p, "PAN", "ACBCA1234F")
    field(p, "Date of Incorporation", "12/03/2010")
    spacer(p)
    p.set_font("Helvetica", "I", 9)
    p.cell(0, 6, "This card is issued under Section 139A of the Income Tax Act, 1961.", ln=True)
    save(p, "ec1_pan_card.pdf")

def ec1_bank():
    p = pdf("ec1_bank_confirmation_letter.pdf")
    header(p, "Bank Confirmation Letter")
    p.set_font("Helvetica", "", 10)
    p.cell(0, 6, "HDFC Bank Ltd  |  Branch: Pune Main  |  IFSC: HDFC0001234", ln=True)
    spacer(p)
    p.set_font("Helvetica", "", 10)
    p.multi_cell(0, 6,
        "This is to confirm that the following account is maintained with our branch:")
    spacer(p, 2)
    field(p, "Account Holder Name", "Acme Manufacturing Pvt Ltd")
    field(p, "Account Number", "50200012345678")
    field(p, "Account Type", "Current Account")
    field(p, "SWIFT / BIC", "HDFCINBBXXX")
    field(p, "Bank Name", "HDFC Bank")
    spacer(p)
    p.set_font("Helvetica", "I", 9)
    p.cell(0, 6, "Issued for vendor onboarding purposes. Valid for 90 days.", ln=True)
    save(p, "ec1_bank_confirmation_letter.pdf")

# ─── EC2 - name mismatch on bank letter (Pending) ────────────────────────────

def ec2_registration():
    p = pdf("ec2_registration_certificate.pdf")
    header(p, "Certificate of Incorporation")
    p.set_font("Helvetica", "", 10)
    p.cell(0, 6, "Ministry of Corporate Affairs - Government of India", ln=True)
    spacer(p)
    field(p, "Legal Company Name", "Brightfield Solutions Pvt Ltd")
    field(p, "CIN", "U72200KA2015PTC305678")
    field(p, "Date of Incorporation", "03 June 2015")
    field(p, "Registered Address", "45 Tech Park, Bangalore, Karnataka, 560001, India")
    save(p, "ec2_registration_certificate.pdf")

def ec2_gst():
    p = pdf("ec2_gst_certificate.pdf")
    header(p, "GST Registration Certificate")
    p.set_font("Helvetica", "", 10)
    p.cell(0, 6, "Goods and Services Tax Network (GSTN)", ln=True)
    spacer(p)
    field(p, "Legal Name", "Brightfield Solutions Pvt Ltd")
    field(p, "GSTIN", "29BFSPL5678G1ZT")
    field(p, "Registered Address", "45 Tech Park, Bangalore, Karnataka, 560001")
    save(p, "ec2_gst_certificate.pdf")

def ec2_pan():
    p = pdf("ec2_pan_card.pdf")
    header(p, "Permanent Account Number Card")
    p.set_font("Helvetica", "", 10)
    p.cell(0, 6, "Income Tax Department - Government of India", ln=True)
    spacer(p)
    field(p, "Name", "BRIGHTFIELD SOLUTIONS PVT LTD")
    field(p, "PAN", "BFSPL5678G")
    save(p, "ec2_pan_card.pdf")

def ec2_bank():
    """Bank letter has 'Brightfield Solutions Private Limited' instead of 'Pvt Ltd' → name mismatch → Pending"""
    p = pdf("ec2_bank_confirmation_letter.pdf")
    header(p, "Bank Confirmation Letter")
    p.set_font("Helvetica", "", 10)
    p.cell(0, 6, "Kotak Mahindra Bank  |  SWIFT: KKBKINBBXXX", ln=True)
    spacer(p)
    # DELIBERATE MISMATCH: 'Private Limited' vs 'Pvt Ltd' on the form
    field(p, "Account Holder Name", "Brightfield Solutions Private Limited")
    field(p, "Account Number", "9876543210")
    field(p, "Account Type", "Current Account")
    field(p, "SWIFT / BIC", "KKBKINBBXXX")
    save(p, "ec2_bank_confirmation_letter.pdf")

# ─── EC3 - tax ID hard mismatch (Rejected) ───────────────────────────────────

def ec3_registration():
    p = pdf("ec3_registration_certificate.pdf")
    header(p, "Certificate of Incorporation / Business Registration")
    p.set_font("Helvetica", "", 10)
    p.cell(0, 6, "State of Delaware  |  Division of Corporations", ln=True)
    spacer(p)
    field(p, "Legal Company Name", "Meridian Tech Solutions Inc.")
    field(p, "Entity Type", "Corporation")
    field(p, "File Number", "7891234")
    field(p, "Registered Address", "500 Market Street, Suite 800, Wilmington, DE 19801, USA")
    field(p, "Date of Formation", "15 January 2018")
    save(p, "ec3_registration_certificate.pdf")

def ec3_ein():
    """IRS letter has a DIFFERENT EIN than the one on the form → hard mismatch → Rejected"""
    p = pdf("ec3_ein_confirmation_letter.pdf")
    header(p, "IRS EIN Confirmation - CP 575")
    p.set_font("Helvetica", "", 10)
    p.cell(0, 6, "Department of the Treasury  |  Internal Revenue Service", ln=True)
    spacer(p)
    p.multi_cell(0, 6,
        "We assigned you an Employer Identification Number (EIN). Please keep this notice "
        "in your permanent records.")
    spacer(p)
    field(p, "Company Name", "Meridian Tech Solutions Inc.")
    # DELIBERATE MISMATCH: form will have 83-4567890, letter shows 83-9999999
    field(p, "EIN", "83-9999999")
    field(p, "Address", "500 Market Street, Suite 800, Wilmington, DE 19801")
    spacer(p)
    p.set_font("Helvetica", "I", 9)
    p.cell(0, 6, "This EIN is permanent and unique to your organisation.", ln=True)
    save(p, "ec3_ein_confirmation_letter.pdf")

def ec3_bank():
    p = pdf("ec3_bank_confirmation_letter.pdf")
    header(p, "Bank Confirmation Letter")
    p.set_font("Helvetica", "", 10)
    p.cell(0, 6, "Bank of America  |  SWIFT: BOFAUS3N", ln=True)
    spacer(p)
    field(p, "Account Holder Name", "Meridian Tech Solutions Inc.")
    field(p, "Account Number", "0012345678901")
    field(p, "Routing Number", "121000358")
    field(p, "Account Type", "Business Checking")
    save(p, "ec3_bank_confirmation_letter.pdf")

# ─── EC4 - same vendor as EC1, used for approved-then-resubmit demo ──────────
# (reuses EC1 docs for initial approval; no separate doc set needed)

# ─── README ──────────────────────────────────────────────────────────────────

def write_readme():
    path = os.path.join(OUT, "README.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write("""# Test documents for vendor onboarding demo

## Edge case 1 - Happy path → Approved (India vendor)
Form values to use:
  Legal name:              Acme Manufacturing Pvt Ltd
  Country:                 India
  GSTIN:                   27ACBCA1234F1Z5
  PAN:                     ACBCA1234F
  Address:                 123 Industrial Road, Pune, Maharashtra, 411001
  Bank name:               HDFC Bank
  Account holder name:     Acme Manufacturing Pvt Ltd
  Account number:          50200012345678
  SWIFT-BIC:               HDFCINBBXXX
  Contact email:           accounts@acmemfg.com

Documents: ec1_registration_certificate.pdf, ec1_gst_certificate.pdf,
           ec1_pan_card.pdf, ec1_bank_confirmation_letter.pdf

Expected result: Approved ✓

---

## Edge case 2 - Single name mismatch → Pending (India vendor)
Form values to use:
  Legal name:              Brightfield Solutions Pvt Ltd
  Country:                 India
  GSTIN:                   29BFSPL5678G1ZT
  PAN:                     BFSPL5678G
  Address:                 45 Tech Park, Bangalore, Karnataka, 560001
  Bank name:               Kotak Mahindra Bank
  Account holder name:     Brightfield Solutions Pvt Ltd
  Account number:          9876543210
  SWIFT-BIC:               KKBKINBBXXX

Documents: ec2_registration_certificate.pdf, ec2_gst_certificate.pdf,
           ec2_pan_card.pdf, ec2_bank_confirmation_letter.pdf

Expected result: Pending - bank letter says "Private Limited", form says "Pvt Ltd"

---

## Edge case 3 - Tax ID hard mismatch → Rejected (US vendor)
Form values to use:
  Legal name:              Meridian Tech Solutions Inc.
  Country:                 United States
  EIN (form):              83-4567890   ← DIFFERENT from what's on the IRS letter
  Address:                 500 Market Street Suite 800, Wilmington, DE, 19801
  Bank name:               Bank of America
  Account holder name:     Meridian Tech Solutions Inc.
  Account number:          0012345678901
  Routing:                 121000358

Documents: ec3_registration_certificate.pdf, ec3_ein_confirmation_letter.pdf,
           ec3_bank_confirmation_letter.pdf

Expected result: Rejected - EIN on form (83-4567890) ≠ EIN on letter (83-9999999)

---

## Edge case 4 - Approved vendor resubmits (security verification)
First: submit EC1 docs and get Approved.
Then: sign in again, change bank account number to anything different, resubmit.
Expected result: security-verification email sent to original on-file email (2-min link).
Demo BOTH branches:
  a) Click link within 2 min → Confirmed, changes applied, re-verified
  b) Wait 2 min, then click → Expired, no changes applied
""")
    print(f"  OK  README.md")


if __name__ == "__main__":
    print(f"Generating test docs into {os.path.abspath(OUT)}/\n")
    ec1_registration()
    ec1_gst()
    ec1_pan()
    ec1_bank()
    ec2_registration()
    ec2_gst()
    ec2_pan()
    ec2_bank()
    ec3_registration()
    ec3_ein()
    ec3_bank()
    write_readme()
    print(f"\nDone. {len(os.listdir(OUT))} files created.")
