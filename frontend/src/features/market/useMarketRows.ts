import { useMemo } from "react";
import type { TickerOutlookResponse, TickerSimpleItem } from "@/types/api";
import { useOutlooks, useTickers } from "@/lib/queries";
import { TICKERS, type TrackedTicker } from "@/lib/markets";
import { ratio, riskFromFlag, riskFromTrustLabel, type RiskLevel } from "@/lib/format";

export interface MarketRow {
  meta: TrackedTicker;
  outlook: TickerOutlookResponse | null;
  reading: TickerSimpleItem | null;
  moveRatio: number | null;
  risk: RiskLevel;
}

/** One row per tracked name: /outlook covers every ticker, /tickers only names with a scored window. */
export function useMarketRows() {
  const outlooks = useOutlooks();
  const tickers = useTickers();
  const rows = useMemo<MarketRow[]>(() => {
    const o = new Map((outlooks.data?.outlooks ?? []).map((x) => [x.symbol, x]));
    const t = new Map((tickers.data?.tickers ?? []).map((x) => [x.symbol, x]));
    return TICKERS.map((meta) => {
      const outlook = o.get(meta.symbol) ?? null;
      const reading = t.get(meta.symbol) ?? null;
      const risk = reading ? riskFromTrustLabel(reading.trust_label) : riskFromFlag(outlook?.coordination_flag);
      return {
        meta,
        outlook,
        reading,
        moveRatio: outlook?.available ? ratio(outlook.expected_move_pct, outlook.typical_move_pct) : null,
        risk,
      };
    });
  }, [outlooks.data, tickers.data]);
  return { rows, outlooks, tickers };
}
