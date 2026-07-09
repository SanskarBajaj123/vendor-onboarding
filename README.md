# Vendor Onboarding Automation — Zamp AI Solutions Associate Case Study

A fully automated vendor onboarding system built for the Zamp PS-2 take-home case study. Vendors submit company details and documents; the system extracts, cross-checks, and decides — approved, pending, or rejected — with a full audit trail and real email notifications at every step.

**Live demo:** _link added after deploy_

---

## What it does

1. **Vendor signs up** → fills in company details, tax ID, bank info, and uploads documents — all on the same page, immediately after account creation.
2. **Layer 1 validation** runs client-side as they type: required fields, country-specific tax ID formats (US EIN, UK VAT, India GSTIN + PAN), bank format.
3. **Layer 2 (AI-powered)** runs on submit: Gemini Flash extracts structured data from each uploaded PDF and cross-checks it against the form — legal name, address, tax ID, bank account holder.
4. **Automated decision** with three outcomes:
   - **Approved** — zero issues
   - **Pending** — exactly one soft issue (e.g. name formatting difference); vendor told exactly what to fix
   - **Rejected** — tax ID hard mismatch, or two or more soft issues at once
5. **Vendor is emailed** the decision + reasoning + a resubmit link if not approved.
6. **Approved vendor resubmits** → system diffs against stored record → sends a **2-minute expiring confirmation link** to the original on-file email (fraud control). Demo both branches: confirmed in time, and expired.
7. **Employee dashboard** — see every submission, override status (reason required, vendor notified), or flag a logic issue to the internal dev feedback log (never vendor-facing).

---

## Edge cases demonstrated

| # | Scenario | Expected result |
|---|----------|----------------|
| EC1 | Happy path — India vendor, all fields match | **Approved** |
| EC2 | Single name mismatch — bank letter says "Private Limited", form says "Pvt Ltd" | **Pending** with specific mismatch named |
| EC3 | Tax ID hard mismatch — EIN on form ≠ EIN on IRS letter | **Rejected** (hard stop) |
| EC4 | Approved vendor resubmits with changed bank details | Security verification email, 2-min expiry — demo both confirm and expire branches |

Test documents and exact form values for each edge case are in [`test_docs/README.md`](test_docs/README.md) (generated locally, not committed).

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4 |
| Backend | FastAPI (Python) |
| Auth / DB / Storage | Supabase (free tier) |
| AI — document extraction | Google Gemini Flash (free tier) |
| Email delivery | Resend (free tier, real sends) |
| Hosting | Vercel |

All infrastructure is **free tier** — $0/month to run.

---

## Project structure

```
/
├── api/                    # FastAPI backend
│   ├── app/
│   │   ├── routers/        # vendors, employees, verification
│   │   ├── services/       # gemini_extraction, cross_check, decision_engine,
│   │   │                   # decision_flow, email_service, diff, audit, storage,
│   │   │                   # fuzzy_match, verification_tokens
│   │   └── models/         # VendorSubmission, Issue, DecisionResult
│   ├── scripts/
│   │   ├── seed_employee.py        # creates employee@zamp.demo account
│   │   └── generate_test_docs.py   # generates test PDFs for all 4 edge cases
│   ├── index.py            # Vercel serverless entrypoint
│   └── requirements.txt
├── web/                    # React frontend
│   └── src/
│       ├── pages/          # AuthPage, OnboardingPage, EmployeeDashboardPage,
│       │                   # EmployeeVendorDetailPage, VerifyPage
│       ├── components/ui/  # Shell, Card, Button, Field, StatusBadge, LiveRunView
│       ├── lib/            # api.ts, supabase.ts, vendorSchema.ts, documents.ts
│       └── contexts/       # AuthContext
└── vercel.json             # Full-stack deploy config
```

---

## Running locally

### Backend

```bash
cd api
python -m venv venv
venv/Scripts/activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt

# copy .env.example → .env and fill in secrets
cp .env.example .env

uvicorn app.main:app --reload
```

### Frontend

```bash
cd web
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key + API URL
npm run dev
```

### Seed employee account

```bash
cd api
PYTHONPATH=. venv/Scripts/python.exe scripts/seed_employee.py
# employee@zamp.demo / Password123!
```

### Generate test documents

```bash
cd api
PYTHONPATH=. venv/Scripts/python.exe scripts/generate_test_docs.py
# outputs to test_docs/ — see test_docs/README.md for form values
```

---

## Environment variables

### Backend (`api/.env`)

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev
FRONTEND_URL=http://localhost:5173
```

### Frontend (`web/.env.local`)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:8000
```

---

## Vercel deployment

Set these environment variables in the Vercel project dashboard (Settings → Environment Variables):

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
FRONTEND_URL    ← set to your https://your-app.vercel.app URL
```

The frontend variables (`VITE_*`) are baked into `web/.env.production` and committed — no dashboard config needed for those.

---

## Database schema

Five tables in Supabase with RLS enabled:

- **profiles** — every auth user (vendor or employee), with `role`
- **vendors** — one row per vendor, all form fields + status + `latest_reasoning`
- **audit_log** — every automated decision and employee override
- **verification_tokens** — 2-minute expiring links for approved-vendor resubmissions
- **dev_feedback** — internal employee flags on process/logic issues (never vendor-facing)
