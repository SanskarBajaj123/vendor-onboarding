# AI-Powered Vendor Onboarding Platform

An end-to-end automated vendor onboarding system. Vendors submit company details and documents; the platform extracts, cross-checks, and decides — approved, pending, or rejected — with a full audit trail and real email notifications at every step.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20App-4f46e5?style=for-the-badge)](https://dev-s-vendor-onboarding.vercel.app)
[![Demo Video](https://img.shields.io/badge/Demo%20Video-Watch%20on%20Loom-00aabb?style=for-the-badge&logo=loom)](https://www.loom.com/share/f90d611d39aa4f21a560587a85e6d9e0)
[![Stack](https://img.shields.io/badge/Stack-React%20%2B%20FastAPI%20%2B%20Supabase-informational?style=for-the-badge)]()

---

## Demo

Watch the full walkthrough — happy path + all 4 edge cases — on Loom:

> **[https://www.loom.com/share/f90d611d39aa4f21a560587a85e6d9e0](https://www.loom.com/share/f90d611d39aa4f21a560587a85e6d9e0)**

Live app: **[https://dev-s-vendor-onboarding.vercel.app](https://dev-s-vendor-onboarding.vercel.app)**

---

## What it does

1. **Vendor signs up** and is taken directly to the onboarding form — company details, country-specific tax ID, bank info, and document uploads on a single page.
2. **Layer 1 (client-side)** validates everything live as the vendor types: required fields, tax ID format per country (US EIN `XX-XXXXXXX`, UK VAT `GB123456789`, India GSTIN 15-char + PAN `AAAAA9999A`), bank account format. Nothing reaches the backend until all fields are valid.
3. **Layer 2 (AI-powered)** runs on submit: Mistral OCR extracts structured data from each uploaded document and cross-checks it against the form — legal name, address, tax ID, and bank account holder — using fuzzy matching (so "Acme Inc." and "Acme Incorporated" are treated as a match, not a mismatch).
4. **Automated decision engine** produces one of three outcomes:
   - **Approved** — zero issues found
   - **Pending** — exactly one soft issue (e.g. a name formatting difference); vendor is told exactly what to fix
   - **Rejected** — tax ID hard mismatch (identity-level, not fixable by clarification), or two or more soft issues at once
5. **Real email** sent to the vendor with the decision, full reasoning, and a resubmit link if not approved.
6. **Approved vendor resubmits** → system diffs against stored record → sends a **2-minute expiring confirmation link** to the original on-file email (proves control of the trusted channel, not just the new submission). Demo both branches: confirmed in time (changes applied and re-verified), or expired (no changes made, original data stands).
7. **Employee dashboard** — see all submissions with status and reasoning, override any status (reason required, vendor is notified), or flag a logic issue to the internal dev feedback log (never visible to vendors). Full pipeline log with per-step live view.

---

## Process flow

```mermaid
flowchart TD
    A["Vendor fills form + documents<br/>(company details, bank info, tax ID, compliance docs)"]
    A --> A1{"Layer 1: Front-end validation<br/>runs live on the vendor's form"}

    A1 -- "Invalid: missing field / bad format" --> A2["Inline error shown immediately<br/>no submit possible until fixed"]
    A2 -.-> A

    A1 -- "Valid: form submitted" --> C{"Tax ID lookup"}

    C -- "New tax ID" --> D1["Create new record"]
    C -- "Existing Pending/Rejected record" --> D2["Update existing record<br/>treated as resubmission"]
    C -- "Existing Approved record" --> C2{"Diff new submission<br/>vs. stored record"}

    C2 -- "No differences" --> N1["Notify: no change<br/>status stays Approved"]
    C2 -- "Any difference found" --> S1["Security verification<br/>link sent to ORIGINAL on-file email<br/>expires in 2 minutes"]

    S1 -- "Confirmed within 2 min" --> D3["Update changed fields<br/>bank vs. non-bank noted in audit trail"]
    S1 -- "Expired / not clicked" --> S2["Resubmission rejected<br/>no update applied"]
    S2 --> S3["Email: resubmission rejected"]

    D1 --> E["Layer 2: Document verification<br/>extract + cross-check name, address, tax ID, bank ownership"]
    D2 --> E
    D3 --> E

    E --> F{"Automated status decision<br/>no manual approve gate"}

    F -- "All checks consistent" --> G["Status: Approved"]
    F -- "Minor inconsistency" --> H["Status: Pending"]
    F -- "Hard mismatch / invalid" --> I["Status: Rejected"]

    G --> J["Dashboard log<br/>status + reasoning + audit trail"]
    H --> J
    I --> J
    N1 --> J
    S3 --> J

    J --> K["Notify vendor<br/>email: status + reasoning + reapply link if not Approved"]

    subgraph RBAC["Employee Dashboard (RBAC)"]
        direction TB
        R1["View all submissions"]
        R2["Override this vendor's status<br/>requires a reason"]
        R3["Flag process/logic issue<br/>requires a reason"]
        R4["Dev feedback log<br/>internal only, never vendor-facing"]
        R1 --> R2
        R1 --> R3
        R3 --> R4
    end

    R2 -.-> J
    R2 -.-> K

    classDef approved fill:#f0fdf4,stroke:#16a34a,color:#14532d;
    classDef pending fill:#fffbeb,stroke:#d97706,color:#78350f;
    classDef rejected fill:#fef2f2,stroke:#dc2626,color:#7f1d1d;
    classDef decision fill:#f5f3ff,stroke:#7c6ff0,color:#4338ca;
    classDef process fill:#eff6ff,stroke:#2563eb,color:#1e3a8a;
    classDef rbac fill:#f0fdfa,stroke:#0d9488,color:#0f766e;

    class A1,C,C2,F decision;
    class A,D1,D2,D3,E,J,K,N1,S1 process;
    class G approved;
    class H pending;
    class I,A2,S2,S3 rejected;
    class R1,R2,R3,R4 rbac;
```

> Static export: [`vendor_onboarding_process.svg`](vendor_onboarding_process.svg) · source: [`vendor_onboarding_process.mermaid`](vendor_onboarding_process.mermaid)

---

## Edge cases demonstrated

| # | Scenario | Outcome |
|---|----------|---------|
| EC0 | Happy path — India vendor, all documents and fields match | **Approved** |
| EC2 | Single name mismatch — bank letter says "Private Limited", form says "Pvt Ltd" | **Pending** with exact mismatch named |
| EC3 | Tax ID hard mismatch — EIN on form ≠ EIN on IRS letter | **Rejected** (hard stop, identity-level) |
| EC4 | Approved vendor resubmits with changed bank details | Security verification email, 2-min expiry — both confirm and expire branches demoed |

Exact form values and document filenames for each edge case are in [`test_docs/README.md`](test_docs/README.md).

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4 |
| Backend | FastAPI (Python 3.11) |
| Auth / DB / Storage | Supabase (PostgreSQL + Row Level Security) |
| AI — document OCR | Mistral `mistral-ocr-latest` (free tier) |
| AI — structured extraction | Groq `openai/gpt-oss-20b` (free tier, separate rate limit) |
| Email delivery | Resend (real sends, free tier) |
| Hosting | Vercel (frontend + serverless API functions) |

All infrastructure is **free tier — $0/month.**

---

## Project structure

```
/
├── api/                          # FastAPI backend (Vercel serverless)
│   ├── app/
│   │   ├── routers/              # vendors.py, employees.py, verification.py
│   │   ├── services/             # document_extraction, cross_check, decision_engine,
│   │   │                         # decision_flow, email_service, diff, audit,
│   │   │                         # storage, fuzzy_match, verification_tokens
│   │   └── models/               # VendorSubmission, Issue, DecisionResult
│   ├── scripts/
│   │   ├── seed_employee.py      # create an employee account
│   │   └── generate_test_docs.py # generate test PDFs for all 4 edge cases
│   ├── index.py                  # Vercel serverless entrypoint
│   └── requirements.txt
├── web/                          # React frontend
│   └── src/
│       ├── pages/                # AuthPage, OnboardingPage, EmployeeDashboardPage,
│       │                         # EmployeeVendorDetailPage, ProcessLogsPage, VerifyPage
│       ├── components/ui/        # Shell, Card, Button, Field, StatusBadge, LiveRunView
│       ├── lib/                  # api.ts, supabase.ts, vendorSchema.ts, documents.ts
│       └── contexts/             # AuthContext
├── test_docs/                    # generated test PDFs (gitignored)
│   └── README.md                 # exact form values for each edge case
├── vendor_onboarding_process.mermaid   # process flow source
├── vendor_onboarding_process.svg       # process flow static export
├── vendor_onboarding_ui_mockup.html    # standalone UI mockup (open in browser)
└── vercel.json                         # full-stack deploy config
```

---

## Design artefacts

| File | Description |
|------|-------------|
| [`vendor_onboarding_process.mermaid`](vendor_onboarding_process.mermaid) | Mermaid source for the full process flowchart above |
| [`vendor_onboarding_process.svg`](vendor_onboarding_process.svg) | Static SVG export of the process flow |
| [`vendor_onboarding_ui_mockup.html`](vendor_onboarding_ui_mockup.html) | Standalone HTML mockup — open directly in a browser to see the sign-in/sign-up card and onboarding form with live validation error states |

---

## Running locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier)
- A [Mistral](https://console.mistral.ai) API key (free tier)
- A [Groq](https://console.groq.com) API key (free tier)
- A [Resend](https://resend.com) API key (free tier)

### Backend

```bash
cd api
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt

cp .env.example .env           # fill in secrets (see below)
uvicorn app.main:app --reload
```

### Frontend

```bash
cd web
npm install
cp .env.example .env.local     # fill in Supabase URL + anon key + API URL
npm run dev
```

### Create an employee account

```bash
cd api
PYTHONPATH=. python scripts/seed_employee.py employee@example.com YourPassword123!
```

### Generate test documents

```bash
cd api
PYTHONPATH=. python scripts/generate_test_docs.py
# outputs to test_docs/ — see test_docs/README.md for exact form values per edge case
```

---

## Environment variables

### Backend (`api/.env`)

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MISTRAL_API_KEY=
GROQ_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_TO_OVERRIDE=          # optional: redirect all emails to one address (useful for testing)
FRONTEND_URL=http://localhost:5173
```

### Frontend (`web/.env.local`)

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:8000
```

---

## Database schema

Five tables in Supabase with Row Level Security enabled:

| Table | Purpose |
|-------|---------|
| `profiles` | Every auth user (vendor or employee) with `role` |
| `vendors` | One row per vendor — all form fields, status, `latest_reasoning` |
| `audit_log` | Every automated decision and employee override with full context |
| `verification_tokens` | 2-minute expiring links for approved-vendor resubmissions |
| `dev_feedback` | Internal employee flags on process/logic issues (never vendor-facing) |

RLS policies: vendors see only their own row; employees see everything. Writes to `audit_log`, `verification_tokens`, and `dev_feedback` are service-role only (backend-side, bypasses RLS by design).

---

## Deploying to Vercel

1. Push to GitHub, import the repo in Vercel.
2. Set these environment variables in the Vercel project dashboard:

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
MISTRAL_API_KEY
GROQ_API_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
FRONTEND_URL     ← your https://your-app.vercel.app URL
```

The frontend env vars (`VITE_*`) are in `web/.env.production` and baked in at build time.

---

## Author

**Sanskar Bajaj** — [GitHub](https://github.com/SanskarBajaj123)
