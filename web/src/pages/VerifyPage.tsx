import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";

interface ConfirmResponse {
  status: "confirmed" | "expired" | "already_confirmed";
  message?: string;
  decision?: { status: string; reasoning: string };
}

export function VerifyPage() {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = useState<ConfirmResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .post<ConfirmResponse>(`/vendors/verify/${token}`)
      .then(setResult)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Something went wrong."));
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", background: "#f7f6f2", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 14, border: "1px solid #d8d4cb", padding: 32, textAlign: "center" }}>
        {!error && !result && (
          <p style={{ fontSize: 13, color: "#888780", margin: 0 }}>Confirming your changes…</p>
        )}
        {error && (
          <>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#dc2626", margin: "0 0 8px" }}>Something went wrong</p>
            <p style={{ fontSize: 13, color: "#888780", margin: 0 }}>{error}</p>
          </>
        )}
        {result?.status === "confirmed" && (
          <>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f0fdf4", border: "2px solid #16a34a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>✓</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#14532d", margin: "0 0 8px" }}>Changes confirmed</p>
            <p style={{ fontSize: 13, color: "#5f5e5a", margin: 0 }}>
              Your details have been updated and re-verified.
              {result.decision && <> New status: <strong>{result.decision.status}</strong>.</>}
            </p>
            <a href="/vendor" style={{ display: "inline-block", marginTop: 20, padding: "9px 20px", background: "#1a1a18", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              View your record →
            </a>
          </>
        )}
        {result?.status === "expired" && (
          <>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fef2f2", border: "2px solid #dc2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>✕</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#7f1d1d", margin: "0 0 8px" }}>Link expired</p>
            <p style={{ fontSize: 13, color: "#5f5e5a", margin: 0 }}>
              This verification link expired before it was confirmed. No changes were applied — your original details remain on file.
            </p>
            <a href="/vendor" style={{ display: "inline-block", marginTop: 20, padding: "9px 20px", background: "#1a1a18", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              Back to your record →
            </a>
          </>
        )}
        {result?.status === "already_confirmed" && (
          <>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#1a1a18", margin: "0 0 8px" }}>Already confirmed</p>
            <p style={{ fontSize: 13, color: "#888780", margin: 0 }}>This link has already been used.</p>
          </>
        )}
      </div>
    </div>
  );
}
