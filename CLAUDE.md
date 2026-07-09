# Zamp — AI Solutions Associate Case Study — Vendor Onboarding (PS-2)

This file is the full handoff of everything decided in a long design/ideation conversation held in Cowork before this project moved to Claude Code. Read this fully before doing anything. It replaces the need to re-explain context.

## 1. The assignment (source of truth: `asa-case-study-candidate (2) (1) (1)-2.pdf` in this folder)

Candidate: Sanskar Bajaj, applying for AI Solutions Associate at Zamp. One-week take-home case study.

- Day 1: pick a problem statement, email hiring coordinator "ASA Case Study — Sanskar Bajaj — PS-2" (chosen: **PS-2, vendor onboarding**, over PS-1 invoice processing and PS-3 outreach).
- Days 2–6: build a working automated process, happy path first, then 2–4 deliberate edge cases.
- Day 7: submit (a) a live, runnable process link and (b) a 5-minute demo video (Loom/screen recording) showing the happy path + at least one edge case, narrated.
- Deliverable must actually execute on real inputs — not a mockup. Needs a UI with a live run view (stage-by-stage) and a dashboard (history/status/outputs). A clean console log or simple dashboard is acceptable per the FAQ; doesn't need to be a polished product.
- If it advances: live follow-up interview, re-run happy path + edge cases live, explain every decision. No slides.
- Ambiguity is expected — make and note assumptions (this file **is** that assumption log).
- Any AI tools/models allowed. No Zamp/Pace tools. Test data can be self-made.

## 1a. Why PS-2 over PS-1 and PS-3

All three problem statements (PS-1 invoice/AP processing, PS-2 vendor onboarding, PS-3 personalized outreach) were compared before committing. Claude's initial lean was toward PS-1 (richest technical surface — OCR/text extraction, fuzzy PO matching, tolerance thresholds — and the lowest live-demo risk since everything is a self-contained file). PS-3 was flagged as the flashiest concept but the most saturated genre (AI research-and-draft agents are extremely common demos) and the riskiest to run live since it depends on real-time web/LinkedIn lookups. Sanskar chose **PS-2 anyway** — a legitimate, defensible call — and the design that followed (two-layer validation, tax-ID-based identity, the security-verification fraud gate, RBAC with dual feedback channels) is what makes PS-2 stand out: it ended up just as technically rich as PS-1 would have been, with a genuinely novel, watchable-live edge case (the 2-minute expiring verification link) that neither PS-1 nor PS-3 naturally produces.

## 2. The problem, in plain terms

Vendor onboarding: verify a vendor is legitimate (company details, banking info, tax registration, compliance docs) before a company can pay them. Real-world failure modes: incomplete forms, wrong documents, name-on-form vs name-on-bank mismatches, wrong tax ID format for the claimed country, subtle cross-field inconsistencies, manual follow-up with no audit trail. A bad approval risks payment fraud or compliance issues.

Output required: a status (approved / pending / rejected) with visible reasoning, and for anything not approved, a clear message on what's needed.

## 3. The complete, locked process flow

### Entry points (auth-based, not tax-ID-based)
- **Sign up** → creates an account (Supabase Auth, email/password) → immediately shows the onboarding form. This is the "new tax ID" path.
- **Sign in** → returning vendor lands on their own record (known via session, no searching needed) → sees current status + details, editable. Edits route through the diff/security-verification logic below if the vendor is already Approved; otherwise it's a plain update.

### Layer 1 — Front-end validation (client-side, on the vendor's own form)
Runs live as the vendor types: required fields present, tax ID format matches the pattern for the selected country, bank account format valid, email valid. **Invalid → inline error shown immediately, no submit possible, nothing is sent to the backend, no email, no record created.** Valid → form submits.

### Tax ID lookup (on submit)
- **New tax ID** → create new record → goes to Layer 2.
- **Existing Pending/Rejected record** (same vendor resubmitting) → treated as a resubmission, updates that record → goes to Layer 2.
- **Existing Approved record** (this vendor, already trusted, now editing) → go to the diff step below.

### Diff vs. stored record (only for already-Approved vendors)
Compare the new submission to what's stored.
- **No differences** → send a "no change" confirmation email, status stays Approved. Done.
- **Any difference found** (bank or non-bank field) → **Security Verification**: send a confirmation link to the vendor's **original on-file email** (never the new submission's contact info — this is the point, it proves control over the already-trusted channel, not the new one). **Link expires in 2 minutes.**
  - **Confirmed within 2 min** → apply the change (bank vs. non-bank noted in the audit trail, but this no longer changes routing — see note below) → goes to Layer 2 for re-verification.
  - **Expired / not clicked** → no update is applied, original data stands, email sent: "resubmission rejected."

  Design note (locked after review): an earlier version force-routed any bank-detail change straight to a mandatory employee Pending review, on top of the security verification. This was deliberately **removed** — the 2-minute email verification to the original address already is the fraud safeguard (proof of control over the trusted channel), so a second forced gate was redundant. Bank vs. non-bank is still logged in the audit trail for transparency; it just doesn't fork the routing anymore.

### Layer 2 — Document verification (backend)
Extract structured data from the uploaded documents and cross-check against the form: legal name match, address consistency, tax ID match, bank account ownership match. Use **fuzzy matching**, not exact string matching (e.g. "Acme Inc." vs "Acme Incorporated" is a formatting difference, not fraud).

### Automated decision (no manual approve gate — the system decides, a human can only override after)
Locked thresholds, explainable in one sentence each:
- **Tax ID on the form doesn't match the tax ID on the registration document** → hard stop → **Rejected** (identity mismatch, not a clerical error, not fixable by clarification).
- **Zero issues** → **Approved**.
- **Exactly one soft issue** (one name mismatch, one address inconsistency, or one missing document) → **Pending** (plausibly an honest oversight; reasoning tells the vendor exactly what to fix).
- **Two or more soft issues at once** → **Rejected** (one odd detail is plausible, several at once looks deliberate).

### Notification + audit trail
Every automated decision (and every human override) is written to a **Dashboard Log** (status + full reasoning + audit trail), then the vendor is notified by real email (status + reasoning + a reapply/resubmit link if not Approved).

### Employee dashboard (RBAC)
Single dashboard, role-based:
- **Vendor role**: submit/edit own record, see own status only.
- **Employee role**: sees every submission, status, and reasoning. Two distinct actions, each requiring a written reason:
  1. **Override this vendor's status** — reason required, notifies the vendor, logs to that vendor's audit trail.
  2. **Flag process/logic issue** — reason required, goes to an **internal dev feedback log only**, never vendor-facing. This is a separate feedback channel: (1) is about one case, (2) is about the automation itself needing improvement. Keep these separate in the UI and in the data model.

## 4. Final locked edge cases (exactly these 4 — don't add more, don't drop these)

1. **Invalid/incomplete form** → inline front-end error, nothing ever reaches the backend. Proves Layer 1 works.
2. **Single document/name inconsistency** → Pending, with the specific mismatch named in the reasoning. Proves Layer 2 judgment.
3. **Tax ID hard mismatch, or two-plus compounding soft issues** → Rejected. Proves the hard-stop / compounding logic.
4. **Approved vendor resubmits with changed bank details** → security verification email, 2-minute expiry. Demo **both** branches live: confirmed-in-time success, and expired-and-rejected. This is the most demoable edge case since the 2-minute window is genuinely watchable in real time.

The RBAC override + dev-feedback-flagging are system-level features layered on top of all four — not a 5th edge case.

## 5. Form fields (the actual onboarding form)

**Company details**: legal company name, trading name/DBA (optional), country of registration, registered business address.

**Tax / company identification — country-conditional**:
- US: Employer Identification Number, EIN, format `XX-XXXXXXX` + IRS EIN confirmation letter (CP 575/147C).
- UK: VAT Registration Number, format `GB123456789` + VAT registration certificate.
- India: **two** fields — GSTIN (15-char alphanumeric) **and** Company PAN (format `AAAAA9999A`) — Indian companies carry both. Needs **two** documents: GST registration certificate + PAN card copy. (This asymmetry vs. US/UK is intentional — a good source of realistic edge cases; India's "complete" submission looks different from the others.)

**Bank details**: bank name, account holder name (this is what gets cross-checked against legal name and the bank letter), account number/IBAN, routing/SWIFT-BIC.

**Contact details**: primary contact name, contact email (becomes the "original on-file email" once approved — the address security verification links go to later), phone (optional).

**Documents (universal, all countries)**: business registration certificate, bank confirmation letter — plus the country-specific ID document(s) above.

## 6. Tech stack (all free-tier, this is a hard constraint)

- **Backend/DB/Auth/Storage**: Supabase project **"Vendor Onboarding"**
  - Project ref/id: `tcryappngyskjujfskta`
  - Organization: `Vendor Onboarding` (org id `npfnwmwiyxyhegzwlytp`) — note: there is only ever meant to be one Supabase org for this account; earlier confusion in the source conversation about a wrong/second org was a connector misconfiguration, now resolved.
  - Region: `ap-south-1`, cost confirmed $0/month (free tier).
  - Auth is email/password via Supabase Auth. **Tax ID is never a login credential** — it's just a form field. Login is always by email.
  - Fetch API URL and publishable/anon key via the Supabase MCP tools (`get_project_url`, `get_publishable_keys`) or the dashboard — do not hardcode secrets into this file or commit them to git. Use environment variables.
- **LLM for Layer 2** (document extraction + cross-check reasoning): **Google Gemini API** (Gemini Flash), specifically because it has a real always-free tier. Sanskar's Claude.ai subscription does **not** cover Anthropic API billing for a deployed app — that's a separate, paid, per-token product — so Claude API was deliberately ruled out for the live app itself to keep the stack at $0. (Claude/Claude Code is fine to use as the *development* tool, just not as the app's runtime API call.)
- **Email delivery** (verification links, rejection notices, status/reapply notifications): **Resend**, free tier (100/day, 3,000/month), sent for real — not simulated in the UI. This matters because the 2-minute expiry edge case needs a real, watchable inbox for the live demo.
- **Hosting**: starting with **Vercel** (has a working MCP connector, so Claude can deploy directly without manual steps) before possibly self-hosting later on an **Oracle Cloud Always Free VM**. There is no SSH or Oracle Cloud connector available in Cowork — that path requires either manual deployment by Sanskar, or running Claude Code directly on the VM over SSH (which would again be a fresh session needing this same file).
- **GitHub**: connector had a known bug in the source Cowork session (showed "Connected" but exposed no tools). If working in Claude Code directly against a git repo, this is moot — use normal git commands.

## 7. Database schema (already applied to the live Supabase project above)

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
  pan text, -- India company PAN, separate from GSTIN
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

-- RLS is ON for all five tables. Vendors can only see/edit their own row
-- (id = auth.uid()); employees (role = 'employee' in profiles) see everything.
-- Writes to audit_log / verification_tokens / dev_feedback are expected to
-- happen via server-side logic (Edge Functions using the service role key),
-- which bypasses RLS by design — that's why there are no permissive INSERT
-- policies for regular users on those three tables.
```

## 8. Build status as of handoff (from the Cowork session's task list)

- [x] Supabase project created, schema + RLS applied and verified (`list_tables` confirms all 5 tables exist with RLS on).
- [x] UI direction mocked up and approved (sign-in/sign-up card + onboarding form with country-conditional India fields shown with a live validation error state) — not yet built as real code, just a design mockup.
- [ ] Vendor auth: sign up + sign in (Supabase Auth wiring, profile creation on signup).
- [ ] Onboarding form as real code (Layer 1 validation wired up per section 5/3).
- [ ] Layer 2: document extraction + cross-check (Gemini API).
- [ ] Automated decision engine (thresholds in section 3, writes to audit_log).
- [ ] Approved-vendor resubmission + security verification (2-min expiry, Resend email).
- [ ] Employee dashboard (RBAC, override + flag-issue actions).
- [ ] Email delivery wiring (Resend, real sends for all notification types).
- [ ] Test data: fake vendors + fake documents covering US/UK/India and all 4 locked edge cases.

Nothing beyond the schema has been coded yet — the mockup was visual/exploratory only. Start with vendor auth + the onboarding form as the first real code, per the build order above.

## 9. Reference files already in this folder

- `asa-case-study-candidate (2) (1) (1)-2.pdf` — the original candidate guide from Zamp. Primary source of truth for section 1.
- `vendor_onboarding_process.mermaid` — the locked process flow (section 3) as Mermaid syntax. Paste into Mermaid Live Editor, GitHub, or Notion if it doesn't render inline wherever you're viewing it.
- `vendor_onboarding_process.svg` — a static image export of the same flow (hand-drawn, not a native Mermaid render), matches the `.mermaid` file's logic exactly (front-end validation as client-side, forced-Pending-on-bank-change branch removed). Useful for pasting into a slide or doc without needing a Mermaid renderer.
- `vendor_onboarding_ui_mockup.html` — a self-contained, standalone visual mockup of the sign-in/sign-up card and the onboarding form (with the India GSTIN+PAN dual fields and a live inline-validation-error state shown). Open directly in a browser. This is a mockup only, not the real app, real Next.js/React code still needs to be built per section 8.
- This `CLAUDE.md` — the full handoff, supersedes everything above where they conflict.

Note: there is also a persistent memory file from the Cowork session this project originated in (`project_zamp_asa_case_study.md`, in Cowork's own memory store, not in this folder) that tracks the same decisions plus some meta-notes about how Sanskar likes to work (concise responses, no em dashes). Claude Code won't auto-read that file since it lives outside this project folder — everything load-bearing from it has been folded into this document already.

## 10. Infrastructure detours worth knowing about (so they aren't repeated)

- **Supabase free-tier limit**: the account already had 2 projects (`FinTracker`, inactive, and `SimplySpent`, active), which hit the free-tier cap of 2 projects per org before the `Vendor Onboarding` project could be created. There is no project-delete tool available via MCP, only pause/restore — if more Supabase headroom is ever needed again, either delete a project manually from the Supabase dashboard, or reuse/restore an existing paused one rather than assuming a new one can just be created.
- **Supabase org mixup**: partway through, the connected Supabase account briefly resolved to the wrong organization (an old default) instead of the `Vendor Onboarding` org — this was a connector-side reconnection issue, not a data problem, and got resolved by the user reconnecting; it's flagged here only so a future session doesn't panic if `list_organizations` ever looks wrong again — just ask the user to check/reconnect.
- **GitHub connector bug**: in the originating Cowork session, the GitHub connector showed "Connected" in settings but exposed zero usable tools — a known class of bug. If working in Claude Code directly against a local git repo (which is likely, if you're reading this from inside Claude Code), this is moot, just use normal git commands.
- **No Oracle Cloud / SSH connector exists** in Cowork's MCP registry as of this handoff. If self-hosting on the Oracle Always-Free VM is still the goal, either deploy manually over your own SSH session, or run Claude Code directly on the VM (in which case that session will need this same file to have context).

## 11. Things to not re-litigate

These were deliberately decided after back-and-forth in the source conversation — don't second-guess them without a real reason:
- Login is by email, never by tax ID.
- The forced-Pending-on-bank-change branch was removed; the security verification link is the fraud control, not a second gate.
- India gets 2 ID fields + 2 documents; US/UK get 1 each — this asymmetry is intentional, not a bug.
- Exactly 4 edge cases, no more — see section 4.
- Everything in the runtime stack must be free; Claude API is excluded from the deployed app for that reason (Gemini is used instead).
