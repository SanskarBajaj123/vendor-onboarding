import type { InputHTMLAttributes, ReactNode } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Field({ label, error, hint, className = "", ...props }: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-xs text-text-secondary">{label}</label>
      <input className={`${error ? "field-error" : ""} ${className}`} {...props} />
      {error && <p className="mt-1 text-[11px] text-text-danger">{error}</p>}
      {!error && hint && <p className="mt-1 text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}

export function SelectField({
  label,
  error,
  children,
  ...props
}: {
  label: string;
  error?: string;
  children: ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="mb-1 block text-xs text-text-secondary">{label}</label>
      <select className={error ? "field-error" : ""} {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-[11px] text-text-danger">{error}</p>}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2.5 text-xs font-medium tracking-wide text-text-muted uppercase">
      {children}
    </p>
  );
}
