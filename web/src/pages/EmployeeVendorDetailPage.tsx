import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Shell } from "../components/ui/Shell";

interface AuditEntry {
  id: string;
  actor_type: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  reason: string | null;
  created_at: string;
}

interface VendorDetail {
  vendor: {
    id: string;
    legal_name: string;
    status: string;
    tax_id: string;
    tax_id_country: string;
    latest_reasoning: { reasoning: string; issues: { message: string }[] } | null;
    original_email: string;
    current_contact_email: string | null;
  };
  audit_trail: AuditEntry[];
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

  if (!detail) return <div className="p-10 text-sm text-text-secondary">Loading…</div>;

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
            </div>
          ))}
        </div>
      </Card>
    </Shell>
  );
}
