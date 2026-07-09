import type { CSSProperties, ReactNode } from "react";

export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        borderRadius: 14,
        border: "1px solid var(--color-border)",
        background: "#fff",
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
