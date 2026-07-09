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

  return (
    <Shell eyebrow="Employee view" title="Vendor submissions" maxWidth="1060px">
      <div style={{ display: "flex", gap: 14 }}>
        <GradientTile label="Total vendors" value={vendors?.length ?? 0}
          gradient="linear-gradient(135deg,#1a3a5c,#2563eb)" shadow="0 4px 18px rgba(37,99,235,0.22)" />
        <GradientTile label="Approved" value={stats.approved}
          gradient="linear-gradient(135deg,#14532d,#16a34a)" shadow="0 4px 18px rgba(22,163,74,0.22)" />
        <GradientTile label="Pending review" value={stats.pending}
          gradient="linear-gradient(135deg,#78350f,#d97706)" shadow="0 4px 18px rgba(217,119,6,0.22)" />
        <GradientTile label="Rejected" value={stats.rejected}
          gradient="linear-gradient(135deg,#7f1d1d,#dc2626)" shadow="0 4px 18px rgba(220,38,38,0.22)" />
      </div>

      <div style={{ borderRadius: 14, border: "1px solid #e0ddd6", background: "#fff", overflow: "hidden" }}>
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
