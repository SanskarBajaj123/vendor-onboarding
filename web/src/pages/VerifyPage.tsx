import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Card } from "../components/ui/Card";

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
      .post<ConfirmResponse>(`/verify/${token}`)
      .then(setResult)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Something went wrong."));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-[420px] text-center">
        {error && <p className="text-sm text-text-danger">{error}</p>}
        {!error && !result && <p className="text-sm text-text-secondary">Confirming…</p>}
        {result?.status === "confirmed" && (
          <>
            <p className="mb-1 text-base font-medium text-text-success">Confirmed</p>
            <p className="text-[13px] text-text-secondary">
              Your changes have been applied and re-verified.
              {result.decision && ` New status: ${result.decision.status}.`}
            </p>
          </>
        )}
        {result?.status === "expired" && (
          <>
            <p className="mb-1 text-base font-medium text-text-danger">Link expired</p>
            <p className="text-[13px] text-text-secondary">
              This verification link expired before it was confirmed. No changes were applied —
              your original details remain on file.
            </p>
          </>
        )}
        {result?.status === "already_confirmed" && (
          <p className="text-[13px] text-text-secondary">This link has already been used.</p>
        )}
      </Card>
    </div>
  );
}
