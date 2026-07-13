import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface LogEntry {
  id: string;
  vendor_id: string | null;
  step: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
  vendors?: { legal_name: string | null } | null;
}

const STEP_LABELS: Record<string, string> = {
  submission: "SUBMIT",
  gemini_request: "MISTRAL →",
  gemini_response: "MISTRAL ←",
  gemini_error: "MISTRAL ✕",
  cross_check: "CHECK",
  decision: "DECISION",
  email: "EMAIL",
};

const LEVEL_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  info:    { bg: "#1a1a2e", text: "#a0aec0", badge: "#4a5568" },
  success: { bg: "#0d1f17", text: "#68d391", badge: "#276749" },
  warning: { bg: "#1a1500", text: "#f6e05e", badge: "#744210" },
  error:   { bg: "#1a0a0a", text: "#fc8181", badge: "#742a2a" },
};

const STEP_COLORS: Record<string, string> = {
  submission:      "#63b3ed",
  gemini_request:  "#b794f4",
  gemini_response: "#9f7aea",
  gemini_error:    "#fc8181",
  cross_check:     "#68d391",
  decision:        "#f6ad55",
  email:           "#76e4f7",
};

function ts(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
    "." + String(d.getMilliseconds()).padStart(3, "0");
}

function LogRow({ entry, expanded, onToggle }: {
  entry: LogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const colors = LEVEL_COLORS[entry.level] || LEVEL_COLORS.info;
  const stepColor = STEP_COLORS[entry.step] || "#a0aec0";
  const stepLabel = STEP_LABELS[entry.step] || entry.step.toUpperCase();
  const vendorName = entry.vendors?.legal_name;

  return (
    <div
      style={{
        borderBottom: "1px solid #2d3748",
        background: expanded ? colors.bg : "transparent",
        cursor: entry.details ? "pointer" : "default",
        transition: "background 0.1s",
      }}
      onClick={entry.details ? onToggle : undefined}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", padding: "6px 16px", fontFamily: "monospace" }}>
        <span style={{ color: "#4a5568", fontSize: "11px", flexShrink: 0, minWidth: "90px" }}>
          {ts(entry.created_at)}
        </span>
        <span style={{
          fontSize: "10px",
          fontWeight: 700,
          color: stepColor,
          minWidth: "84px",
          flexShrink: 0,
          letterSpacing: "0.05em",
        }}>
          {stepLabel}
        </span>
        {vendorName && (
          <span style={{ fontSize: "10px", color: "#718096", flexShrink: 0, maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            [{vendorName}]
          </span>
        )}
        <span style={{ fontSize: "12px", color: colors.text, flex: 1 }}>
          {entry.message}
        </span>
        {entry.details && (
          <span style={{ color: "#4a5568", fontSize: "10px", flexShrink: 0 }}>
            {expanded ? "▲" : "▼"}
          </span>
        )}
      </div>
      {expanded && entry.details && (
        <div style={{
          margin: "0 16px 8px",
          padding: "8px 12px",
          background: "#111",
          borderRadius: "4px",
          fontSize: "11px",
          color: "#68d391",
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          maxHeight: "300px",
          overflow: "auto",
        }}>
          {JSON.stringify(entry.details, null, 2)}
        </div>
      )}
    </div>
  );
}

export function ProcessLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const [filterVendor, setFilterVendor] = useState<string>("");
  const [liveMode, setLiveMode] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchLogs() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Not authenticated"); return; }
      const params = new URLSearchParams({ limit: "300" });
      if (filterVendor) params.set("vendor_id", filterVendor);
      const res = await fetch(`/employees/process-logs?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data: LogEntry[] = await res.json();
      setLogs(data);
      setError(null);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, [filterVendor]);

  useEffect(() => {
    if (liveMode) {
      intervalRef.current = setInterval(fetchLogs, 4000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [liveMode, filterVendor]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const vendors = Array.from(new Map(
    logs.filter(l => l.vendor_id && l.vendors?.legal_name)
      .map(l => [l.vendor_id!, l.vendors!.legal_name!])
  ).entries());

  const stepCounts: Record<string, number> = {};
  logs.forEach(l => { stepCounts[l.step] = (stepCounts[l.step] || 0) + 1; });
  const errorCount = logs.filter(l => l.level === "error").length;
  const warningCount = logs.filter(l => l.level === "warning").length;

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e2e8f0", fontFamily: "monospace" }}>
      {/* Header */}
      <div style={{
        background: "#111",
        borderBottom: "1px solid #2d3748",
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <Link to="/employee" style={{ color: "#718096", textDecoration: "none", fontSize: "13px" }}>
          ← Dashboard
        </Link>
        <span style={{ color: "#4a5568" }}>|</span>
        <span style={{ fontWeight: 700, fontSize: "14px", color: "#e2e8f0", letterSpacing: "0.1em" }}>
          PIPELINE LOGS
        </span>

        {/* Stats */}
        <div style={{ display: "flex", gap: "12px", marginLeft: "8px" }}>
          <span style={{ fontSize: "11px", color: "#68d391" }}>{logs.length} entries</span>
          {errorCount > 0 && <span style={{ fontSize: "11px", color: "#fc8181" }}>{errorCount} errors</span>}
          {warningCount > 0 && <span style={{ fontSize: "11px", color: "#f6e05e" }}>{warningCount} warnings</span>}
        </div>

        <div style={{ flex: 1 }} />

        {/* Vendor filter */}
        {vendors.length > 0 && (
          <select
            value={filterVendor}
            onChange={e => setFilterVendor(e.target.value)}
            style={{
              background: "#1a202c",
              border: "1px solid #4a5568",
              color: "#e2e8f0",
              borderRadius: "4px",
              padding: "4px 8px",
              fontSize: "12px",
            }}
          >
            <option value="">All vendors</option>
            {vendors.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        )}

        {/* Controls */}
        <button
          onClick={() => setLiveMode(m => !m)}
          style={{
            padding: "4px 12px",
            borderRadius: "4px",
            border: "1px solid",
            borderColor: liveMode ? "#276749" : "#4a5568",
            background: liveMode ? "#0d1f17" : "#1a202c",
            color: liveMode ? "#68d391" : "#718096",
            cursor: "pointer",
            fontSize: "11px",
            fontFamily: "monospace",
          }}
        >
          {liveMode ? "● LIVE" : "○ PAUSED"}
        </button>
        <button
          onClick={() => setAutoScroll(a => !a)}
          style={{
            padding: "4px 12px",
            borderRadius: "4px",
            border: "1px solid #4a5568",
            background: autoScroll ? "#1a1a2e" : "#1a202c",
            color: autoScroll ? "#63b3ed" : "#718096",
            cursor: "pointer",
            fontSize: "11px",
            fontFamily: "monospace",
          }}
        >
          {autoScroll ? "↓ AUTO" : "↓ MANUAL"}
        </button>
        <button
          onClick={fetchLogs}
          style={{
            padding: "4px 10px",
            borderRadius: "4px",
            border: "1px solid #4a5568",
            background: "#1a202c",
            color: "#a0aec0",
            cursor: "pointer",
            fontSize: "11px",
            fontFamily: "monospace",
          }}
        >
          ↺
        </button>
      </div>

      {/* Legend */}
      <div style={{
        background: "#111",
        borderBottom: "1px solid #1a202c",
        padding: "6px 20px",
        display: "flex",
        gap: "20px",
        flexWrap: "wrap",
      }}>
        {Object.entries(STEP_COLORS).map(([step, color]) => (
          <span key={step} style={{ fontSize: "10px", color, letterSpacing: "0.05em" }}>
            {STEP_LABELS[step] || step} ({stepCounts[step] || 0})
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: "10px", color: "#4a5568" }}>
          click any row with ▼ to expand details
        </span>
      </div>

      {/* Log body */}
      <div
        ref={containerRef}
        style={{ padding: "8px 0", minHeight: "80vh" }}
        onScroll={() => {
          if (!containerRef.current) return;
          const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
          const atBottom = scrollHeight - scrollTop - clientHeight < 60;
          if (!atBottom) setAutoScroll(false);
        }}
      >
        {loading && (
          <div style={{ padding: "40px", textAlign: "center", color: "#4a5568" }}>Loading…</div>
        )}
        {error && (
          <div style={{ padding: "16px 20px", color: "#fc8181", fontSize: "12px" }}>
            Error: {error}
          </div>
        )}
        {!loading && !error && logs.length === 0 && (
          <div style={{ padding: "60px", textAlign: "center", color: "#4a5568", fontSize: "13px" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>📭</div>
            No pipeline logs yet. Submit a vendor form to see live execution steps here.
          </div>
        )}
        {logs.map(entry => (
          <LogRow
            key={entry.id}
            entry={entry}
            expanded={expanded.has(entry.id)}
            onToggle={() => toggleExpanded(entry.id)}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
