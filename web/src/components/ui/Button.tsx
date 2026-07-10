import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

export function Button({
  variant = "secondary",
  className = "",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    "inline-flex items-center justify-center h-[42px] rounded-[var(--radius-control)] px-5 text-[13px] font-600 transition-all disabled:cursor-not-allowed";

  const styles: Record<Variant, string> = {
    primary: disabled
      ? "bg-[#ececea] text-[#b4b2a9] cursor-not-allowed"
      : "bg-[#1a1a18] text-white hover:bg-[#2d2d2a] active:bg-[#111110]",
    secondary:
      "border border-border-strong bg-transparent text-text-primary hover:bg-surface-1 active:bg-surface-0",
    danger: disabled
      ? "bg-[#ececea] text-[#b4b2a9]"
      : "bg-gradient-to-br from-[#7f1d1d] to-[#dc2626] text-white shadow-[0_4px_14px_rgba(220,38,38,0.25)] hover:opacity-90",
  };

  return (
    <button
      className={`${base} ${styles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    />
  );
}
