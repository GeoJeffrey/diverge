import type { ConfidenceFlag, TickerOutlookResponse } from "@/types/api";

export function pct(v: number | null | undefined, digits = 0): string {
  return v === null || v === undefined || Number.isNaN(v) ? "–" : `${(100 * v).toFixed(digits)}%`;
}

export function move(v: number | null | undefined): string {
  return v === null || v === undefined ? "–" : `±${v.toFixed(2)}%`;
}

export function ratio(expected: number | null, typical: number | null): number | null {
  return expected !== null && typical ? expected / typical : null;
}

/** "Slight lean up" / "Leans down" / "No clear lean". Mirrors the API's thresholds. */
export function leanWords(o: Pick<TickerOutlookResponse, "lean" | "lean_strength">): string {
  if (!o.lean || o.lean === "neutral" || o.lean_strength === "none") return "No clear lean";
  return o.lean_strength === "slight" ? `Slight lean ${o.lean}` : `Leans ${o.lean}`;
}

export type Direction = "up" | "down" | "flat";
export function directionOf(o: Pick<TickerOutlookResponse, "lean" | "lean_strength">): Direction {
  if (!o.lean || o.lean === "neutral" || o.lean_strength === "none") return "flat";
  return o.lean;
}

export const MOVE_WORDS: Record<string, string> = {
  larger_than_usual: "Bigger move than usual",
  typical: "Typical-sized move",
  smaller_than_usual: "Quieter than usual",
  unknown: "Move size unknown",
};

/**
 * Coordination risk: higher = more likely a coordinated campaign. The API speaks in "trust"
 * (high trust = low risk), so this is the single place that translates it.
 */
export type RiskLevel = "low" | "moderate" | "high" | "unknown";

export function riskFromFlag(flag: ConfidenceFlag | null | undefined): RiskLevel {
  if (flag === "high_trust") return "low";
  if (flag === "moderate") return "moderate";
  if (flag === "low_trust") return "high";
  return "unknown";
}

export function riskFromTrustLabel(label: string | null | undefined): RiskLevel {
  if (!label) return "unknown";
  const l = label.toLowerCase();
  if (l.startsWith("high")) return "low";
  if (l.startsWith("moderate")) return "moderate";
  if (l.startsWith("low")) return "high";
  return "unknown";
}

export const RISK_WORDS: Record<RiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  unknown: "Not measured",
};

export const RISK_EXPLAIN: Record<RiskLevel, string> = {
  low: "Posts look organic: many independent authors, little copy-paste.",
  moderate: "Some repeated phrasing or clustered timing. Read with care.",
  high: "Looks partly coordinated: near-identical posts from many accounts.",
  unknown: "Not enough distinct authors yet to measure coordination.",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-20" -> "20 Nov" (no timezone shift: it's a trading day, not an instant). */
export function dayLabel(day: string | null | undefined): string {
  if (!day) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return day;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

/** "2026-08-23T19:25:17Z" -> "23 Aug 2026" (UTC date). */
export function dateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * The pipeline scores each reading over every post kept in its retention period, up to the moment
 * it runs, so window_start_utc is where that look-back begins, not when the reading was taken.
 */
export function postsSince(startIso: string | null | undefined, endIso?: string | null): string {
  if (!startIso) return "";
  return endIso ? `Based on posts from ${dateOnly(startIso)} to ${dateOnly(endIso)}` : `Based on posts since ${dateOnly(startIso)}`;
}

export function int(n: number | null | undefined): string {
  return n === null || n === undefined ? "–" : n.toLocaleString("en-US");
}
