import { RISK_EXPLAIN, RISK_WORDS, type RiskLevel } from "@/lib/format";

/**
 * Coordination risk as a three-step meter (higher = more likely a coordinated campaign).
 * Shape carries the level (filled steps) and the word says it, so colour is never the only cue.
 */
export function RiskMeter({ level, showWord = true }: { level: RiskLevel; showWord?: boolean }) {
  const filled = level === "low" ? 1 : level === "moderate" ? 2 : level === "high" ? 3 : 0;
  const tone = level === "high" ? "var(--down)" : "var(--text-2)";
  return (
    <span className="inline-flex items-center gap-2" title={RISK_EXPLAIN[level]}>
      <span className="inline-flex items-end gap-[3px]" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-[5px] rounded-[1px] ${level === "unknown" ? "hatch border border-line-strong" : ""}`}
            style={{ height: 4 + i * 4, background: level !== "unknown" && i <= filled ? tone : level === "unknown" ? undefined : "var(--line-strong)" }}
          />
        ))}
      </span>
      {showWord ? (
        <span className="text-sm" style={{ color: level === "high" ? "var(--down)" : level === "unknown" ? "var(--text-3)" : "var(--text)" }}>
          {RISK_WORDS[level]}
        </span>
      ) : (
        <span className="sr-only">Coordination risk: {RISK_WORDS[level]}</span>
      )}
    </span>
  );
}
