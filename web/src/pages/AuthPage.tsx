import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import { Field, SelectField, SectionLabel } from "../components/ui/Field";
import { LiveRunView, type RunStage } from "../components/ui/LiveRunView";
import { type VendorFormValues, vendorFormSchema, TAX_ID_HINTS } from "../lib/vendorSchema";
import { REQUIRED_DOCUMENTS, uploadDocument, type DocumentRef } from "../lib/documents";

// ─── Left brand panel (sign-in only) ────────────────────────────────────────

const STEPS = [
  { num: 1, color: "#2563eb", label: "Submit details", sub: "Company, tax ID, bank info" },
  { num: 2, color: "#7c3aed", label: "Document check", sub: "Mistral extracts and cross-checks" },
  { num: 3, color: "#059669", label: "Automated decision", sub: "Approved, pending, or rejected" },
  { num: 4, color: "#d97706", label: "Notification sent", sub: "Email with status and next steps" },
];

function BrandPanel() {
  return (
    <div style={{
      width: 380, flexShrink: 0,
      background: "#0f1b2e",
      display: "flex", flexDirection: "column",
      padding: "40px 36px",
      position: "relative", overflow: "hidden",
    }}>
      {/* Decorative blob */}
      <div style={{
        position: "absolute", bottom: -80, left: -80,
        width: 320, height: 320, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M4 12l6 6L20 6" stroke="#0f1b2e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>Vendor Onboarding</span>
      </div>

      {/* Hero text */}
      <div style={{ flex: 1 }}>
        <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 700, lineHeight: 1.25, margin: "0 0 16px" }}>
          Automated vendor verification, start to finish.
        </h2>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.6, margin: "0 0 40px" }}>
          Submit your details once. We check your documents, verify your identity, and keep you posted at every step.
        </p>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {STEPS.map((s) => (
            <div key={s.num} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: s.color, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "#fff",
              }}>{s.num}</div>
              <div>
                <p style={{ margin: 0, color: "#fff", fontSize: 13, fontWeight: 600 }}>{s.label}</p>
                <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 40 }}>
        Vendor Onboarding Platform
      </p>
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
    // Clear any stale signup flag so Root() doesn't trap the user on AuthPage
    sessionStorage.removeItem("new_signup");
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
    <div style={{ width: "100%", maxWidth: 420 }}>
      {/* Segmented control */}
      <div style={{
        display: "flex", background: "#e8e4db", borderRadius: 10, padding: 4,
        marginBottom: 32,
      }}>
        <button style={{
          flex: 1, height: 36, borderRadius: 7, border: "none", cursor: "pointer",
          background: "#1a1a18", color: "#fff", fontSize: 13, fontWeight: 600,
        }}>Sign in</button>
        <button onClick={onSwitch} style={{
          flex: 1, height: 36, borderRadius: 7, border: "none", cursor: "pointer",
          background: "transparent", color: "#5f5e5a", fontSize: 13, fontWeight: 500,
        }}>Create account</button>
      </div>

      <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>Welcome back</h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "#5f5e5a" }}>
        Sign in to view or update your vendor profile.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Email" type="email" placeholder="name@company.com" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" placeholder="••••••••" required
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p style={{ margin: 0, fontSize: 12, color: "#a32d2d" }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{
          height: 44, borderRadius: 10, border: "none", cursor: submitting ? "not-allowed" : "pointer",
          background: submitting ? "#ccc" : "#1a1a18", color: "#fff",
          fontSize: 14, fontWeight: 600, marginTop: 4,
        }}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p style={{ marginTop: 20, fontSize: 12, color: "#888780", textAlign: "center" }}>
        New vendor?{" "}
        <button onClick={onSwitch} style={{ background: "none", border: "none", cursor: "pointer", color: "#185fa5", fontWeight: 500, fontSize: 12 }}>
          Create an account
        </button>
      </p>
    </div>
  );
}

// ─── Country dial-code picker data ───────────────────────────────────────────

interface DialCountry {
  code: string;   // ISO-2
  name: string;
  dial: string;   // e.g. "+91"
  flag: string;   // emoji
  search: string; // lowercase search tokens
}

const DIAL_COUNTRIES: DialCountry[] = [
  { code: "IN", name: "India",          dial: "+91",  flag: "🇮🇳", search: "india ind in" },
  { code: "US", name: "United States",  dial: "+1",   flag: "🇺🇸", search: "united states usa us america" },
  { code: "GB", name: "United Kingdom", dial: "+44",  flag: "🇬🇧", search: "united kingdom uk gb britain england" },
  { code: "AU", name: "Australia",      dial: "+61",  flag: "🇦🇺", search: "australia aus" },
  { code: "CA", name: "Canada",         dial: "+1",   flag: "🇨🇦", search: "canada can" },
  { code: "SG", name: "Singapore",      dial: "+65",  flag: "🇸🇬", search: "singapore sgp sg" },
  { code: "AE", name: "UAE",            dial: "+971", flag: "🇦🇪", search: "uae united arab emirates dubai" },
  { code: "DE", name: "Germany",        dial: "+49",  flag: "🇩🇪", search: "germany deu de deutschland" },
  { code: "FR", name: "France",         dial: "+33",  flag: "🇫🇷", search: "france fra fr" },
  { code: "JP", name: "Japan",          dial: "+81",  flag: "🇯🇵", search: "japan jpn jp" },
  { code: "CN", name: "China",          dial: "+86",  flag: "🇨🇳", search: "china chn cn" },
  { code: "BR", name: "Brazil",         dial: "+55",  flag: "🇧🇷", search: "brazil bra br brasil" },
  { code: "ZA", name: "South Africa",   dial: "+27",  flag: "🇿🇦", search: "south africa zaf za" },
  { code: "NG", name: "Nigeria",        dial: "+234", flag: "🇳🇬", search: "nigeria nga ng" },
  { code: "KE", name: "Kenya",          dial: "+254", flag: "🇰🇪", search: "kenya ken ke" },
  { code: "MX", name: "Mexico",         dial: "+52",  flag: "🇲🇽", search: "mexico mex mx" },
  { code: "ID", name: "Indonesia",      dial: "+62",  flag: "🇮🇩", search: "indonesia idn id" },
  { code: "PK", name: "Pakistan",       dial: "+92",  flag: "🇵🇰", search: "pakistan pak pk" },
  { code: "BD", name: "Bangladesh",     dial: "+880", flag: "🇧🇩", search: "bangladesh bgd bd" },
  { code: "NL", name: "Netherlands",    dial: "+31",  flag: "🇳🇱", search: "netherlands nld nl holland" },
];

// ─── Phone input with country picker ─────────────────────────────────────────

function PhoneInput({
  onChange,
  onValidChange,
}: {
  onChange: (full: string) => void;
  onValidChange?: (valid: boolean) => void;
}) {
  const [selectedCountry, setSelectedCountry] = useState<DialCountry>(
    DIAL_COUNTRIES.find((c) => c.code === "IN")!
  );
  const [localNumber, setLocalNumber] = useState("");
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isValid = localNumber.length === 10;
  const showError = touched && !isValid;

  const updateFull = (country: DialCountry, num: string) => {
    onChange(num);
    onValidChange?.(num.length === 10);
  };

  const filtered = query.trim()
    ? DIAL_COUNTRIES.filter((c) =>
        c.search.includes(query.toLowerCase()) ||
        c.dial.includes(query) ||
        c.name.toLowerCase().includes(query.toLowerCase())
      )
    : DIAL_COUNTRIES;

  function selectCountry(c: DialCountry) {
    setSelectedCountry(c);
    setOpen(false);
    setQuery("");
    updateFull(c, localNumber);
  }

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
    setLocalNumber(raw);
    updateFull(selectedCountry, raw);
  }

  function handleBlur() {
    setTouched(true);
  }

  return (
    <div>
      <label style={{ display: "block", marginBottom: 4, fontSize: 12, color: "#5f5e5a" }}>
        Mobile number *
      </label>
      <div style={{ display: "flex", gap: 0, position: "relative" }}>
        {/* Country trigger */}
        <button type="button" onClick={() => setOpen((o) => !o)} style={{
          display: "flex", alignItems: "center", gap: 6,
          height: 40, padding: "0 10px",
          background: "#fff", border: "1.5px solid #d8d4cb",
          borderRight: "none",
          borderRadius: "9px 0 0 9px",
          cursor: "pointer", flexShrink: 0, minWidth: 88,
          fontSize: 13, fontWeight: 500,
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{selectedCountry.flag}</span>
          <span style={{ color: "#5f5e5a" }}>{selectedCountry.dial}</span>
          <span style={{ marginLeft: "auto", color: "#888780", fontSize: 10 }}>▾</span>
        </button>

        {/* Number input */}
        <input
          type="tel"
          inputMode="numeric"
          placeholder="10-digit number"
          value={localNumber}
          onChange={handleNumberChange}
          onBlur={handleBlur}
          required
          style={{
            flex: 1, height: 40, padding: "0 12px",
            background: "#fff",
            border: `1.5px solid ${showError ? "#dc2626" : "#d8d4cb"}`,
            borderRadius: "0 9px 9px 0",
            fontSize: 13, boxSizing: "border-box", color: "#1a1a18",
          }}
        />

        {/* Dropdown */}
        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0,
            width: 280, zIndex: 999,
            background: "#fff", border: "1.5px solid #d8d4cb",
            borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}>
            {/* Search box */}
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #e8e4db" }}>
              <input
                autoFocus
                type="text"
                placeholder='Search (e.g. "IND", "+91", "India")'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: "100%", height: 34, padding: "0 10px",
                  border: "1.5px solid #d8d4cb", borderRadius: 7,
                  fontSize: 12, boxSizing: "border-box", color: "#1a1a18",
                  background: "#faf9f6",
                }}
              />
            </div>

            {/* Results */}
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {filtered.length === 0 && (
                <p style={{ padding: "12px 14px", margin: 0, fontSize: 12, color: "#888780" }}>
                  No countries found.
                </p>
              )}
              {filtered.map((c) => (
                <button key={c.code} type="button" onClick={() => selectCountry(c)} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "9px 14px", border: "none",
                  background: c.code === selectedCountry.code ? "#f0f7ff" : "transparent",
                  cursor: "pointer", textAlign: "left",
                }}
                  onMouseEnter={(e) => { if (c.code !== selectedCountry.code) e.currentTarget.style.background = "#faf9f6"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = c.code === selectedCountry.code ? "#f0f7ff" : "transparent"; }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{c.flag}</span>
                  <span style={{ flex: 1, fontSize: 13, color: "#1a1a18" }}>{c.name}</span>
                  <span style={{ fontSize: 12, color: "#888780", flexShrink: 0 }}>{c.dial}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Dismiss overlay */}
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => { setOpen(false); setQuery(""); }} />
      )}
      {showError && (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#dc2626" }}>
          Enter exactly 10 digits
        </p>
      )}
    </div>
  );
}

// ─── Sign-up step 1: credentials ────────────────────────────────────────────

interface CredentialsFormProps {
  onCreated: (email: string, mobile: string) => void;
  onSwitch: () => void;
}

function CredentialsForm({ onCreated, onSwitch }: CredentialsFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error, data } = await supabase.auth.signUp({
        email, password,
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
    <div style={{ width: "100%", maxWidth: 420 }}>
      {/* Segmented control */}
      <div style={{
        display: "flex", background: "#e8e4db", borderRadius: 10, padding: 4,
        marginBottom: 32,
      }}>
        <button onClick={onSwitch} style={{
          flex: 1, height: 36, borderRadius: 7, border: "none", cursor: "pointer",
          background: "transparent", color: "#5f5e5a", fontSize: 13, fontWeight: 500,
        }}>Sign in</button>
        <button style={{
          flex: 1, height: 36, borderRadius: 7, border: "none", cursor: "pointer",
          background: "#1a1a18", color: "#fff", fontSize: 13, fontWeight: 600,
        }}>Create account</button>
      </div>

      <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>Create your account</h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "#5f5e5a" }}>
        Start with your login credentials. You'll fill in your company details next.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Email ID *" type="email" placeholder="name@company.com" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <PhoneInput onChange={setMobile} onValidChange={setPhoneValid} />
        <Field label="Password *" type="password" placeholder="At least 6 characters" required minLength={6}
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p style={{ margin: 0, fontSize: 12, color: "#a32d2d" }}>{error}</p>}
        <button type="submit" disabled={submitting || !phoneValid} style={{
          height: 44, borderRadius: 10, border: "none",
          cursor: (submitting || !phoneValid) ? "not-allowed" : "pointer",
          background: (submitting || !phoneValid) ? "#ccc" : "#1a1a18", color: "#fff",
          fontSize: 14, fontWeight: 600, marginTop: 4,
        }}>
          {submitting ? "Creating account…" : "Continue"}
        </button>
      </form>
    </div>
  );
}

// ─── Sign-up step 2: vendor form ─────────────────────────────────────────────

const RUN_STAGES: RunStage[] = [
  { key: "account", label: "Verifying your account", sub: "Session and profile confirmed" },
  { key: "documents", label: "Checking submitted documents", sub: "All required docs present and readable" },
  { key: "extract", label: "Cross-checking details against documents", sub: "Mistral extracted and compared all fields" },
  { key: "decide", label: "Applying decision rules", sub: "Running decision engine" },
  { key: "notify", label: "Notification sent", sub: "Email dispatched to contact address" },
];

interface SubmitResult {
  status: string;
  message?: string;
  reasoning?: string;
  issues?: { message: string }[];
}

async function signOutAndReturn() {
  sessionStorage.removeItem("new_signup");
  await supabase.auth.signOut({ scope: "local" });
  window.location.replace("/");
}

function VendorOnboardingForm({ accountEmail, accountMobile }: { accountEmail: string; accountMobile: string }) {
  const [docs, setDocs] = useState<Record<string, DocumentRef>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);

  const {
    register, handleSubmit, watch,
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
      address: { street: values.street, city: values.city, region: values.region, postal_code: values.postal_code, country: values.country },
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

  if (pendingPayload) {
    return (
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Processing your submission</h2>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#5f5e5a" }}>
          Hang tight — we're extracting and cross-checking your documents now.
        </p>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #d8d4cb", padding: 24 }}>
          <LiveRunView<SubmitResult>
            stages={RUN_STAGES}
            run={() => api.post<SubmitResult>("/vendors/submit", pendingPayload)}
            onSettled={() => {}}
            renderResult={(result) => (
              <div>
                <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                  {result.status === "verification_pending" ? "Confirmation email sent" : `Status: ${result.status}`}
                </p>
                <p style={{ fontSize: 13, color: "#5f5e5a", marginBottom: 12 }}>
                  {result.message ?? result.reasoning ?? ""}
                </p>
                {result.issues && result.issues.length > 0 && (
                  <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
                    {result.issues.map((issue, i) => (
                      <li key={i} style={{ fontSize: 13, color: "#5f5e5a" }}>{issue.message}</li>
                    ))}
                  </ul>
                )}
                <button onClick={signOutAndReturn} style={{
                  height: 40, borderRadius: 9, border: "none", cursor: "pointer",
                  background: "#1a1a18", color: "#fff", fontSize: 13, fontWeight: 600, padding: "0 20px",
                }}>Done — go to sign in</button>
              </div>
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Progress bar + sign-out */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.5 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 12l6 6L20 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <span style={{ fontSize: 12, color: "#5f5e5a" }}>Account created</span>
        </div>
        <div style={{ flex: 1, height: 2, background: "#c4bfb4" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#1a1a18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>2</div>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Company details</span>
        </div>
        <button
          type="button"
          onClick={signOutAndReturn}
          style={{
            marginLeft: 8, height: 32, padding: "0 14px", borderRadius: 7,
            border: "1.5px solid #d8d4cb", background: "transparent",
            fontSize: 12, color: "#5f5e5a", cursor: "pointer", fontWeight: 500,
          }}
        >
          Sign out
        </button>
      </div>

      <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Tell us about your company</h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#5f5e5a" }}>
        Fields are validated as you type. Upload all required documents to enable submit.
      </p>

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #d8d4cb", padding: 28 }}>
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <section>
            <SectionLabel>Company details</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Legal company name *" {...register("legal_name")} error={errors.legal_name?.message} />
              <Field label="Trading name (optional)" {...register("trading_name")} error={errors.trading_name?.message} />
              <Field label="Street address *" {...register("street")} error={errors.street?.message} />
              <Field label="City *" {...register("city")} error={errors.city?.message} />
              <Field label="State / region *" {...register("region")} error={errors.region?.message} />
              <Field label="Postal code *" {...register("postal_code")} error={errors.postal_code?.message} />
            </div>
          </section>

          <section>
            <SectionLabel>Tax identification</SectionLabel>
            <SelectField label="Country of registration *" {...register("country")}>
              <option value="IN">India</option>
              <option value="US">United States</option>
              <option value="UK">United Kingdom</option>
            </SelectField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <Field
                label={`${country === "US" ? "EIN" : country === "UK" ? "VAT number" : "GSTIN"} *`}
                hint={TAX_ID_HINTS[country]}
                {...register("tax_id")}
                error={errors.tax_id?.message}
              />
              {country === "IN" && (
                <Field label="Company PAN *" hint="Format: AAAAA9999A" {...register("pan")} error={errors.pan?.message} />
              )}
            </div>
          </section>

          <section>
            <SectionLabel>Bank details</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Bank name *" {...register("bank_name")} error={errors.bank_name?.message} />
              <Field label="Account holder name *" {...register("bank_account_holder_name")} error={errors.bank_account_holder_name?.message} />
              <Field label="Account number / IBAN *" {...register("bank_account_number")} error={errors.bank_account_number?.message} />
              <Field label="Routing / SWIFT-BIC *" {...register("bank_routing_number")} error={errors.bank_routing_number?.message} />
            </div>
          </section>

          <section>
            <SectionLabel>Contact details</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Primary contact name *" {...register("contact_name")} error={errors.contact_name?.message} />
              <Field label="Contact email *" type="email" {...register("contact_email")} error={errors.contact_email?.message} />
              <Field
                label="Phone (10 digits) *"
                {...register("contact_phone")}
                error={errors.contact_phone?.message}
                hint="Auto-filled from account creation"
              />
            </div>
          </section>

          <section>
            <SectionLabel>Documents</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {requiredDocs.map((d) => {
                const isUploaded = !!docs[d.type];
                const isUploading = uploading === d.type;
                return (
                  <label key={d.type} style={{
                    cursor: "pointer", borderRadius: 9, border: `1.5px dashed ${isUploaded ? "#16a34a" : "#c4bfb4"}`,
                    padding: "14px 12px", textAlign: "center",
                    background: isUploaded ? "#f0fdf4" : "#faf9f6",
                  }}>
                    <input type="file" accept="application/pdf,image/*" style={{ display: "none" }}
                      onChange={(e) => handleFileChange(d.type, e.target.files?.[0] ?? null)} />
                    <p style={{ fontSize: 11, margin: 0, color: isUploaded ? "#14532d" : "#888780" }}>
                      {isUploading ? "Uploading…" : isUploaded ? "Uploaded ✓" : d.label}
                    </p>
                  </label>
                );
              })}
            </div>
          </section>

          {submitError && <p style={{ fontSize: 13, color: "#a32d2d", margin: 0 }}>{submitError}</p>}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #d8d4cb", paddingTop: 16 }}>
            {!canSubmit && (
              <p style={{ fontSize: 12, color: "#a32d2d", margin: 0 }}>
                {uploading ? "Uploading document…" : !allDocsUploaded ? "Upload all required documents to continue" : "Fix the flagged fields above"}
              </p>
            )}
            <button type="submit" disabled={!canSubmit} style={{
              marginLeft: "auto", height: 42, borderRadius: 9, border: "none",
              cursor: canSubmit ? "pointer" : "not-allowed",
              background: canSubmit ? "#1a1a18" : "#ececea", color: canSubmit ? "#fff" : "#b4b2a9",
              fontSize: 13, fontWeight: 600, padding: "0 24px",
            }}>
              Submit for review
            </button>
          </div>
        </form>
      </div>
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

  const showBrandPanel = view === "signin" || view === "signup-step1";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {showBrandPanel && <BrandPanel />}

      <div style={{
        flex: 1, display: "flex",
        justifyContent: "center",
        alignItems: view === "signup-step2" ? "flex-start" : "center",
        padding: view === "signup-step2" ? "48px 40px" : "40px 32px",
        overflowY: "auto",
        background: "#e8e4db",
      }}>
        <div style={{ width: "100%", maxWidth: view === "signup-step2" ? 700 : 420 }}>
          {view === "signin" && <SignInForm onSwitch={() => setView("signup-step1")} />}
          {view === "signup-step1" && <CredentialsForm onCreated={handleAccountCreated} onSwitch={() => setView("signin")} />}
          {view === "signup-step2" && <VendorOnboardingForm accountEmail={accountEmail} accountMobile={accountMobile} />}
        </div>
      </div>
    </div>
  );
}
