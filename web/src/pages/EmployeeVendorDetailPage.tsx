import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Shell } from "../components/ui/Shell";

interface ExtractedDoc {
  legal_name?: string;
  address?: string;
  tax_id?: string;
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  [key: string]: string | undefined;
}

interface AuditEntry {
  id: string;
  actor_type: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  reason: string | null;
  created_at: string;
  metadata?: {
    issues?: { type: string; severity: string; message: string; field: string }[];
    extracted?: Record<string, ExtractedDoc>;
  } | null;
}

interface VendorDetail {
  vendor: {
    id: string;
    legal_name: string;
    trading_name: string | null;
    status: string;
    tax_id: string;
    tax_id_country: string;
    pan: string | null;
    ein: string | null;
    vat_number: string | null;
    gstin: string | null;
    address: { street: string; city: string; region: string; postal_code: string } | null;
    bank_name: string | null;
    bank_account_holder_name: string | null;
    bank_account_number: string | null;
    bank_routing_number: string | null;
    contact_name: string | null;
    original_email: string;
    current_contact_email: string | null;
    contact_phone: string | null;
    latest_reasoning: { reasoning: string; issues: { message: string }[] } | null;
  };
  audit_trail: AuditEntry[];
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <>
      <span style={{ fontSize: 12, color: "#888780" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#1a1a18", fontWeight: 500, wordBreak: "break-all" }}>{value}</span>
    </>
  );
}

const STATUSES = ["approved", "pending", "rejected"] as const;

export function EmployeeVendorDetailPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [detail, setDetail] = useState<VendorDetail | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<(typeof STATUSES)[number]>("approved");
  const [overrideReason, setOverrideReason] = useState("");
  const [flagNote, setFlagNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    if (!vendorId) return;
    api.get<VendorDetail>(`/employees/vendors/${vendorId}`).then(setDetail);
  }

  useEffect(load, [vendorId]);

  async function submitOverride() {
    if (!vendorId || !overrideReason.trim()) return;
    setBusy(true);
    try {
      await api.post(`/employees/vendors/${vendorId}/override`, {
        new_status: overrideStatus,
        reason: overrideReason,
      });
      setOverrideReason("");
      setNotice("Override applied and vendor notified.");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function submitFlag() {
    if (!vendorId || !flagNote.trim()) return;
    setBusy(true);
    try {
      await api.post("/employees/dev-feedback", { vendor_id: vendorId, note: flagNote });
      setFlagNote("");
      setNotice("Flagged for the dev team (internal only).");
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return (
    <Shell eyebrow="Employee view" title="Loading…" maxWidth="1060px">
      <p style={{ fontSize: 13, color: "#888780" }}>Loading vendor details…</p>
    </Shell>
  );

  const { vendor, audit_trail } = detail;

  return (
    <Shell
      eyebrow="Employee view"
      title={vendor.legal_name}
      actions={<StatusBadge status={vendor.status} />}
    >
      <Link to="/employee" className="text-[13px] text-text-accent hover:underline">
        ← Back to dashboard
      </Link>
      <p className="-mt-4 text-[13px] text-text-secondary">
        {vendor.tax_id_country} · {vendor.tax_id}
      </p>

      <Card>
        <p className="mb-3 text-[13px] font-medium">Submission details</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px" }}>
          <DetailRow label="Legal name" value={vendor.legal_name} />
          <DetailRow label="Trading name" value={vendor.trading_name} />
          <DetailRow label="Country" value={vendor.tax_id_country} />
          <DetailRow label="Address" value={vendor.address
            ? [vendor.address.street, vendor.address.city, vendor.address.region, vendor.address.postal_code].filter(Boolean).join(", ")
            : null} />
          {vendor.ein && <DetailRow label="EIN" value={vendor.ein} />}
          {vendor.vat_number && <DetailRow label="VAT number" value={vendor.vat_number} />}
          {vendor.gstin && <DetailRow label="GSTIN" value={vendor.gstin} />}
          {vendor.pan && <DetailRow label="PAN" value={vendor.pan} />}
          <DetailRow label="Bank name" value={vendor.bank_name} />
          <DetailRow label="Account holder" value={vendor.bank_account_holder_name} />
          <DetailRow label="Account number" value={vendor.bank_account_number} />
          <DetailRow label="Routing / SWIFT-BIC" value={vendor.bank_routing_number} />
          <DetailRow label="Contact name" value={vendor.contact_name} />
          <DetailRow label="Contact email" value={vendor.current_contact_email ?? vendor.original_email} />
          <DetailRow label="Phone" value={vendor.contact_phone} />
        </div>
      </Card>

      {vendor.latest_reasoning && (
        <Card>
          <p className="mb-1 text-[13px] font-medium">System reasoning</p>
          <p className="text-[13px] text-text-secondary">{vendor.latest_reasoning.reasoning}</p>
        </Card>
      )}

      {notice && <p className="text-[13px] text-text-success">{notice}</p>}

      <Card>
        <p className="mb-3 text-[13px] font-medium">Override status</p>
        <p className="mb-3 text-[12px] text-text-muted">
          Notifies the vendor and is logged to their audit trail.
        </p>
        <div className="flex flex-col gap-3">
          <select value={overrideStatus} onChange={(e) => setOverrideStatus(e.target.value as any)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Reason (required)"
            rows={2}
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
          <Button
            variant="primary"
            disabled={busy || !overrideReason.trim()}
            onClick={submitOverride}
            className="self-start"
          >
            Apply override
          </Button>
        </div>
      </Card>

      <Card>
        <p className="mb-3 text-[13px] font-medium">Flag process/logic issue</p>
        <p className="mb-3 text-[12px] text-text-muted">
          Internal dev feedback only — never shown to the vendor.
        </p>
        <div className="flex flex-col gap-3">
          <textarea
            placeholder="What's wrong with the automated logic here?"
            rows={2}
            value={flagNote}
            onChange={(e) => setFlagNote(e.target.value)}
          />
          <Button disabled={busy || !flagNote.trim()} onClick={submitFlag} className="self-start">
            Flag for dev team
          </Button>
        </div>
      </Card>

      <Card>
        <p className="mb-3 text-[13px] font-medium">Audit trail</p>
        <div className="flex flex-col gap-3">
          {audit_trail.map((entry) => (
            <div key={entry.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
              <p className="text-[12px] text-text-muted">
                {new Date(entry.created_at).toLocaleString()} · {entry.actor_type}
              </p>
              <p className="text-[13px]">
                {entry.action}
                {entry.previous_status && entry.new_status
                  ? ` (${entry.previous_status} → ${entry.new_status})`
                  : ""}
              </p>
              {entry.reason && <p className="text-[13px] text-text-secondary">{entry.reason}</p>}

              {/* Mistral extraction log — only on automated_decision entries */}
              {entry.action === "automated_decision" && entry.metadata?.extracted && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ fontSize: 12, color: "#6366f1", cursor: "pointer", fontWeight: 500, userSelect: "none" }}>
                    Mistral extraction log ({Object.keys(entry.metadata.extracted).length} documents)
                  </summary>
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                    {Object.entries(entry.metadata.extracted).map(([docType, fields]) => (
                      <div key={docType} style={{ background: "#f7f6f2", borderRadius: 8, padding: "10px 14px" }}>
                        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#888780" }}>
                          {docType.replace(/_/g, " ")}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {Object.entries(fields ?? {}).map(([k, v]) =>
                            v ? (
                              <div key={k} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                                <span style={{ color: "#888780", minWidth: 160 }}>{k.replace(/_/g, " ")}</span>
                                <span style={{ color: "#1a1a18", fontWeight: 500 }}>{v}</span>
                              </div>
                            ) : null
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      </Card>
    </Shell>
  );
}
