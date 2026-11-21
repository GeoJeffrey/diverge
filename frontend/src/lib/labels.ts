import type { IndexKey, MutationType, Platform, ReasoningCategoryKey, VerdictLabel } from "@/types/api";

/** Approved index names. Never render raw IndexKey values in the UI. */
export const INDEX_LABELS: Record<IndexKey, string> = {
  rn: "Contagion",
  cli: "Capitulation",
  vdi: "Language divergence",
  cirg: "Reality check",
  cassi: "Cross-market spillover",
};

export const INDEX_SHORT: Record<IndexKey, string> = {
  rn: "Rn",
  cli: "CLI",
  vdi: "VDI",
  cirg: "CIRG",
  cassi: "CASSI",
};

/** Plain-English meaning, from docs/architecture.md. No claims beyond it. */
export const INDEX_EXPLAIN: Record<IndexKey, string> = {
  rn: "Is the story recruiting new posters faster than it loses them? Estimated like an epidemic's reproduction number: above 1 it is spreading, below 1 it is fading.",
  cli: "Share of posts in the window that read like giving up: “I'm out, sold everything”.",
  vdi: "Gap between English and Hinglish sentiment on the same stock, after putting both on a common scale.",
  cirg: "Gap between investor hype and what consumers say in reviews. Only defined for consumer-facing companies.",
  cassi: "How much of this stock's sentiment swings are driven by the other tracked stocks.",
};

export const INDEX_ORDER: IndexKey[] = ["rn", "cli", "vdi", "cirg", "cassi"];

export function labelForIndexKey(key: string): string {
  if (key === "insufficient_data") return "Not enough data yet";
  return key in INDEX_LABELS ? INDEX_LABELS[key as IndexKey] : "Narrative driver";
}

export const REASONING_CATEGORY_LABELS: Record<ReasoningCategoryKey, string> = {
  rn_onset: "New voices joining (virality onset)",
  cli_capitulation: "Capitulation language",
  duplicate_flag: "Near-duplicate posts",
  cassi_sentiment: "Moves linked to other stocks",
  vdi_divergence: "Language divergence",
  sentiment_variance_outlier: "Unusual consensus",
};

export const REASONING_CATEGORY_EXPLAIN: Record<ReasoningCategoryKey, string> = {
  rn_onset: "First posts about this stock from these accounts; they drive the contagion estimate.",
  cli_capitulation: "Posts matched by the capitulation lexicon.",
  duplicate_flag: "Posts whose text nearly matches posts from other accounts in the same window.",
  cassi_sentiment: "Posts that tie this stock's mood to other tracked names.",
  vdi_divergence: "Posts where English and Hinglish sentiment pull apart.",
  sentiment_variance_outlier: "Posts that stand out from the window's usual spread of opinion.",
};

export function labelForReasoningCategory(key: string): string {
  return key in REASONING_CATEGORY_LABELS ? REASONING_CATEGORY_LABELS[key as ReasoningCategoryKey] : "Other evidence";
}

export function explainReasoningCategory(key: string): string | null {
  return key in REASONING_CATEGORY_EXPLAIN ? REASONING_CATEGORY_EXPLAIN[key as ReasoningCategoryKey] : null;
}

export function labelForMutation(type: MutationType): string {
  const map: Record<MutationType, string> = {
    stable: "Story held steady",
    dominant_index_shift: "Leading driver changed",
    composite_reversal: "Intensity reversed",
    new_risk_flag: "New risk flag",
    flag_resolved: "Risk flag cleared",
  };
  return map[type] ?? "Change";
}

export function labelForVerdict(verdict: VerdictLabel): string {
  const map: Record<VerdictLabel, string> = {
    building: "Building",
    mixed: "Mixed",
    fading: "Fading",
    insufficient_data: "Not enough data",
  };
  return map[verdict];
}

export function labelForPlatform(platform: Platform | string): string {
  const map: Record<string, string> = {
    stocktwits: "StockTwits",
    reddit: "Reddit",
    telegram: "Telegram",
    rss_news: "News",
    google_trends: "Search trends",
  };
  return map[platform] ?? platform;
}

export function labelForRole(role: string): string {
  if (role === "pro") return "Pro";
  if (role === "admin") return "Admin";
  return "Standard";
}

export function formatRiskFlag(flag: string): string {
  const known: Record<string, string> = {
    coordination_spike: "Coordination spike",
    consumer_reality_underpriced: "Consumer reality underpriced",
  };
  if (known[flag]) return known[flag];
  const s = flag.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
