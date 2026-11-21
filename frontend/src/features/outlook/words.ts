import type { CallTier, OutlookModelResponse, TickerOutlookResponse } from "@/types/api";
import { dayLabel, move, MOVE_WORDS, pct, ratio } from "@/lib/format";

/** One plain sentence for the call. Built only from API fields. */
export function headline(o: TickerOutlookResponse): string {
  if (!o.available || o.prob_up === null) return `No outlook for ${o.symbol} yet`;
  const after = o.as_of_day ? ` after the ${dayLabel(o.as_of_day)} close` : "";
  return `${pct(o.prob_up)} chance ${o.symbol} closes higher${after}`;
}

/** How to read the edge. The UI never lets a lean look like a sure thing. */
export function edgeNote(p: number): string {
  const edge = Math.abs(p - 0.5);
  if (edge < 0.02) return "Effectively a coin flip.";
  if (edge < 0.05) return "Close to a coin flip.";
  return "A lean, not a certainty.";
}

export function moveSentence(o: TickerOutlookResponse): string | null {
  if (o.expected_move_pct === null) return null;
  const r = ratio(o.expected_move_pct, o.typical_move_pct);
  const label = MOVE_WORDS[o.move_label ?? "unknown"];
  const vs = o.typical_move_pct !== null ? `, against a typical ${move(o.typical_move_pct)}` : "";
  return `${label}: ${move(o.expected_move_pct)} expected${vs}${r !== null ? ` (${r.toFixed(1)}×)` : ""}.`;
}

export function tierFor(o: TickerOutlookResponse, model: OutlookModelResponse | undefined): { tier: CallTier; name: string } | null {
  const d = model?.track_record?.direction;
  if (!d) return null;
  if (o.lean_strength === "lean") return { tier: d.lean_calls, name: "“Leans” calls" };
  if (o.lean_strength === "slight") return { tier: d.slight_calls, name: "“Slight lean” calls" };
  return { tier: d.no_call, name: "Days with no clear lean" };
}

export function trackRecordSentence(o: TickerOutlookResponse, model: OutlookModelResponse | undefined): string | null {
  const t = tierFor(o, model);
  const d = model?.track_record?.direction;
  if (!t || !d || t.tier.accuracy === null) return null;
  return `${t.name} were right ${pct(t.tier.accuracy, 1)} of the time on ${t.tier.days.toLocaleString("en-US")} test days it had never seen. Always guessing “up” was right ${pct(d.always_up_accuracy, 1)}.`;
}
