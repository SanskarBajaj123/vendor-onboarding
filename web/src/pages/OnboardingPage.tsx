import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/Button";
import { Field, SectionLabel, SelectField } from "../components/ui/Field";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Shell } from "../components/ui/Shell";
import { LiveRunView, type RunStage } from "../components/ui/LiveRunView";
import { type VendorFormValues, vendorFormSchema, TAX_ID_HINTS } from "../lib/vendorSchema";
import { REQUIRED_DOCUMENTS, uploadDocument, type DocumentRef } from "../lib/documents";

interface VendorRecord {
  id: string;
  status: "draft" | "pending" | "approved" | "rejected";
  legal_name: string;
  trading_name: string | null;
  tax_id: string;
  tax_id_country: "US" | "UK" | "IN";
  pan: string | null;
  address: { street: string; city: string; region: string; postal_code: string; country: string };
  bank_name: string;
  bank_account_holder_name: string;
  bank_account_number: string;
  bank_routing_number: string;
  current_contact_email: string | null;
  original_email: string;
  contact_phone: string | null;
  latest_reasoning: { reasoning: string; issues: { message: string }[] } | null;
}

interface SubmitResult {
  status: string;
  message?: string;
  reasoning?: string;
  issues?: { message: string }[];
}

const RUN_STAGES: RunStage[] = [
  { key: "account", label: "Verifying your account & existing record", sub: "Session and profile confirmed" },
  { key: "documents", label: "Checking submitted documents are present", sub: "All required docs present and readable" },
  { key: "extract", label: "Cross-checking details against your documents", sub: "Gemini extracted and compared all fields" },
  { key: "decide", label: "Applying decision rules", sub: "Running decision engine" },
  { key: "notify", label: "Sending notification", sub: "Email dispatched to contact address" },
];

// ─── Hero card ───────────────────────────────────────────────────────────────

const HERO: Record<string, { gradient: string; icon: string; label: string }> = {
  approved: {
    gradient: "linear-gradient(135deg,#14532d 0%,#16a34a 100%)",
    icon: "✓", label: "Approved",
  },
  pending: {
    gradient: "linear-gradient(135deg,#78350f 0%,#d97706 100%)",
    icon: "⏳", label: "Pending review",
  },
  rejected: {
    gradient: "linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%)",
    icon: "✕", label: "Rejected",
  },
  draft: {
    gradient: "linear-gradient(135deg,#374151 0%,#6b7280 100%)",
    icon: "✏", label: "Draft",
  },
};

const COUNTRY_LABELS: Record<string, string> = { IN: "India", US: "United States", UK: "United Kingdom" };

function HeroCard({ record }: { record: VendorRecord }) {
  const h = HERO[record.status] ?? HERO.draft;
  return (
    <div style={{
      borderRadius: 14, background: h.gradient, color: "#fff",
      padding: "24px 28px", marginBottom: 18,
      display: "flex", alignItems: "center", gap: 20,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%",
        background: "rgba(255,255,255,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
      }}>{h.icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{record.legal_name}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.75 }}>
          {COUNTRY_LABELS[record.tax_id_country] ?? record.tax_id_country}
          {record.tax_id ? ` · ${record.tax_id}` : ""}
        </p>
      </div>
      <div style={{
        background: "rgba(255,255,255,0.2)", borderRadius: 20,
        padding: "5px 14px", fontSize: 12, fontWeight: 600,
      }}>{h.label}</div>
    </div>
  );
}

// ─── Verification progress tracker ───────────────────────────────────────────

const TRACKER_STEPS = ["Submitted", "Documents verified", "Onboarded"];

function VerificationProgress({ status }: { status: string }) {
  const activeIndex =
    status === "approved" ? 2 :
    status === "pending" ? 1 : 0;

  return (
    <div style={{
      borderRadius: 12, border: "1px solid #d8d4cb", background: "#fff",
      padding: "18px 24px", marginBottom: 18,
    }}>
      <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 600, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Verification progress
      </p>
      <div style={{ display: "flex", alignItems: "center" }}>
        {TRACKER_STEPS.map((step, i) => {
          const done = i <= activeIndex;
          const isLast = i === TRACKER_STEPS.length - 1;
          return (
            <div key={step} style={{ display: "flex", alignItems: "center", flex: isLast ? "none" : 1 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: done ? "#16a34a" : "#e8e4db",
                  border: `2px solid ${done ? "#16a34a" : "#c4bfb4"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, color: done ? "#fff" : "#888780", fontWeight: 700,
                }}>
                  {done ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 11, color: done ? "#14532d" : "#888780", fontWeight: done ? 600 : 400, whiteSpace: "nowrap" }}>
                  {step}
                </span>
              </div>
              {!isLast && (
                <div style={{
                  flex: 1, height: 2,
                  background: i < activeIndex ? "#16a34a" : "#d8d4cb",
                  margin: "0 8px", marginBottom: 22,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Alert card (issues to fix) ──────────────────────────────────────────────

function AlertCard({ record }: { record: VendorRecord }) {
  if (!record.latest_reasoning || record.status === "approved") return null;
  const { reasoning, issues } = record.latest_reasoning;
  const isRejected = record.status === "rejected";
  const borderColor = isRejected ? "#fca5a5" : "#fde68a";
  const bg = isRejected ? "#fef2f2" : "#fffbeb";
  const textColor = isRejected ? "#7f1d1d" : "#78350f";

  return (
    <div style={{
      borderRadius: 12, border: `1.5px solid ${borderColor}`,
      background: bg, padding: "16px 20px", marginBottom: 18,
    }}>
      <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: textColor }}>
        {isRejected ? "Submission rejected" : "One or more items need your attention"}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: textColor }}>{reasoning}</p>
      {issues && issues.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          {issues.map((iss, i) => (
            <li key={i} style={{ fontSize: 13, color: textColor }}>{iss.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function OnboardingPage() {
  const { session } = useAuth();
  const [existing, setExisting] = useState<VendorRecord | null | undefined>(undefined);
  const [docs, setDocs] = useState<Record<string, DocumentRef>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);

  const {
    register, handleSubmit, watch, reset,
    formState: { errors, isValid },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    mode: "onChange",
    defaultValues: { country: "IN", contact_email: session?.user.email ?? "" },
  });

  const country = watch("country");

  function loadExisting() {
    return api.get<VendorRecord | null>("/vendors/me").then((data) => {
      setExisting(data);
      if (data) {
        reset({
          legal_name: data.legal_name,
          trading_name: data.trading_name ?? "",
          country: data.tax_id_country,
          street: data.address?.street ?? "",
          city: data.address?.city ?? "",
          region: data.address?.region ?? "",
          postal_code: data.address?.postal_code ?? "",
          tax_id: data.tax_id,
          pan: data.pan ?? "",
          bank_name: data.bank_name,
          bank_account_holder_name: data.bank_account_holder_name,
          bank_account_number: data.bank_account_number,
          bank_routing_number: data.bank_routing_number,
          contact_name: data.current_contact_email ? data.legal_name : "",
          contact_email: data.current_contact_email ?? data.original_email,
          contact_phone: data.contact_phone ?? "",
        });
      }
      return data;
    });
  }

  useEffect(() => { loadExisting(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const requiredDocs = REQUIRED_DOCUMENTS[country] ?? [];
  const allDocsUploaded = requiredDocs.every((d) => docs[d.type]);

  async function handleFileChange(documentType: string, file: File | null) {
    if (!file) return;
    setUploading(documentType);
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

  if (existing === undefined) {
    return <Shell><p style={{ fontSize: 13, color: "#888780" }}>Loading…</p></Shell>;
  }

  const canSubmit = isValid && allDocsUploaded && !uploading;

  return (
    <Shell eyebrow="Vendor portal" title="Vendor onboarding"
      actions={existing && <StatusBadge status={existing.status} />}>

      {existing && <HeroCard record={existing} />}
      {existing && existing.status !== "draft" && <VerificationProgress status={existing.status} />}
      {existing && <AlertCard record={existing} />}

      {pendingPayload ? (
        <div style={{ borderRadius: 14, border: "1px solid #d8d4cb", background: "#fff", padding: 28 }}>
          <p style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 600 }}>Processing your submission</p>
          <LiveRunView<SubmitResult>
            stages={RUN_STAGES}
            run={() => api.post<SubmitResult>("/vendors/submit", pendingPayload)}
            onSettled={(result) => { if (result) loadExisting(); }}
            renderResult={(result) => (
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600 }}>
                  {result.status === "verification_pending" ? "Confirmation email sent" : "Submission complete"}
                </p>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "#5f5e5a" }}>
                  {result.message ?? result.reasoning ?? `New status: ${result.status}`}
                </p>
                {result.issues && result.issues.length > 0 && (
                  <ul style={{ margin: "0 0 14px", paddingLeft: 20 }}>
                    {result.issues.map((iss, i) => (
                      <li key={i} style={{ fontSize: 13, color: "#5f5e5a" }}>{iss.message}</li>
                    ))}
                  </ul>
                )}
                <Button onClick={() => setPendingPayload(null)}>Back to your record</Button>
              </div>
            )}
          />
        </div>
      ) : (
        <div style={{ borderRadius: 14, border: "1px solid #d8d4cb", background: "#fff", padding: 28 }}>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#5f5e5a" }}>
            Fields are checked as you type. Fix anything flagged before you can submit.
          </p>

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
                <Field label="Phone (optional)" {...register("contact_phone")} />
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
                      cursor: "pointer", borderRadius: 9,
                      border: `1.5px dashed ${isUploaded ? "#16a34a" : "#c4bfb4"}`,
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
                  {uploading ? "Uploading document…" : !allDocsUploaded ? "Upload all required documents to continue" : "Fix the flagged fields to continue"}
                </p>
              )}
              <Button type="submit" variant="primary" disabled={!canSubmit} className="ml-auto">
                Submit for review
              </Button>
            </div>
          </form>
        </div>
      )}
    </Shell>
  );
}
