import { useParams } from "react-router";
import type { ReasoningTraceItem } from "@/types/api";
import { useReasoning, errorMessage } from "@/lib/queries";
import { ErrorBlock, Skeleton, Unavailable } from "@/design-system/components/States";
import { dateTime } from "@/lib/format";
import { explainReasoningCategory, labelForPlatform, labelForReasoningCategory } from "@/lib/labels";
import { tickerMeta } from "@/lib/markets";
import NotFoundPage from "@/features/system/NotFoundPage";
import { TickerHeader } from "./TickerHeader";

const ORDER = ["rn_onset", "duplicate_flag", "cli_capitulation", "cassi_sentiment", "vdi_divergence", "sentiment_variance_outlier"];

export function PostRow({ p, maxWeight }: { p: ReasoningTraceItem; maxWeight: number }) {
  return (
    <li className="grid gap-x-6 gap-y-2 border-t border-line py-4 md:grid-cols-[minmax(0,1fr)_9rem]">
      <div className="min-w-0">
        <p className="t-small">
          <span className="t-num text-text-2">{p.account_id}</span> on {labelForPlatform(p.platform)}
          {p.upvotes > 0 ? `, ${p.upvotes.toLocaleString("en-US")} upvotes` : ""}
        </p>
        <p className="mt-1 text-[0.9375rem] leading-relaxed text-text [overflow-wrap:anywhere]">{p.text_preview}</p>
      </div>
      <div className="md:text-right" aria-label={`Weight ${p.weight.toFixed(2)}`}>
        <span className="t-small">weight </span>
        <span className="t-num text-sm text-text">{p.weight.toFixed(2)}</span>
        <span className="mt-1.5 block h-1.5 rounded-full bg-sunk" aria-hidden="true">
          <span className="block h-full rounded-full bg-text-2" style={{ width: `${(p.weight / maxWeight) * 100}%` }} />
        </span>
      </div>
    </li>
  );
}

export default function WhyPage() {
  const symbol = (useParams().symbol ?? "").toUpperCase();
  const known = Boolean(tickerMeta(symbol));
  const q = useReasoning(symbol, known);
  if (!known) return <NotFoundPage what={`Diverge doesn't track “${symbol}”.`} />;

  const cats = q.data
    ? Object.entries(q.data.categories)
        .filter((e): e is [string, ReasoningTraceItem[]] => Array.isArray(e[1]) && e[1].length > 0)
        .sort((a, b) => (ORDER.indexOf(a[0]) + 99) % 99 - (ORDER.indexOf(b[0]) + 99) % 99)
    : [];
  const maxWeight = Math.max(...cats.flatMap(([, v]) => v.map((p) => p.weight)), 1e-9);

  return (
    <div className="page">
      <TickerHeader symbol={symbol} view="why" />
      <div className="max-w-[880px] pt-10">
        <h2 className="t-h1">The posts behind the reading</h2>
        <p className="t-body mt-3">
          The posts that moved {symbol}'s narrative reading most, grouped by what they contributed. Weight is each post's share
          of influence on its signal.
        </p>
        {q.isPending && <Skeleton className="mt-10 h-[520px]" label="Loading posts" />}
        {q.isError && <div className="mt-10"><ErrorBlock message={errorMessage(q.error)} onRetry={() => void q.refetch()} /></div>}
        {q.data && (
          <>
            <p className="t-small mt-4">
              {q.data.total_traces.toLocaleString("en-US")} posts{q.data.window_start_utc ? `, window starting ${dateTime(q.data.window_start_utc)}` : ""}.
            </p>
            {cats.length === 0 ? (
              <Unavailable title="No posts recorded for this window" className="mt-10">Readings with too few posts don't keep a reasoning trail.</Unavailable>
            ) : (
              cats.map(([key, posts]) => (
                <section key={key} aria-labelledby={`cat-${key}`} className="mt-12">
                  <h3 id={`cat-${key}`} className="t-h3">{labelForReasoningCategory(key)}</h3>
                  {explainReasoningCategory(key) && <p className="t-small mt-1">{explainReasoningCategory(key)}</p>}
                  <ul className="mt-3 list-none p-0">
                    {posts.map((p) => <PostRow key={p.trace_id} p={p} maxWeight={maxWeight} />)}
                  </ul>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
