import { useParams } from "react-router";
import type { ReasoningTraceItem } from "@/types/api";
import { useReasoning, useTickerAdvanced, errorMessage } from "@/lib/queries";
import { ErrorBlock, Skeleton, Unavailable } from "@/design-system/components/States";
import { RiskMeter } from "@/design-system/components/Risk";
import { TextLink } from "@/design-system/components/Controls";
import { RISK_EXPLAIN, riskFromFlag } from "@/lib/format";
import { labelForPlatform } from "@/lib/labels";
import { tickerMeta } from "@/lib/markets";
import NotFoundPage from "@/features/system/NotFoundPage";
import { TickerHeader } from "./TickerHeader";

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Highlight words a post shares with the other posts in its near-duplicate cluster. */
function SharedText({ text, others }: { text: string; others: Set<string> }) {
  // Merge consecutive shared words (and the spaces between them) into one highlighted phrase.
  const runs: { shared: boolean; text: string }[] = [];
  const tokens = text.split(/(\s+)/);
  tokens.forEach((tok, i) => {
    const isSpace = /^\s+$/.test(tok);
    const shared = isSpace
      ? Boolean(runs.at(-1)?.shared) && others.has(norm(tokens[i + 1] ?? ""))
      : norm(tok) !== "" && others.has(norm(tok));
    const last = runs.at(-1);
    if (last && last.shared === shared) last.text += tok;
    else runs.push({ shared, text: tok });
  });
  return (
    <>
      {runs.map((r, i) => (r.shared ? <mark key={i} className="bg-down-soft text-text">{r.text}</mark> : <span key={i}>{r.text}</span>))}
    </>
  );
}

function Cluster({ posts }: { posts: ReasoningTraceItem[] }) {
  const words = posts.map((p) => new Set(p.text_preview.split(/\s+/).map(norm).filter(Boolean)));
  return (
    <figure>
      <ul className="list-none space-y-3 p-0">
        {posts.map((p, i) => {
          const others = new Set<string>();
          words.forEach((w, j) => j !== i && w.forEach((x) => others.add(x)));
          return (
            <li key={p.trace_id} className="border-l-2 border-down pl-4" style={{ marginLeft: Math.min(i, 3) * 12 }}>
              <p className="t-small"><span className="t-num">{p.account_id}</span> on {labelForPlatform(p.platform)}</p>
              <p className="mt-0.5 text-[0.9375rem] text-text [overflow-wrap:anywhere]"><SharedText text={p.text_preview} others={others} /></p>
            </li>
          );
        })}
      </ul>
      <figcaption className="t-small mt-3">Highlighted words also appear in the other posts of this cluster, written by different accounts.</figcaption>
    </figure>
  );
}

export default function IntegrityPage() {
  const symbol = (useParams().symbol ?? "").toUpperCase();
  const known = Boolean(tickerMeta(symbol));
  const adv = useTickerAdvanced(symbol, known);
  const why = useReasoning(symbol, known);
  if (!known) return <NotFoundPage what={`Diverge doesn't track “${symbol}”.`} />;

  const c = adv.data?.coordination;
  const level = c?.available ? riskFromFlag(c.confidence_flag) : "unknown";
  const dups = why.data?.categories.duplicate_flag ?? [];

  return (
    <div className="page">
      <TickerHeader symbol={symbol} view="integrity" />
      <div className="grid gap-14 pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
        <section aria-labelledby="risk-h">
          <h2 id="risk-h" className="t-h1">Is this conversation organic?</h2>
          {adv.isPending && <Skeleton className="mt-8 h-40" label="Loading the coordination reading" />}
          {adv.isError && <div className="mt-8"><ErrorBlock message={errorMessage(adv.error)} onRetry={() => void adv.refetch()} /></div>}
          {c && (
            <div className="mt-8">
              <p className="t-small">Coordination risk</p>
              <div className="mt-2 flex items-baseline gap-4">
                <RiskMeter level={level} />
                {c.available && <span className="t-num text-sm text-text-2">score {c.coordination_score.toFixed(1)} of 100</span>}
              </div>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-text">{c.available ? RISK_EXPLAIN[level] : c.coverage_note}</p>
            </div>
          )}
          <div className="t-body mt-10 space-y-4">
            <p>
              Coordination risk is the model's probability, from 0 to 100, that a window contains a coordinated campaign. Higher
              means more likely coordinated. It is not a bullish or bearish signal.
            </p>
            <p>
              The strongest evidence is copy-paste: near-identical text posted by different accounts, found with MinHash
              near-duplicate search. The score also looks at timing (posts arriving on a schedule rather than at random), how
              spread out first mentions are, how uniform the sentiment is, whether there was a news event, and volume.
            </p>
            <p>
              When risk is high, the next-day outlook is pulled toward 50/50 so a campaign can't steer it.
            </p>
            <p className="t-small">
              Per-window timing statistics aren't published by the API, so they aren't drawn here. The detector was trained on
              simulated campaigns; <TextLink to="/method">its limits</TextLink> are on the method page.
            </p>
          </div>
        </section>

        <section aria-labelledby="dup-h">
          <h2 id="dup-h" className="t-h2">Copy-paste in this window</h2>
          <div className="mt-6">
            {why.isPending && <Skeleton className="h-64" label="Loading near-duplicate posts" />}
            {why.isError && <ErrorBlock message={errorMessage(why.error)} onRetry={() => void why.refetch()} />}
            {why.data && (dups.length >= 2 ? (
              <Cluster posts={dups} />
            ) : dups.length === 1 ? (
              <Unavailable title="One flagged post, no cluster">A single near-duplicate isn't a campaign; its match fell outside the posts kept for this window.</Unavailable>
            ) : (
              <Unavailable title="No near-duplicate posts found">The posts in this window were written independently, as far as the detector can tell.</Unavailable>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
