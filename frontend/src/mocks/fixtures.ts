/**
 * Demo-mode fixtures (VITE_API_BASE_URL unset or "mock"). Shapes follow docs/openapi.json.
 * The UI marks everything served from here as demo data. The model track record is the real
 * committed model (see modelSnapshot.ts); every per-ticker value below is illustrative only.
 */
import type {
  AuthTokenResponse,
  CoordinationMetric,
  HealthResponse,
  IndexMetricValue,
  IndicesBreakdown,
  OutlookModelResponse,
  ReasoningTraceResponse,
  TickerAdvancedResponse,
  TickerOutlookResponse,
  TickerSimpleItem,
  UserProfileResponse,
} from "@/types/api";
import { MODEL_SNAPSHOT } from "./modelSnapshot";
import { TICKERS } from "@/lib/markets";

const WINDOW = "2026-11-20T08:00:00Z";
const WINDOW_END = "2026-11-20T10:00:00Z";
const AS_OF = "2026-11-20";

export const DEMO_DISCLAIMER =
  "Demo data: illustrative values, not a live reading. In live mode this is a statistical estimate from public social-media data and prices, with its historical accuracy shown alongside. Not investment advice.";

export const mockUsers: Array<UserProfileResponse & { password: string }> = [
  {
    id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    email: "trader@example.com",
    password: "SecurePass123!",
    full_name: "Jane Doe",
    role: "pro",
    created_at: "2026-06-01T12:00:00.000Z",
  },
];

export const health: HealthResponse = {
  status: "healthy",
  version: "1.0.0",
  database: "connected",
  timestamp_utc: "2026-11-20T12:00:00.000Z",
};

// ── per-ticker demo readings ──────────────────────────────────────────────────────────────

type Flag = CoordinationMetric["confidence_flag"];
interface DemoReading {
  score: number | null; // narrative intensity
  verdict: TickerSimpleItem["verdict_label"];
  why: string;
  flag: Flag;
  coordination: number | null;
  outlook: null | {
    p: number;
    expected: number;
    typical: number;
    dampened?: boolean;
    posts: number;
  };
}

const READINGS: Record<string, DemoReading> = {
  RELIANCE: {
    score: 71.4, verdict: "building", flag: "high_trust", coordination: 18.2,
    why: "Retail and energy threads are reinforcing each other, and new accounts keep joining the conversation.",
    outlook: { p: 0.534, expected: 1.62, typical: 1.18, posts: 214 },
  },
  TCS: {
    score: 48.9, verdict: "mixed", flag: "high_trust", coordination: 12.5,
    why: "Deal-win posts and margin worries are roughly balanced; no single story is spreading.",
    outlook: { p: 0.487, expected: 0.94, typical: 1.05, posts: 96 },
  },
  INFY: {
    score: 62.3, verdict: "building", flag: "high_trust", coordination: 21.0,
    why: "Guidance commentary is spreading quickly through new voices rather than the usual regulars.",
    outlook: { p: 0.561, expected: 1.48, typical: 1.31, posts: 133 },
  },
  HDFCBANK: {
    score: 39.8, verdict: "fading", flag: "low_trust", coordination: 74.6,
    why: "Near-identical deposit-growth posts from new accounts dominate the window, so the reading is discounted.",
    outlook: { p: 0.472, expected: 1.21, typical: 1.02, dampened: true, posts: 188 },
  },
  ICICIBANK: {
    score: 52.0, verdict: "mixed", flag: "moderate", coordination: 41.3,
    why: "Attention is steady; a small cluster of repeated posts keeps this at moderate coordination risk.",
    outlook: { p: 0.508, expected: 1.07, typical: 1.11, posts: 71 },
  },
  SBIN: {
    score: null, verdict: "insufficient_data", flag: "insufficient_data", coordination: null,
    why: "Not enough posts in this window for a reliable reading.",
    outlook: null,
  },
  BHARTIARTL: {
    score: null, verdict: "insufficient_data", flag: "insufficient_data", coordination: null,
    why: "Not enough posts in this window for a reliable reading.",
    outlook: null,
  },
  ITC: {
    score: 44.1, verdict: "mixed", flag: "high_trust", coordination: 9.8,
    why: "Quiet, mostly news-driven conversation with little disagreement.",
    outlook: { p: 0.517, expected: 0.81, typical: 0.97, posts: 38 },
  },
  LT: {
    score: 57.6, verdict: "building", flag: "high_trust", coordination: 15.1,
    why: "Order-book posts are picking up and sentiment has shifted above its usual level.",
    outlook: { p: 0.529, expected: 1.33, typical: 1.24, posts: 64 },
  },
  WIPRO: {
    score: 35.2, verdict: "fading", flag: "high_trust", coordination: 11.7,
    why: "Fewer people are posting and the remaining threads lean cautious.",
    outlook: { p: 0.462, expected: 1.15, typical: 1.29, posts: 45 },
  },
  TATASTEEL: {
    score: 66.0, verdict: "building", flag: "moderate", coordination: 38.9,
    why: "Demand chatter is spreading fast; some repeated phrasing keeps coordination risk moderate.",
    outlook: { p: 0.441, expected: 2.36, typical: 1.71, posts: 152 },
  },
  AAPL: {
    score: null, verdict: "insufficient_data", flag: "insufficient_data", coordination: null,
    why: "Not enough data yet for a reliable reading.",
    outlook: { p: 0.527, expected: 1.73, typical: 1.26, posts: 32 },
  },
  TSLA: {
    score: 78.5, verdict: "building", flag: "moderate", coordination: 44.0,
    why: "Very high attention with sharp bull/bear disagreement; part of the volume repeats the same lines.",
    outlook: { p: 0.493, expected: 3.42, typical: 2.88, dampened: true, posts: 402 },
  },
  NVDA: {
    score: 69.9, verdict: "building", flag: "high_trust", coordination: 16.4,
    why: "Attention is well above usual and sentiment has moved with it.",
    outlook: { p: 0.548, expected: 2.21, typical: 2.05, posts: 311 },
  },
  MSFT: {
    score: 46.7, verdict: "mixed", flag: "high_trust", coordination: 8.3,
    why: "Steady, low-key conversation with no clear direction.",
    outlook: { p: 0.503, expected: 0.98, typical: 1.12, posts: 87 },
  },
  AMZN: {
    score: 50.3, verdict: "mixed", flag: "high_trust", coordination: 13.9,
    why: "Mixed retail and cloud threads; neither is gaining ground.",
    outlook: { p: 0.493, expected: 2.48, typical: 2.23, posts: 109 },
  },
};

const TRUST_LABEL: Record<Flag, string> = {
  high_trust: "High confidence",
  moderate: "Moderate confidence - treat with caution",
  low_trust: "Low confidence - possible manipulation detected",
  insufficient_data: "Moderate confidence - treat with caution",
};

export const tickerList: TickerSimpleItem[] = TICKERS.filter((t) => READINGS[t.symbol].score !== null).map((t) => {
  const r = READINGS[t.symbol];
  return {
    id: t.symbol, symbol: t.symbol, name: t.name, sector: t.sector, score: r.score, verdict_label: r.verdict,
    why_sentence: r.why, trust_label: TRUST_LABEL[r.flag], window_start_utc: WINDOW,
  };
});

/** /ticker/{s}/simple also answers for tracked tickers without a score. */
export function simpleFor(symbol: string): TickerSimpleItem | null {
  const t = TICKERS.find((x) => x.symbol === symbol);
  if (!t) return null;
  const r = READINGS[symbol];
  return {
    id: t.symbol, symbol: t.symbol, name: t.name, sector: t.sector, score: r.score, verdict_label: r.verdict,
    why_sentence: r.why, trust_label: TRUST_LABEL[r.flag], window_start_utc: WINDOW,
  };
}

// ── outlooks ──────────────────────────────────────────────────────────────────────────────

function leanOf(p: number) {
  const edge = Math.abs(p - 0.5);
  return {
    lean: (edge < 0.02 ? "neutral" : p > 0.5 ? "up" : "down") as TickerOutlookResponse["lean"],
    lean_strength: (edge >= 0.05 ? "lean" : edge >= 0.02 ? "slight" : "none") as TickerOutlookResponse["lean_strength"],
  };
}

function moveLabel(expected: number, typical: number): TickerOutlookResponse["move_label"] {
  const r = expected / typical;
  return r >= 1.2 ? "larger_than_usual" : r <= 0.83 ? "smaller_than_usual" : "typical";
}

function outlookFor(symbol: string, name: string): TickerOutlookResponse {
  const o = READINGS[symbol].outlook;
  const base = { symbol, name, disclaimer: DEMO_DISCLAIMER, as_of_day: AS_OF, model_version: "demo", generated_at: `${AS_OF}T12:00:00Z` };
  if (!o) {
    return {
      ...base, available: false, coverage_note: "Needs about 2 weeks of post history before an outlook can be made.",
      prob_up: null, lean: null, lean_strength: null, expected_move_pct: null, typical_move_pct: null, move_label: null,
      direction_drivers: [], move_drivers: [], coordination_flag: null, coordination_dampened: false, posts_today: null,
    };
  }
  const up = o.p >= 0.5;
  return {
    ...base, available: true, coverage_note: null, prob_up: o.p, ...leanOf(o.p),
    expected_move_pct: o.expected, typical_move_pct: o.typical, move_label: moveLabel(o.expected, o.typical),
    direction_drivers: [
      { feature: "new_author_share", label: "New voices joining", kind: "narrative", contribution: up ? 0.094 : -0.081, pushes: up ? "up" : "down" },
      { feature: "mean_sentiment", label: "Average sentiment", kind: "narrative", contribution: up ? 0.052 : -0.047, pushes: up ? "up" : "down" },
      { feature: "ret_5", label: "5-day price momentum", kind: "price", contribution: up ? -0.031 : 0.026, pushes: up ? "down" : "up" },
      { feature: "mkt_abs_ret", label: "Market-wide move today", kind: "price", contribution: 0.018, pushes: "up" },
    ],
    move_drivers: [
      { feature: "volume_z", label: "Attention spike vs usual", kind: "narrative", contribution: 0.0024, pushes: "up" },
      { feature: "abs_ret_22", label: "Volatility (1 month)", kind: "price", contribution: 0.0019, pushes: "up" },
      { feature: "sentiment_z", label: "Sentiment shift vs usual", kind: "narrative", contribution: -0.0008, pushes: "down" },
    ],
    coordination_flag: o.dampened ? "low_trust" : READINGS[symbol].flag === "moderate" ? "moderate" : "high_trust",
    coordination_dampened: Boolean(o.dampened), posts_today: o.posts,
  };
}

export const demoOutlooks: TickerOutlookResponse[] = TICKERS.map((t) => outlookFor(t.symbol, t.name));

export const demoOutlookModel: OutlookModelResponse = {
  available: true,
  version: MODEL_SNAPSHOT.version,
  trained_at: MODEL_SNAPSHOT.trained_at,
  training_data: { ...MODEL_SNAPSHOT.training_data },
  track_record: JSON.parse(JSON.stringify(MODEL_SNAPSHOT.track_record)),
  features: MODEL_SNAPSHOT.features.map((f) => ({ ...f })),
  disclaimer:
    "Demo mode: this track record is the committed model's real walk-forward result; per-ticker outlooks elsewhere in demo mode are illustrative. Statistical estimates, not investment advice.",
};

// ── advanced readings (login required in live mode) ──────────────────────────────────────

function metric(label: string, score: number | null, note: string | null): IndexMetricValue {
  return { label, score, available: score !== null, coverage_note: score === null ? note : null };
}

function indicesFor(symbol: string): IndicesBreakdown {
  const r = READINGS[symbol];
  const has = r.score !== null;
  const seed = symbol.length / 10;
  return {
    rn: metric("Contagion", has ? +(0.8 + seed).toFixed(2) : null, "Needs 14+ days of first-mention history; currently at 3 days."),
    cli: metric("Capitulation", has ? +(0.05 + seed / 4).toFixed(2) : null, "Needs 200+ scored posts in the window; currently at 41."),
    vdi: metric("Language divergence", null, "Needs 20+ posts in each language (English and Hinglish) in the same window."),
    cirg: metric("Reality check", null, "Only defined for consumer-facing companies with review coverage."),
    cassi: metric("Cross-market spillover", has ? +(0.3 + seed / 2).toFixed(2) : null, "Needs 30+ complete days of multi-ticker sentiment."),
  };
}

export const advancedBySymbol: Record<string, TickerAdvancedResponse> = Object.fromEntries(
  TICKERS.map((t) => {
    const r = READINGS[t.symbol];
    const has = r.score !== null;
    const value: TickerAdvancedResponse = {
      symbol: t.symbol,
      name: t.name,
      sector: t.sector,
      window_start_utc: WINDOW,
      window_end_utc: WINDOW_END,
      composite_score: r.score,
      dominant_index: has ? "rn" : "insufficient_data",
      risk_flags: r.flag === "low_trust" ? ["coordination_spike"] : [],
      aggregation_confidence: r.flag,
      indices: indicesFor(t.symbol),
      coordination: {
        label: "Coordination risk",
        coordination_score: r.coordination ?? 0,
        confidence_flag: r.flag,
        available: r.coordination !== null,
        coverage_note: r.coordination === null ? "Needs a larger set of distinct authors before a coordination reading is published." : null,
      },
      phylogeny_context: has
        ? [
            { window_start_utc: "2026-11-19T08:00:00Z", mutation_type: "stable", mutation_detail: {}, composite_delta: 1.4 },
            { window_start_utc: "2026-11-19T14:00:00Z", mutation_type: "dominant_index_shift", mutation_detail: { from: "cassi", to: "rn" }, composite_delta: 6.2 },
            ...(r.flag === "low_trust"
              ? [{ window_start_utc: WINDOW, mutation_type: "new_risk_flag" as const, mutation_detail: { flag: "coordination_spike" }, composite_delta: -4.8 }]
              : []),
          ]
        : [],
    };
    return [t.symbol, value];
  }),
);

// ── reasoning traces ───────────────────────────────────────────────────────────────────────

function traces(symbol: string): ReasoningTraceResponse {
  const dup = READINGS[symbol].flag === "low_trust";
  return {
    symbol,
    window_start_utc: WINDOW,
    total_traces: dup ? 7 : 5,
    categories: {
      rn_onset: [
        { trace_id: 1, post_id: "st_1", account_id: "first_time_poster_88", platform: "stocktwits", weight: 0.82, upvotes: 14, text_preview: `First time posting about ${symbol}: the guidance call changed my mind on the next quarter.` },
        { trace_id: 2, post_id: "st_2", account_id: "swing_notes", platform: "stocktwits", weight: 0.61, upvotes: 6, text_preview: `${symbol} keeps coming up in my feed today, watching the open.` },
      ],
      cli_capitulation: [
        { trace_id: 3, post_id: "tg_1", account_id: "desk_chat", platform: "telegram", weight: 0.44, upvotes: 0, text_preview: `Sold my ${symbol} position this morning, done with this one for now.` },
      ],
      cassi_sentiment: [
        { trace_id: 4, post_id: "rss_1", account_id: "markets_wire", platform: "rss_news", weight: 0.37, upvotes: 0, text_preview: "Sector peers rallied after the overnight session; analysts flag read-across." },
      ],
      sentiment_variance_outlier: [
        { trace_id: 5, post_id: "gt_1", account_id: "search_interest", platform: "google_trends", weight: 0.21, upvotes: 0, text_preview: "Search interest rose without a matching news event in the same hour." },
      ],
      ...(dup
        ? {
            duplicate_flag: [
              { trace_id: 6, post_id: "st_d1", account_id: "acct_20261118a", platform: "stocktwits" as const, weight: 0.9, upvotes: 1, text_preview: `${symbol} deposit growth is about to surprise everyone. Load up before results.` },
              { trace_id: 7, post_id: "st_d2", account_id: "acct_20261118b", platform: "stocktwits" as const, weight: 0.88, upvotes: 0, text_preview: `${symbol} deposit growth about to surprise everyone!! Load up before the results` },
            ],
          }
        : {}),
    },
  };
}

export const reasoningBySymbol: Record<string, ReasoningTraceResponse> = Object.fromEntries(
  TICKERS.map((t) => [t.symbol, traces(t.symbol)]),
);

export function issueTokens(userId: string): AuthTokenResponse {
  return {
    access_token: `mock-access.${userId}.${Date.now()}`,
    refresh_token: `mock-refresh.${userId}.${Date.now()}`,
    token_type: "bearer",
    expires_in: 3600,
  };
}
