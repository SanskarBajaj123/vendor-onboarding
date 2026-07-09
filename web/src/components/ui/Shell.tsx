import type { ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "#1a3a5c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M4 12l6 6L20 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600 }}>Vendor Onboarding</span>
    </div>
  );
}

export function Shell({
  children,
  eyebrow,
  title,
  actions,
  maxWidth = "760px",
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  actions?: ReactNode;
  maxWidth?: string;
}) {
  const { session, role, signOut } = useAuth();

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-surface-0)" }}>
      <header style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-1)" }}>
        <div
          style={{
            maxWidth,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 28px",
          }}
        >
          <Logo />
          {session && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {session.user.email}
              </span>
              {role && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    background: role === "employee" ? "#e8f4fd" : "#f0f7ff",
                    color: role === "employee" ? "#185fa5" : "#1a3a5c",
                    border: `1px solid ${role === "employee" ? "#bfdbfe" : "#bfdbfe"}`,
                    padding: "3px 8px",
                    borderRadius: 20,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {role}
                </span>
              )}
              <button
                onClick={() => signOut()}
                style={{
                  height: 34,
                  borderRadius: 8,
                  border: "1px solid var(--color-border-strong)",
                  background: "transparent",
                  padding: "0 14px",
                  fontSize: 12,
                  cursor: "pointer",
                  color: "var(--color-text-primary)",
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main
        style={{
          maxWidth,
          margin: "0 auto",
          padding: "32px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {(eyebrow || title || actions) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              {eyebrow && (
                <p style={{ margin: "0 0 3px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                  {eyebrow}
                </p>
              )}
              {title && <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{title}</p>}
            </div>
            {actions}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
