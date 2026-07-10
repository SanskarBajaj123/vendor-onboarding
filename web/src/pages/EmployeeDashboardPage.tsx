import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Shell } from "../components/ui/Shell";

interface VendorRow {
  id: string;
  legal_name: string | null;
  tax_id_country: string | null;
  status: string;
  updated_at: string;
  latest_reasoning: { reasoning: string } | null;
  email?: string;
}

const COUNTRY_FLAGS: Record<string, string> = { IN: "🇮🇳", US: "🇺🇸", UK: "🇬🇧" };

function GradientTile({ label, value, gradient, shadow }: {
  label: string; value: number; gradient: string; shadow: string;
}) {
  return (
    <div style={{ borderRadius: 14, background: gradient, color: "#fff", padding: "20px 22px", boxShadow: shadow, flex: 1 }}>
      <p style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>{value}</p>
      <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.75 }}>{label}</p>
    </div>
  );
}

// ─── Donut chart (status breakdown) ─────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  approved: "#16a34a",
  pending: "#d97706",
  rejected: "#dc2626",
  draft: "#888780",
  registered: "#6366f1",
};

function DonutChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  if (total === 0) {
    return (
      <svg viewBox="0 0 100 100" width={120} height={120}>
        <circle cx="50" cy="50" r="38" fill="none" stroke="#e8e4db" strokeWidth="16" />
      </svg>
    );
  }

  const r = 38;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const segments = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([key, v]) => {
      const frac = v / total;
      const dash = frac * circ;
      const seg = { key, dash, offset };
      offset += dash;
      return seg;
    });

  return (
    <svg viewBox="0 0 100 100" width={120} height={120} style={{ transform: "rotate(-90deg)" }}>
      {segments.map(({ key, dash, offset: off }) => (
        <circle key={key} cx="50" cy="50" r={r}
          fill="none"
          stroke={STATUS_COLORS[key] ?? "#888780"}
          strokeWidth="16"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={-off}
        />
      ))}
    </svg>
  );
}

// ─── Country bar chart ───────────────────────────────────────────────────────

function CountryBars({ data }: { data: Record<string, number> }) {
  const max = Math.max(...Object.values(data), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Object.entries(data).map(([country, count]) => (
        <div key={country} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 28, fontSize: 13 }}>{COUNTRY_FLAGS[country] ?? "🌍"}</span>
          <span style={{ width: 24, fontSize: 12, color: "#888780" }}>{country}</span>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#e8e4db" }}>
            <div style={{
              width: `${(count / max) * 100}%`, height: "100%", borderRadius: 4,
              background: "linear-gradient(90deg,#2563eb,#16a34a)",
              transition: "width 0.5s",
            }} />
          </div>
          <span style={{ width: 20, fontSize: 12, fontWeight: 600, color: "#1a1a18", textAlign: "right" }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function EmployeeDashboardPage() {
  const [vendors, setVendors] = useState<VendorRow[] | null>(null);

  useEffect(() => {
    api.get<VendorRow[]>("/employees/vendors").then(setVendors);
  }, []);

  const stats = useMemo(() => {
    const counts = { approved: 0, pending: 0, rejected: 0, draft: 0, registered: 0 };
    for (const v of vendors ?? []) {
      const k = v.status as keyof typeof counts;
      if (k in counts) counts[k]++;
    }
    return counts;
  }, [vendors]);

  const byCountry = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of vendors ?? []) {
      if (v.tax_id_country && v.status === "approved") {
        c[v.tax_id_country] = (c[v.tax_id_country] ?? 0) + 1;
      }
    }
    return c;
  }, [vendors]);

  const statusBreakdown = useMemo(() => {
    const s: Record<string, number> = {};
    for (const v of vendors ?? []) {
      s[v.status] = (s[v.status] ?? 0) + 1;
    }
    return s;
  }, [vendors]);

  return (
    <Shell eyebrow="Employee view" title="Vendor submissions" maxWidth="1060px">
      {/* Stat tiles */}
      <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
        <GradientTile label="Total vendors" value={vendors?.length ?? 0}
          gradient="linear-gradient(135deg,#1a3a5c,#2563eb)" shadow="0 4px 18px rgba(37,99,235,0.22)" />
        <GradientTile label="Approved" value={stats.approved}
          gradient="linear-gradient(135deg,#14532d,#16a34a)" shadow="0 4px 18px rgba(22,163,74,0.22)" />
        <GradientTile label="Pending review" value={stats.pending}
          gradient="linear-gradient(135deg,#78350f,#d97706)" shadow="0 4px 18px rgba(217,119,6,0.22)" />
        <GradientTile label="Rejected" value={stats.rejected}
          gradient="linear-gradient(135deg,#7f1d1d,#dc2626)" shadow="0 4px 18px rgba(220,38,38,0.22)" />
      </div>

      {/* Charts row */}
      <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
        {/* Approvals by country */}
        <div style={{ flex: 1, borderRadius: 14, border: "1px solid #d8d4cb", background: "#fff", padding: "20px 24px" }}>
          <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600 }}>Approvals by country</p>
          {Object.keys(byCountry).length > 0 ? (
            <CountryBars data={byCountry} />
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: "#888780" }}>No approved vendors yet.</p>
          )}
        </div>

        {/* Status breakdown */}
        <div style={{ width: 260, borderRadius: 14, border: "1px solid #d8d4cb", background: "#fff", padding: "20px 24px" }}>
          <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600 }}>Status breakdown</p>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <DonutChart data={statusBreakdown} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(statusBreakdown).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[k] ?? "#888780", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#5f5e5a", textTransform: "capitalize" }}>{k}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, marginLeft: "auto" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 14, border: "1px solid #d8d4cb", background: "#fff", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f7f6f2", borderBottom: "1px solid #e0ddd6" }}>
              {["Legal name", "Country", "Status", "System reasoning", "Updated"].map((h) => (
                <th key={h} style={{ padding: "12px 18px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "#888780", textAlign: "left" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendors?.map((v) => (
              <tr key={v.id} style={{ borderBottom: "1px solid #f0ede6", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#faf9f6")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                <td style={{ padding: "13px 18px" }}>
                  {v.status === "registered" ? (
                    <span style={{ color: "#888780", fontSize: 13 }}>{v.email ?? "—"}</span>
                  ) : (
                    <Link to={`/employee/${v.id}`} style={{ color: "#185fa5", fontWeight: 500, textDecoration: "none" }}>
                      {v.legal_name}
                    </Link>
                  )}
                </td>
                <td style={{ padding: "13px 18px" }}>
                  {v.tax_id_country ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f0ede6", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 500 }}>
                      {COUNTRY_FLAGS[v.tax_id_country] ?? ""} {v.tax_id_country}
                    </span>
                  ) : (
                    <span style={{ color: "#888780", fontSize: 12 }}>—</span>
                  )}
                </td>
                <td style={{ padding: "13px 18px" }}><StatusBadge status={v.status} /></td>
                <td style={{ padding: "13px 18px", color: "#5f5e5a", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {v.latest_reasoning?.reasoning ?? "—"}
                </td>
                <td style={{ padding: "13px 18px", color: "#888780", whiteSpace: "nowrap" }}>
                  {new Date(v.updated_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {vendors?.length === 0 && (
              <tr><td colSpan={5} style={{ padding: "32px 18px", textAlign: "center", color: "#888780" }}>No submissions yet.</td></tr>
            )}
            {!vendors && (
              <tr><td colSpan={5} style={{ padding: "32px 18px", textAlign: "center", color: "#888780" }}>Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
