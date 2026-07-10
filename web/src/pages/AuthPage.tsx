import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Field, SelectField, SectionLabel } from "../components/ui/Field";
import { LiveRunView, type RunStage } from "../components/ui/LiveRunView";
import { type VendorFormValues, vendorFormSchema, TAX_ID_HINTS } from "../lib/vendorSchema";
import { REQUIRED_DOCUMENTS, uploadDocument, type DocumentRef } from "../lib/documents";

// ─── Brand panel ────────────────────────────────────────────────────────────

function BrandPanel() {
  return (
    <div className="hidden flex-col justify-between bg-fill-primary p-10 text-on-primary md:flex md:w-[340px] md:shrink-0">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-on-primary text-fill-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 12l6 6L20 6"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="text-[13px] font-medium tracking-tight">Vendor Onboarding</span>
      </div>
      <div>
        <p className="mb-3 max-w-[280px] text-2xl leading-snug font-medium">
          Automated vendor verification, start to finish.
        </p>
        <p className="max-w-[260px] text-[13px] text-on-primary/70">
          Submit your details once. We check your documents, verify your identity, and keep you
          posted at every step — with a real audit trail behind every decision.
        </p>
      </div>
      <p className="text-[11px] text-on-primary/50">Zamp · Vendor Onboarding</p>
    </div>
  );
}

// ─── Sign-in form ────────────────────────────────────────────────────────────

function SignInForm({ onSwitch }: { onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      <p className="mb-1 text-base font-medium">Welcome back</p>
      <p className="mb-6 text-[13px] text-text-secondary">
        Sign in to view or update your vendor profile.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field
          label="Email"
          type="email"
          placeholder="name@company.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          placeholder="••••••••"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-[12px] text-text-danger">{error}</p>}
        <Button type="submit" variant="primary" disabled={submitting} className="mt-1 w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-5 text-[12px] text-text-muted">
        New vendor?{" "}
        <button onClick={onSwitch} className="text-text-accent hover:underline">
          Create an account
        </button>
      </p>
    </div>
  );
}

// ─── Sign-up: step 1 — credentials ──────────────────────────────────────────

interface CredentialsFormProps {
  onCreated: (email: string, mobile: string) => void;
  onSwitch: () => void;
}

function CredentialsForm({ onCreated, onSwitch }: CredentialsFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { mobile } },
      });
      if (error) throw error;
      if (data.session || data.user) {
        sessionStorage.setItem("new_signup", "1");
        onCreated(email, mobile);
      } else {
        setError("Check your inbox to confirm your email, then sign in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      <p className="mb-1 text-base font-medium">Create your account</p>
      <p className="mb-6 text-[13px] text-text-secondary">
        Start with your login credentials. You'll fill in your company details next.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field
          label="Email"
          type="email"
          placeholder="name@company.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Mobile number"
          type="tel"
          placeholder="+91 98765 43210"
          required
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          placeholder="At least 6 characters"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-[12px] text-text-danger">{error}</p>}
        <Button type="submit" variant="primary" disabled={submitting} className="mt-1 w-full">
          {submitting ? "Creating account…" : "Continue"}
        </Button>
      </form>
      <p className="mt-5 text-[12px] text-text-muted">
        Already have an account?{" "}
        <button onClick={onSwitch} className="text-text-accent hover:underline">
          Sign in
        </button>
      </p>
    </div>
  );
}

// ─── Sign-up: step 2 — vendor onboarding form ────────────────────────────────

const RUN_STAGES: RunStage[] = [
  { key: "account", label: "Verifying your account" },
  { key: "documents", label: "Checking submitted documents" },
  { key: "extract", label: "Cross-checking details against your documents" },
  { key: "decide", label: "Applying decision rules" },
  { key: "notify", label: "Sending notification" },
];

interface SubmitResult {
  status: string;
  message?: string;
  reasoning?: string;
  issues?: { message: string }[];
}

interface VendorFormProps {
  accountEmail: string;
  accountMobile: string;
}

function VendorOnboardingForm({ accountEmail, accountMobile }: VendorFormProps) {
  const [docs, setDocs] = useState<Record<string, DocumentRef>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    mode: "onChange",
    defaultValues: { country: "IN", contact_email: accountEmail, contact_phone: accountMobile },
  });

  const country = watch("country");
  const requiredDocs = REQUIRED_DOCUMENTS[country] ?? [];
  const allDocsUploaded = requiredDocs.every((d) => docs[d.type]);

  async function handleFileChange(documentType: string, file: File | null) {
    if (!file) return;
    setUploading(documentType);
    setSubmitError(null);
    try {
      const ref = await uploadDocument(documentType, file);
      setDocs((prev) => ({ ...prev, [documentType]: ref }));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  function onSubmit(values: VendorFormValues) {
    setSubmitError(null);
    setPendingPayload({
      legal_name: values.legal_name,
      trading_name: values.trading_name || null,
      country: values.country,
      address: {
        street: values.street,
        city: values.city,
        region: values.region,
        postal_code: values.postal_code,
        country: values.country,
      },
      tax_id: values.tax_id,
      pan: values.country === "IN" ? values.pan : null,
      bank_name: values.bank_name,
      bank_account_holder_name: values.bank_account_holder_name,
      bank_account_number: values.bank_account_number,
      bank_routing_number: values.bank_routing_number,
      contact_name: values.contact_name,
      contact_email: values.contact_email,
      contact_phone: values.contact_phone || null,
      documents: Object.values(docs),
    });
  }

  const canSubmit = isValid && allDocsUploaded && !uploading;

  if (done) {
    return (
      <div className="w-full max-w-[560px] py-10 text-center">
        <p className="mb-2 text-base font-medium">You're all set</p>
        <p className="text-[13px] text-text-secondary">
          Your submission has been reviewed. You can now sign in any time to check your status or
          update your details.
        </p>
      </div>
    );
  }

  if (pendingPayload) {
    return (
      <div className="w-full max-w-[560px]">
        <p className="mb-1 text-base font-medium">Processing your submission</p>
        <p className="mb-6 text-[13px] text-text-secondary">
          Hang tight — we're extracting and cross-checking your documents now.
        </p>
        <LiveRunView<SubmitResult>
          stages={RUN_STAGES}
          run={() => api.post<SubmitResult>("/vendors/submit", pendingPayload)}
          onSettled={() => {}}
          renderResult={(result) => (
            <div>
              <p className="mb-1 text-sm font-medium">
                {result.status === "verification_pending"
                  ? "Confirmation email sent"
                  : `Status: ${result.status}`}
              </p>
              <p className="mb-3 text-[13px] text-text-secondary">
                {result.message ?? result.reasoning ?? ""}
              </p>
              {result.issues && result.issues.length > 0 && (
                <ul className="mb-3 list-disc pl-5 text-[13px] text-text-secondary">
                  {result.issues.map((issue, i) => (
                    <li key={i}>{issue.message}</li>
                  ))}
                </ul>
              )}
              <Button
                variant="primary"
                onClick={() => {
                  sessionStorage.removeItem("new_signup");
                  setDone(true);
                }}
              >
                Done
              </Button>
            </div>
          )}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[560px]">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-fill-primary text-[11px] font-medium text-on-primary">
          2
        </div>
        <div>
          <p className="text-base font-medium">Tell us about your company</p>
          <p className="text-[13px] text-text-secondary">
            Fields are validated as you type. Upload documents to enable submit.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Company details */}
        <section>
          <SectionLabel>Company details</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Legal company name"
              {...register("legal_name")}
              error={errors.legal_name?.message}
            />
            <Field
              label="Trading name (optional)"
              {...register("trading_name")}
              error={errors.trading_name?.message}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field
              label="Street address"
              {...register("street")}
              error={errors.street?.message}
            />
            <Field label="City" {...register("city")} error={errors.city?.message} />
            <Field label="State / region" {...register("region")} error={errors.region?.message} />
            <Field label="Postal code" {...register("postal_code")} error={errors.postal_code?.message} />
          </div>
        </section>

        {/* Tax identification */}
        <section>
          <SectionLabel>Tax identification</SectionLabel>
          <SelectField label="Country of registration" {...register("country")}>
            <option value="IN">India</option>
            <option value="US">United States</option>
            <option value="UK">United Kingdom</option>
          </SelectField>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field
              label={country === "US" ? "EIN" : country === "UK" ? "VAT number" : "GSTIN"}
              hint={TAX_ID_HINTS[country]}
              {...register("tax_id")}
              error={errors.tax_id?.message}
            />
            {country === "IN" && (
              <Field
                label="Company PAN"
                hint="Format: AAAAA9999A"
                {...register("pan")}
                error={errors.pan?.message}
              />
            )}
          </div>
        </section>

        {/* Bank details */}
        <section>
          <SectionLabel>Bank details</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank name" {...register("bank_name")} error={errors.bank_name?.message} />
            <Field
              label="Account holder name"
              {...register("bank_account_holder_name")}
              error={errors.bank_account_holder_name?.message}
            />
            <Field
              label="Account number / IBAN"
              {...register("bank_account_number")}
              error={errors.bank_account_number?.message}
            />
            <Field
              label="Routing / SWIFT-BIC"
              {...register("bank_routing_number")}
              error={errors.bank_routing_number?.message}
            />
          </div>
        </section>

        {/* Contact details */}
        <section>
          <SectionLabel>Contact details</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Primary contact name"
              {...register("contact_name")}
              error={errors.contact_name?.message}
            />
            <Field
              label="Contact email"
              type="email"
              {...register("contact_email")}
              error={errors.contact_email?.message}
            />
            <Field label="Phone (optional)" {...register("contact_phone")} />
          </div>
        </section>

        {/* Documents */}
        <section>
          <SectionLabel>Documents</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {requiredDocs.map((d) => {
              const isUploaded = !!docs[d.type];
              const isUploading = uploading === d.type;
              return (
                <label
                  key={d.type}
                  className={`cursor-pointer rounded-[var(--radius-control)] border border-dashed p-3.5 text-center transition-colors ${
                    isUploaded
                      ? "border-status-approved-border bg-status-approved-bg"
                      : "border-border-strong hover:bg-surface-1"
                  }`}
                >
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(d.type, e.target.files?.[0] ?? null)}
                  />
                  <p
                    className={`text-[11px] ${
                      isUploaded ? "text-text-success" : "text-text-muted"
                    }`}
                  >
                    {isUploading ? "Uploading…" : isUploaded ? "Uploaded ✓" : d.label}
                  </p>
                </label>
              );
            })}
          </div>
        </section>

        {submitError && <p className="text-[13px] text-text-danger">{submitError}</p>}

        <div className="flex items-center justify-between border-t border-border pt-4">
          {!canSubmit && (
            <p className="text-[12px] text-text-danger">
              {uploading
                ? "Uploading document…"
                : !allDocsUploaded
                ? "Upload all required documents to continue"
                : "Fix the flagged fields above"}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={!canSubmit} className="ml-auto">
            Submit for review
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Main AuthPage ────────────────────────────────────────────────────────────

type View = "signin" | "signup-step1" | "signup-step2";

export function AuthPage() {
  const [view, setView] = useState<View>("signin");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountMobile, setAccountMobile] = useState("");

  function handleAccountCreated(email: string, mobile: string) {
    setAccountEmail(email);
    setAccountMobile(mobile);
    setView("signup-step2");
  }

  const isWideForm = view === "signup-step2";

  return (
    <div className="flex min-h-screen">
      <BrandPanel />

      {/* Right panel — scrollable, wider when showing the full form */}
      <div
        className={`flex flex-1 justify-center overflow-y-auto ${
          isWideForm ? "items-start py-10 px-6" : "items-center p-6"
        }`}
      >
        {view === "signin" && (
          <SignInForm onSwitch={() => setView("signup-step1")} />
        )}

        {view === "signup-step1" && (
          <div className="w-full max-w-[400px]">
            {/* Step indicator */}
            <div className="mb-6 flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-fill-primary text-[11px] font-medium text-on-primary">
                  1
                </div>
                <span className="text-[12px] font-medium text-text-primary">Account</span>
              </div>
              <div className="h-px flex-1 bg-border" />
              <div className="flex items-center gap-1.5 opacity-40">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-[11px] text-text-muted">
                  2
                </div>
                <span className="text-[12px] text-text-muted">Company details</span>
              </div>
            </div>

            <CredentialsForm
              onCreated={handleAccountCreated}
              onSwitch={() => setView("signin")}
            />
          </div>
        )}

        {view === "signup-step2" && (
          <div className="w-full max-w-[560px]">
            {/* Step indicator */}
            <div className="mb-8 flex items-center gap-2">
              <div className="flex items-center gap-1.5 opacity-40">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-[11px] text-text-muted">
                  ✓
                </div>
                <span className="text-[12px] text-text-muted">Account created</span>
              </div>
              <div className="h-px flex-1 bg-border" />
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-fill-primary text-[11px] font-medium text-on-primary">
                  2
                </div>
                <span className="text-[12px] font-medium text-text-primary">Company details</span>
              </div>
            </div>

            <VendorOnboardingForm accountEmail={accountEmail} accountMobile={accountMobile} />
          </div>
        )}
      </div>
    </div>
  );
}
