import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute({
  children,
  requireRole,
}: {
  children: ReactNode;
  requireRole: "vendor" | "employee";
}) {
  const { session, role, loading } = useAuth();

  if (loading) return <CenteredMessage>Loading…</CenteredMessage>;
  if (!session) return <Navigate to="/" replace />;
  if (role !== requireRole) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-text-secondary">
      {children}
    </div>
  );
}
