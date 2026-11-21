import { useParams } from "react-router";
import type { IndexMetricValue, TickerAdvancedResponse } from "@/types/api";
import { useOutlook, useOutlookModel, useTickerAdvanced, errorMessage } from "@/lib/queries";
import { ErrorBlock, Skeleton, Unavailable } from "@/design-system/components/States";
import { RiskMeter } from "@/design-system/components/Risk";
import { Term } from "@/design-system/components/Term";
import { TextLink } from "@/design-system/components/Controls";
import { OutlookPanel } from "@/features/outlook/OutlookPanel";
import { dateOnly, postsSince, riskFromFlag, RISK_EXPLAIN } from "@/lib/format";
import { formatRiskFlag, INDEX_EXPLAIN, INDEX_LABELS, INDEX_ORDER, INDEX_SHORT, labelForIndexKey, labelForMutation } from "@/lib/labels";

const CONFIDENCE_WORDS = { high_trust: "high", moderate: "moderate", low_trust: "low", insufficient_data: "not enough data" } as const;
import { tickerMeta } from "@/lib/markets";
import NotFoundPage from "@/features/system/NotFoundPage";
import { TickerHeader } from "./TickerHeader";

function IndexRow({ k, m, leading }: { k: (typeof INDEX_ORDER)[number]; m: IndexMetricValue; leading: boolean }) {
  return (
    <li className="grid gap-x-8 gap-y-2 border-t border-line py-5 md:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
      <div>
        <h3 className="t-h3 flex items-baseline gap-2">
          {INDEX_LABELS[k]}
          <span className="t-num text-xs font-normal text-text-3">{INDEX_SHORT[k]}</span>
          {leading && <span className="text-xs font-semibold text-text-2">leading driver</span>}
        </h3>
        <p className="t-small mt-1 max-w-[60ch]">{INDEX_EXPLAIN[k]}</p>
      </div>
      <div className="md:text-right">
        {m.available && m.score !== null ? (
          <span className="t-num text-2xl font-semibold tracking-[-0.02em]">{m.score.toFixed(2)}</span>
        ) : (
          <Unavailable title="Not available">{m.coverage_note ?? "Not enough data for this index yet."}</Unavailable>
        )}
      </div>
    </li>
  );
}

function Transitions({ items }: { items: TickerAdvancedResponse["phylogeny_context"] }) {
  if (items.length === 0) {
    return <Unavailable title="No narrative changes recorded yet">Transitions appear once there are several scored windows to compare.</Unavailable>;
  }
  return (
    <ol className="relative list-none border-l border-line-strong p-0 pl-6">
      {items.map((t, i) => (
        <li key={`${t.window_start_utc}-${i}`} className="relative pb-6 last:pb-0">
          <span
            aria-hidden="true"
            className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg"
            style={{ background: t.mutation_type === "new_risk_flag" ? "var(--down)" : t.mutation_type === "stable" ? "var(--text-3)" : "var(--text)" }}
          />
          <p className="t-small">Reading of posts since {dateOnly(t.window_start_utc)}</p>
          <p className="mt-0.5 text-[0.9375rem] text-text">
            {labelForMutation(t.mutation_type)}
            {t.mutation_type === "dominant_index_shift" && typeof t.mutation_detail.from === "string" && typeof t.mutation_detail.to === "string" && (
              <span className="text-text-2">: {labelForIndexKey(t.mutation_detail.from)} to {labelForIndexKey(t.mutation_detail.to)}</span>
            )}
            {t.mutation_type === "new_risk_flag" && typeof t.mutation_detail.flag === "string" && (
              <span className="text-text-2">: {formatRiskFlag(t.mutation_detail.flag)}</span>
            )}
          </p>
          {t.composite_delta !== null && (
            <p className="t-num mt-0.5 text-sm text-text-2">intensity {t.composite_delta >= 0 ? "+" : "−"}{Math.abs(t.composite_delta).toFixed(1)}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

export function Readings({ a, symbol }: { a: TickerAdvancedResponse; symbol: string }) {
  const level = a.coordination.available ? riskFromFlag(a.coordination.confidence_flag) : "unknown";
  return (
    <div className="space-y-14">
      <section aria-labelledby="int-h" className="grid gap-6 md:grid-cols-3">
        <div>
          <h2 id="int-h" className="t-small">
            <Term explain="How strong the conversation is (0–100): volume, spread to new voices, agreement. It measures loudness, not direction.">Narrative intensity</Term>
          </h2>
          {a.composite_score !== null ? (
            <p className="t-num mt-1 text-[2.5rem] font-semibold leading-none tracking-[-0.03em]">{a.composite_score.toFixed(1)}</p>
          ) : (
            <p className="mt-2 text-sm text-text-2">Not enough data yet</p>
          )}
          <p className="t-small mt-2">Leading driver: {labelForIndexKey(a.dominant_index)}</p>
        </div>
        <div>
          <h2 className="t-small">Coordination risk</h2>
          <div className="mt-2"><RiskMeter level={level} /></div>
          <p className="t-small mt-2">
            {a.coordination.available ? `Score ${a.coordination.coordination_score.toFixed(1)} of 100. ${RISK_EXPLAIN[level]}` : a.coordination.coverage_note}
          </p>
          <p className="mt-2 text-sm"><TextLink to={`/ticker/${symbol}/integrity`}>How this was judged</TextLink></p>
        </div>
        <div>
          <h2 className="t-small">Risk flags</h2>
          {a.risk_flags.length === 0 ? (
            <p className="mt-2 text-sm text-text-2">None raised in this window</p>
          ) : (
            <ul className="mt-2 list-none space-y-1 p-0">
              {a.risk_flags.map((f) => <li key={f} className="border-l-2 border-down pl-3 text-sm text-text">{formatRiskFlag(f)}</li>)}
            </ul>
          )}
          <p className="t-small mt-2">Confidence in this reading: {CONFIDENCE_WORDS[a.aggregation_confidence]}</p>
        </div>
      </section>

      <section aria-labelledby="idx-h">
        <h2 id="idx-h" className="t-h2">Narrative indices</h2>
        <p className="t-body mt-2">Each index returns a measured value or says what it is missing. Nothing is filled in.</p>
        <ul className="mt-6 list-none p-0">
          {INDEX_ORDER.map((k) => <IndexRow key={k} k={k} m={a.indices[k]} leading={a.dominant_index === k} />)}
        </ul>
      </section>

      <section aria-labelledby="tr-h" className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <h2 id="tr-h" className="t-h2">How the story changed</h2>
          <p className="t-body mt-2">Window-to-window changes in the narrative: when the leading driver shifted, intensity reversed, or a risk flag appeared.</p>
        </div>
        <Transitions items={a.phylogeny_context} />
      </section>
      <p className="t-small">{postsSince(a.window_start_utc, a.window_end_utc)}.</p>
    </div>
  );
}

export default function AdvancedPage() {
  const symbol = (useParams().symbol ?? "").toUpperCase();
  const known = Boolean(tickerMeta(symbol));
  const outlook = useOutlook(symbol);
  const model = useOutlookModel();
  const adv = useTickerAdvanced(symbol, known);
  if (!known) return <NotFoundPage what={`Diverge doesn't track “${symbol}”.`} />;
  return (
    <div className="page">
      <TickerHeader symbol={symbol} view="advanced" />
      <div className="max-w-[880px] space-y-16 pt-10">
        {outlook.isPending ? <Skeleton className="h-[520px]" label="Loading the outlook" /> : outlook.isError ? (
          <ErrorBlock message={errorMessage(outlook.error)} onRetry={() => void outlook.refetch()} />
        ) : (
          <OutlookPanel o={outlook.data} model={model.data} />
        )}
        <div className="border-t border-line-strong pt-12">
          {adv.isPending ? <Skeleton className="h-[640px]" label="Loading the advanced reading" /> : adv.isError ? (
            <ErrorBlock message={errorMessage(adv.error)} onRetry={() => void adv.refetch()} />
          ) : (
            <Readings a={adv.data} symbol={symbol} />
          )}
        </div>
      </div>
    </div>
  );
}
