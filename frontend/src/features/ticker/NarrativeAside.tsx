import { useTickerSimple } from "@/lib/queries";
import { postsSince, riskFromTrustLabel } from "@/lib/format";
import { RiskMeter } from "@/design-system/components/Risk";
import { Skeleton } from "@/design-system/components/States";
import { Term } from "@/design-system/components/Term";
import { TextLink } from "@/design-system/components/Controls";
import { labelForVerdict } from "@/lib/labels";

/** The conversation reading beside the outlook: narrative intensity, verdict, coordination risk. */
export function NarrativeAside({ symbol }: { symbol: string }) {
  const q = useTickerSimple(symbol);
  if (q.isPending) return <Skeleton className="h-64" label="Loading the conversation reading" />;
  if (q.isError) {
    return <p className="t-small">The conversation reading didn't load. The outlook beside it is unaffected.</p>;
  }
  const t = q.data;
  const hasScore = t.score !== null;
  return (
    <aside aria-labelledby="conv-h" className="space-y-6">
      <h2 id="conv-h" className="t-h3">The conversation</h2>
      <div>
        <p className="t-small">
          <Term explain="How strong the conversation is right now, from 0 to 100: volume, spread to new voices and agreement. It measures loudness, not direction.">
            Narrative intensity
          </Term>
        </p>
        {hasScore ? (
          <p className="mt-1 flex items-baseline gap-3">
            <span className="t-num text-[2.5rem] font-semibold leading-none tracking-[-0.03em]">{t.score!.toFixed(1)}</span>
            <span className="text-sm text-text-2">of 100, {labelForVerdict(t.verdict_label).toLowerCase()}</span>
          </p>
        ) : (
          <p className="hatch mt-2 border border-dashed border-line-strong px-3 py-2 text-sm text-text-2">Not enough posts in this window</p>
        )}
      </div>
      {hasScore && <p className="text-[0.9375rem] leading-relaxed text-text">{t.why_sentence}</p>}
      <div>
        <p className="t-small mb-1.5">Coordination risk</p>
        <RiskMeter level={hasScore ? riskFromTrustLabel(t.trust_label) : "unknown"} />
      </div>
      <p className="t-small">{postsSince(t.window_start_utc)}</p>
      <p className="text-sm">
        <TextLink to={`/ticker/${symbol}/why`}>See the posts behind this reading</TextLink>
      </p>
    </aside>
  );
}
