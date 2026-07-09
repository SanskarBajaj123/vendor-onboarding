import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Field, SectionLabel, SelectField } from "../components/ui/Field";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Shell } from "../components/ui/Shell";
import { LiveRunView, type RunStage } from "../components/ui/LiveRunView";
import { type VendorFormValues, vendorFormSchema } from "../lib/vendorSchema";
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
  { key: "account", label: "Verifying your account & existing record" },
  { key: "documents", label: "Checking submitted documents are present" },
  { key: "extract", label: "Cross-checking details against your documents" },
  { key: "decide", label: "Applying decision rules" },
  { key: "notify", label: "Sending notification" },
];

export function OnboardingPage() {
  const { session } = useAuth();
  const [existing, setExisting] = useState<VendorRecord | null | undefined>(undefined);
  const [docs, setDocs] = useState<Record<string, DocumentRef>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    mode: "onChange",
    defaultValues: {
      country: "IN",
      contact_email: session?.user.email ?? "",
    },
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

  useEffect(() => {
    loadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (existing === undefined) {
    return (
      <Shell>
        <p className="text-sm text-text-secondary">Loading…</p>
      </Shell>
    );
  }

  const canSubmit = isValid && allDocsUploaded;

  return (
    <Shell
      eyebrow="Vendor portal"
      title="Vendor onboarding"
      actions={existing && <StatusBadge status={existing.status} />}
    >
      {existing?.latest_reasoning && existing.status !== "approved" && !pendingPayload && (
        <Card className="border-status-pending-border bg-status-pending-bg">
          <p className="text-[13px] font-medium text-status-pending-text">What to fix</p>
          <p className="mt-1 text-[13px] text-status-pending-text">
            {existing.latest_reasoning.reasoning}
          </p>
        </Card>
      )}

      {pendingPayload ? (
        <Card>
          <p className="mb-4 text-sm font-medium">Processing your submission</p>
          <LiveRunView<SubmitResult>
            stages={RUN_STAGES}
            run={() => api.post<SubmitResult>("/vendors/submit", pendingPayload)}
            onSettled={(result) => {
              if (result) loadExisting();
            }}
            renderResult={(result) => (
              <div>
                <p className="mb-1 text-sm font-medium">
                  {result.status === "verification_pending"
                    ? "Confirmation email sent"
                    : "Submission complete"}
                </p>
                <p className="mb-3 text-[13px] text-text-secondary">
                  {result.message ?? result.reasoning ?? `New status: ${result.status}`}
                </p>
                {result.issues && result.issues.length > 0 && (
                  <ul className="mb-3 list-disc pl-5 text-[13px] text-text-secondary">
                    {result.issues.map((issue, i) => (
                      <li key={i}>{issue.message}</li>
                    ))}
                  </ul>
                )}
                <Button onClick={() => setPendingPayload(null)}>Back to your record</Button>
              </div>
            )}
          />
        </Card>
      ) : (
        <Card>
          <p className="mb-1 text-[13px] text-text-secondary">
            Fields are checked as you type. Fix anything flagged before you can submit.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-6">
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
                <Field
                  label="State / region"
                  {...register("region")}
                  error={errors.region?.message}
                />
                <Field
                  label="Postal code"
                  {...register("postal_code")}
                  error={errors.postal_code?.message}
                />
              </div>
            </section>

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
                  {...register("tax_id")}
                  error={errors.tax_id?.message}
                />
                {country === "IN" && (
                  <Field label="Company PAN" {...register("pan")} error={errors.pan?.message} />
                )}
              </div>
            </section>

            <section>
              <SectionLabel>Bank details</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Bank name"
                  {...register("bank_name")}
                  error={errors.bank_name?.message}
                />
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
                <Field
                  label="Phone (optional)"
                  {...register("contact_phone")}
                  error={errors.contact_phone?.message}
                />
              </div>
            </section>

            <section>
              <SectionLabel>Documents</SectionLabel>
              <div className="grid grid-cols-3 gap-2.5">
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
                  {!allDocsUploaded
                    ? "Upload all required documents to continue"
                    : "Fix the flagged fields to continue"}
                </p>
              )}
              <Button type="submit" variant="primary" disabled={!canSubmit} className="ml-auto">
                Submit for review
              </Button>
            </div>
          </form>
        </Card>
      )}
    </Shell>
  );
}
