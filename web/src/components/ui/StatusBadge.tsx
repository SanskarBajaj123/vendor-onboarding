const DOT_COLOR: Record<string, string> = {
  approved:   "#16a34a",
  pending:    "#d97706",
  rejected:   "#dc2626",
  draft:      "#888780",
  registered: "#6366f1",
};

const BG: Record<string, string> = {
  approved:   "#f0fdf4",
  pending:    "#fffbeb",
  rejected:   "#fef2f2",
  draft:      "#f7f6f2",
  registered: "#eef2ff",
};

const BORDER: Record<string, string> = {
  approved:   "#86efac",
  pending:    "#fde68a",
  rejected:   "#fca5a5",
  draft:      "#e0ddd6",
  registered: "#c7d2fe",
};

const TEXT: Record<string, string> = {
  approved:   "#14532d",
  pending:    "#78350f",
  rejected:   "#7f1d1d",
  draft:      "#888780",
  registered: "#3730a3",
};

const LABELS: Record<string, string> = {
  approved:   "Approved",
  pending:    "Pending",
  rejected:   "Rejected",
  draft:      "Draft",
  registered: "Registered",
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_KEYS.includes(status) ? status : "draft";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        borderRadius: "999px",
        border: `1px solid ${BORDER[s]}`,
        background: BG[s],
        color: TEXT[s],
        padding: "4px 11px",
        fontSize: "12px",
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: DOT_COLOR[s],
          flexShrink: 0,
        }}
      />
      {LABELS[s] ?? status}
    </span>
  );
}

const STATUS_KEYS = Object.keys(LABELS);
