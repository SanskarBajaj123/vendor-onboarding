# Vendor Onboarding Platform — Project Design Document

This file is the canonical design reference for this project. Read it fully before making changes. All locked decisions are noted as such — don't re-litigate them without a real reason.

## 1. The problem

Vendor onboarding: verify a vendor is legitimate (company details, banking info, tax registration, compliance documents) before a company can pay them. Real-world failure modes: incomplete forms, wrong documents, name-on-form vs name-on-bank mismatches, wrong tax ID format for the claimed country, subtle cross-field inconsistencies, manual follow-up with no audit trail. A bad approval risks payment fraud or compliance issues.

Output: a status (approved / pending / rejected) with visible reasoning, and for anything not approved, a clear message on what to fix.

## 2. The complete, locked process flow

### Entry points (auth-based, not tax-ID-based)
- **Sign up** → creates an account (Supabase Auth, email/password) → immediately shows the onboarding form. This is the "new tax ID" path.
- **Sign in** → returning vendor lands on their own record → sees current status + details, editable. Edits route through diff/security-verification logic below if the vendor is already Approved; otherwise plain update.

### Layer 1 — Front-end validation (client-side, on the vendor's own form)
Runs live as the vendor types: required fields present, tax ID format matches the pattern for the selected country, bank account format valid, email valid. **Invalid → inline error shown immediately, no submit possible, nothing is sent to the backend.** Valid → form submits.

### Tax ID lookup (on submit)
- **New tax ID** → create new record → goes to Layer 2.
- **Existing Pending/Rejected record** (same vendor resubmitting) → treated as a resubmission, updates that record → goes to Layer 2.
- **Existing Approved record** (this vendor, already trusted, now editing) → go to the diff step.

### Diff vs. stored record (only for already-Approved vendors)
Compare the new submission to what's stored.
- **No differences** → send a "no change" confirmation email, status stays Approved. Done.
- **Any difference found** → **Security Verification**: send a confirmation link to the vendor's **original on-file email** (never the new submission's contact info — proves control over the already-trusted channel). **Link expires in 2 minutes.**
  - **Confirmed within 2 min** → apply the change → goes to Layer 2 for re-verification.
  - **Expired / not clicked** → no update applied, original data stands, email sent: "resubmission rejected."

Design note (locked): an earlier version force-routed any bank-detail change to a mandatory employee Pending review on top of the security verification. This was **removed** — the 2-minute email verification to the original address already is the fraud safeguard (proof of control over the trusted channel), so a second gate was redundant. Bank vs. non-bank is still logged in the audit trail for transparency; it doesn't fork the routing.

### Layer 2 — Document verification (backend)
Extract structured data from uploaded documents using Mistral OCR + Mistral LLM and cross-check against the form: legal name match, address consistency, tax ID match, bank account ownership match. Uses **fuzzy matching**, not exact string matching ("Acme Inc." vs "Acme Incorporated" is a formatting difference, not fraud).

### Automated decision (no manual approve gate — the system decides, a human can only override after)
Locked thresholds:
- **Tax ID on the form doesn't match the tax ID on the registration document** → hard stop → **Rejected** (identity mismatch, not a clerical error).
- **Zero issues** → **Approved**.
- **Exactly one soft issue** → **Pending** (plausibly an honest oversight; reasoning tells the vendor exactly what to fix).
- **Two or more soft issues at once** → **Rejected** (one odd detail is plausible, several at once looks deliberate).

### Notification + audit trail
Every automated decision (and every human override) is written to a Dashboard Log (status + full reasoning + audit trail), then the vendor is notified by real email (status + reasoning + a reapply/resubmit link if not Approved).

### Employee dashboard (RBAC)
- **Vendor role**: submit/edit own record, see own status only.
- **Employee role**: sees every submission, status, and reasoning. Two distinct actions, each requiring a written reason:
  1. **Override this vendor's status** — reason required, notifies the vendor, logs to that vendor's audit trail.
  2. **Flag process/logic issue** — reason required, goes to an **internal dev feedback log only**, never vendor-facing.

## 3. The 4 edge cases

1. **Invalid/incomplete form** → inline front-end error, nothing reaches the backend. Proves Layer 1.
2. **Single document/name inconsistency** → Pending, with the specific mismatch named. Proves Layer 2 judgment.
3. **Tax ID hard mismatch, or two-plus compounding soft issues** → Rejected. Proves the hard-stop / compounding logic.
4. **Approved vendor resubmits with changed bank details** → security verification email, 2-minute expiry. Demo both branches: confirmed-in-time success, and expired-and-rejected.

## 4. Form fields

**Company details**: legal company name, trading name/DBA (optional), country of registration, registered business address.

**Tax / company identification — country-conditional**:
- US: Employer Identification Number (EIN), format `XX-XXXXXXX` + IRS EIN confirmation letter (CP 575/147C).
- UK: VAT Registration Number, format `GB123456789` + VAT registration certificate.
- India: **two** fields — GSTIN (15-char alphanumeric) **and** Company PAN (format `AAAAA9999A`) — Indian companies carry both. Needs **two** documents: GST registration certificate + PAN card copy. (This asymmetry vs. US/UK is intentional.)

**Bank details**: bank name, account holder name, account number/IBAN, routing/SWIFT-BIC.

**Contact details**: primary contact name, contact email (becomes the "original on-file email" once approved — where security verification links go later), phone (optional).

**Documents (universal, all countries)**: business registration certificate, bank confirmation letter — plus the country-specific ID document(s) above.

## 5. Tech stack (all free-tier)

- **Backend/DB/Auth/Storage**: Supabase (`tcryappngyskjujfskta`, `ap-south-1`)
  - Auth is email/password. Tax ID is never a login credential — it's just a form field.
  - Fetch credentials via Supabase MCP tools or dashboard. Never hardcode secrets.
- **LLM for Layer 2**: Mistral AI — `mistral-ocr-latest` (OCR) + `mistral-small-latest` (structured JSON extraction). Both are always-free tier.
- **Email delivery**: Resend, free tier (100/day). Real sends — the 2-minute expiry demo requires a real inbox.
- **Hosting**: Vercel. `RESEND_TO_OVERRIDE` env var redirects all emails to the test inbox.

## 6. Database schema

```sql
-- profiles: every authenticated user (vendor or employee)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('vendor','employee')),
  email text not null,
  created_at timestamptz not null default now()
);

-- vendors: one row per vendor account, id = profile id
create table public.vendors (
  id uuid primary key references public.profiles(id) on delete cascade,
  tax_id text not null,
  tax_id_country text not null check (tax_id_country in ('US','UK','IN')),
  pan text,
  legal_name text not null,
  trading_name text,
  address jsonb,
  bank_name text,
  bank_account_holder_name text,
  bank_account_number text,
  bank_routing_number text,
  original_email text,
  current_contact_email text,
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected')),
  documents jsonb not null default '[]'::jsonb,
  latest_reasoning jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tax_id)
);

-- audit_log: every automated decision and human override
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors(id) on delete cascade,
  actor_type text not null check (actor_type in ('system','employee')),
  actor_id uuid references public.profiles(id),
  action text not null,
  previous_status text,
  new_status text,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- verification_tokens: the 2-minute security verification links
create table public.verification_tokens (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  token text not null unique,
  pending_changes jsonb not null,
  sent_to_email text not null,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

-- dev_feedback: internal only, never vendor-facing
create table public.dev_feedback (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors(id) on delete set null,
  employee_id uuid not null references public.profiles(id),
  note text not null,
  created_at timestamptz not null default now()
);

-- RLS is ON for all five tables.
-- Vendors can only see/edit their own row (id = auth.uid()).
-- Employees (role = 'employee' in profiles) see everything.
-- Writes to audit_log / verification_tokens / dev_feedback are via
-- server-side logic (service role key), which bypasses RLS by design.
```

## 7. Locked decisions — do not re-litigate

- Login is by email, never by tax ID.
- The forced-Pending-on-bank-change branch was removed; the security verification link is the fraud control, not a second gate.
- India gets 2 ID fields + 2 documents; US/UK get 1 each — intentional asymmetry, not a bug.
- Exactly 4 edge cases.
- Mistral is the document AI (not Claude API — billing model incompatible with free tier for a deployed app).

## 8. Infrastructure notes

- **Supabase free-tier limit**: 2 projects per org. If more headroom is needed, delete or reuse an existing project from the Supabase dashboard (no delete tool in MCP, only pause/restore).
- **Email overrides**: `RESEND_TO_OVERRIDE` env var on Vercel redirects all outbound emails to the test inbox. Free tier only allows sends to the verified account email.
