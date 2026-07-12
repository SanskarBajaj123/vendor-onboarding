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

  if (loading) return <PageLoader />;
  if (!session) return <Navigate to="/" replace />;
  if (role !== requireRole) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function PageLoader() {
  return (
    <div style={{ minHeight: "100vh", background: "#f7f6f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ fontSize: 13, color: "#888780" }}>Loading…</p>
    </div>
  );
}

export function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f7f6f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#888780" }}>
      {children}
    </div>
  );
}
