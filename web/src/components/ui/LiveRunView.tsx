import { useEffect, useRef, useState } from "react";

export interface RunStage {
  key: string;
  label: string;
  sub?: string;
}

type StageState = "pending" | "running" | "done" | "error";

interface LiveRunViewProps<T> {
  stages: RunStage[];
  run: () => Promise<T>;
  onSettled?: (result: T | null, error: unknown) => void;
  renderResult: (result: T) => React.ReactNode;
  onBack?: () => void;
  minStageMs?: number;
}

function StageIcon({ state }: { state: StageState }) {
  if (state === "done") {
    return (
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "linear-gradient(135deg,#14532d,#16a34a)",
        border: "2px solid #16a34a",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, color: "#fff", flexShrink: 0,
      }}>✓</div>
    );
  }
  if (state === "running") {
    return (
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "linear-gradient(135deg,#1a3a5c,#2563eb)",
        border: "2px solid #2563eb",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, position: "relative",
      }}>
        <div style={{
          width: 14, height: 14, borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.4)",
          borderTopColor: "#fff",
          animation: "spin 0.7s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "linear-gradient(135deg,#7f1d1d,#dc2626)",
        border: "2px solid #dc2626",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, color: "#fff", flexShrink: 0,
      }}>✕</div>
    );
  }
  // pending
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%",
      background: "#f7f6f2",
      border: "2px solid #e0ddd6",
      flexShrink: 0,
    }} />
  );
}

export function LiveRunView<T>({
  stages,
  run,
  onSettled,
  renderResult,
  onBack,
  minStageMs = 600,
}: LiveRunViewProps<T>) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [settled, setSettled] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    const runPromise = run();

    const ticker = setInterval(() => {
      setActiveIndex((i) => (i < stages.length - 1 ? i + 1 : i));
    }, minStageMs);

    runPromise
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => {
        if (cancelled) return;
        clearInterval(ticker);
        setActiveIndex(stages.length - 1);
        setSettled(true);
      });

    return () => { cancelled = true; clearInterval(ticker); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (settled) onSettled?.(result, error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  const SUBS = [
    "Authenticating your session",
    "Verifying required document types",
    "Extracting data with AI cross-check",
    "Running decision rules",
    "Dispatching status email",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {stages.map((stage, i) => {
        const state: StageState =
          settled && error && i === activeIndex ? "error" :
          (i < activeIndex || (settled && !error && i <= activeIndex)) ? "done" :
          i === activeIndex ? "running" : "pending";

        const isLast = i === stages.length - 1;
        const lineColor = state === "done" ? "#16a34a" : "#e0ddd6";

        return (
          <div key={stage.key} style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingBottom: isLast ? 0 : 24, position: "relative" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <StageIcon state={state} />
              {!isLast && (
                <div style={{ width: 2, flex: 1, minHeight: 20, background: lineColor, marginTop: 4, transition: "background 0.4s" }} />
              )}
            </div>
            <div style={{ paddingTop: 5 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: state === "pending" ? "#888780" : "#1e1e1c" }}>
                {stage.label}
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#888780" }}>
                {stage.sub ?? SUBS[i] ?? ""}
              </p>
            </div>
            {state !== "pending" && (
              <div style={{ marginLeft: "auto", paddingTop: 7 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  background: state === "done" ? "#f0fdf4" : state === "running" ? "#f0f7ff" : "#fef2f2",
                  color: state === "done" ? "#14532d" : state === "running" ? "#1a3a5c" : "#7f1d1d",
                  border: `1px solid ${state === "done" ? "#86efac" : state === "running" ? "#bfdbfe" : "#fca5a5"}`,
                  padding: "3px 9px", borderRadius: 20,
                }}>
                  {state === "done" ? "Done" : state === "running" ? "Running…" : "Error"}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {settled && error != null && (
        <div style={{
          marginTop: 20, padding: 16, borderRadius: 12,
          background: "#fef2f2", border: "1.5px solid #fca5a5",
        }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#7f1d1d" }}>
            {error instanceof Error ? error.message : "Something went wrong."}
          </p>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 8,
                background: "#1a1a18", color: "#fff", border: "none", cursor: "pointer",
              }}
            >
              ← Back to form
            </button>
          )}
        </div>
      )}

      {settled && !error && result != null && (
        <div style={{ marginTop: 20, borderTop: "1px solid #e0ddd6", paddingTop: 20 }}>
          {renderResult(result)}
        </div>
      )}
    </div>
  );
}
