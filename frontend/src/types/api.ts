export type HealthStatus = "healthy" | "degraded" | "unhealthy";
export type DatabaseStatus = "connected" | "disconnected";
export type VerdictLabel = "building" | "mixed" | "fading" | "insufficient_data";
export type ConfidenceFlag = "high_trust" | "moderate" | "low_trust" | "insufficient_data";
export type UserRole = "standard" | "pro" | "admin";
export type MutationType =
  | "stable"
  | "dominant_index_shift"
  | "composite_reversal"
  | "new_risk_flag"
  | "flag_resolved";
export type Platform =
  | "stocktwits"
  | "reddit"
  | "telegram"
  | "rss_news"
  | "google_trends";

export interface HealthResponse {
  status: HealthStatus;
  version: string;
  database: DatabaseStatus;
  timestamp_utc: string;
}

export interface ErrorResponse {
  error_code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface IndexMetricValue {
  label: string;
  score: number | null;
  available: boolean;
  coverage_note: string | null;
}

export interface TickerSimpleItem {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  score: number | null;
  verdict_label: VerdictLabel;
  why_sentence: string;
  trust_label: string;
  window_start_utc: string;
}

export interface TickerListResponse {
  total: number;
  tickers: TickerSimpleItem[];
}

export type TickerSimpleResponse = TickerSimpleItem;

export interface IndicesBreakdown {
  rn: IndexMetricValue;
  cirg: IndexMetricValue;
  cli: IndexMetricValue;
  cassi: IndexMetricValue;
  vdi: IndexMetricValue;
}

export interface CoordinationMetric {
  label: string;
  coordination_score: number;
  confidence_flag: ConfidenceFlag;
  available: boolean;
  coverage_note: string | null;
}

export interface PhylogenyTransitionItem {
  window_start_utc: string;
  mutation_type: MutationType;
  mutation_detail: Record<string, unknown>;
  composite_delta: number | null;
}

export interface TickerAdvancedResponse {
  symbol: string;
  name: string;
  sector: string;
  window_start_utc: string;
  window_end_utc: string | null;
  composite_score: number | null;
  dominant_index: string;
  risk_flags: string[];
  aggregation_confidence: ConfidenceFlag;
  indices: IndicesBreakdown;
  coordination: CoordinationMetric;
  phylogeny_context: PhylogenyTransitionItem[];
}

export interface ReasoningTraceItem {
  trace_id: number;
  post_id: string;
  account_id: string;
  platform: Platform;
  weight: number;
  upvotes: number;
  text_preview: string;
}

export type ReasoningCategoryKey =
  | "rn_onset"
  | "cassi_sentiment"
  | "vdi_divergence"
  | "cli_capitulation"
  | "duplicate_flag"
  | "sentiment_variance_outlier";

export interface ReasoningTraceResponse {
  symbol: string;
  window_start_utc: string | null;
  total_traces: number;
  categories: Partial<Record<ReasoningCategoryKey, ReasoningTraceItem[]>> &
    Record<string, ReasoningTraceItem[] | undefined>;
}

export type IndexKey = keyof IndicesBreakdown;

// ── Next-day outlook ──

export type OutlookLean = "up" | "down" | "neutral";
export type OutlookLeanStrength = "lean" | "slight" | "none";
export type OutlookMoveLabel = "larger_than_usual" | "typical" | "smaller_than_usual" | "unknown";

export interface OutlookDriver {
  feature: string;
  label: string;
  kind: "narrative" | "price";
  contribution: number;
  pushes: "up" | "down";
}

export interface TickerOutlookResponse {
  symbol: string;
  name: string;
  available: boolean;
  coverage_note: string | null;
  as_of_day: string | null;
  prob_up: number | null;
  lean: OutlookLean | null;
  lean_strength: OutlookLeanStrength | null;
  expected_move_pct: number | null;
  typical_move_pct: number | null;
  move_label: OutlookMoveLabel | null;
  direction_drivers: OutlookDriver[];
  move_drivers: OutlookDriver[];
  coordination_flag: ConfidenceFlag | null;
  coordination_dampened: boolean;
  posts_today: number | null;
  model_version: string | null;
  generated_at: string | null;
  disclaimer: string;
}

export interface OutlookListResponse {
  total: number;
  outlooks: TickerOutlookResponse[];
}

export interface CallTier {
  share_of_days: number;
  accuracy: number | null;
  days: number;
}

export interface OutlookTrackRecord {
  test_period: string;
  test_days: number;
  tickers: string[];
  direction: {
    auc: number;
    accuracy: number;
    always_up_accuracy: number;
    brier: number;
    lean_calls: CallTier;
    slight_calls: CallTier;
    no_call: CallTier;
    calibration: { mean_predicted: number; actual_up_rate: number; days: number }[];
  };
  move: {
    oos_r2: number;
    oos_r2_price_only: number;
    rank_corr: number;
    larger_than_usual_calls: { share_of_days: number; precision: number | null; base_rate: number };
  };
}

export interface OutlookModelFeature {
  feature: string;
  label: string;
  kind: string;
  direction_weight: number;
  move_weight: number;
}

export interface OutlookModelResponse {
  available: boolean;
  version: string | null;
  trained_at: string | null;
  training_data: { source?: string; sentiment_model?: string; ticker_days?: number; first_day?: string; last_day?: string };
  track_record: Partial<OutlookTrackRecord>;
  features: OutlookModelFeature[];
  disclaimer: string;
}
