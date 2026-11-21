import type { OutlookModelResponse, TickerOutlookResponse } from "@/types/api";
import { Fork } from "@/design-system/charts/Fork";
import { ProbabilityScale } from "@/design-system/charts/ProbabilityScale";
import { DivergingBars } from "@/design-system/charts/DivergingBars";
import { TextLink } from "@/design-system/components/Controls";
import { Unavailable } from "@/design-system/components/States";
import { RiskMeter } from "@/design-system/components/Risk";
import { Term } from "@/design-system/components/Term";
import { leanWords, move, pct, riskFromFlag } from "@/lib/format";
import { edgeNote, headline, moveSentence, trackRecordSentence } from "./words";

export function forkLabel(o: TickerOutlookResponse): string {
  if (!o.available || o.prob_up === null) return `${o.symbol}: no outlook yet. ${o.coverage_note ?? ""}`;
  return `${o.symbol} outlook. ${pct(o.prob_up)} chance of a higher close, ${pct(1 - o.prob_up)} lower. Expected move ${move(o.expected_move_pct)}, typical ${move(o.typical_move_pct)}.`;
}

function Disclaimer({ o }: { o: TickerOutlookResponse }) {
  return (
    <p className="t-small">
      {o.disclaimer} <TextLink to="/model">How accurate is this?</TextLink>
    </p>
  );
}

export function CoordinationNote({ o }: { o: TickerOutlookResponse }) {
  if (o.coordination_dampened) {
    return (
      <div className="border-l-2 border-down pl-4">
        <p className="text-sm font-semibold text-down">Part of this conversation looks coordinated</p>
        <p className="t-small mt-1 text-text-2">
          Many near-identical posts came from different accounts, so this estimate was pulled toward 50/50.
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <RiskMeter level={riskFromFlag(o.coordination_flag)} showWord={false} />
      <p className="t-small text-text-2">
        <Term explain="Coordination risk estimates how likely the posts include a coordinated campaign (copy-paste text from many accounts, scheduled timing). Higher means more likely coordinated.">
          Coordination risk
        </Term>{" "}
        is {riskFromFlag(o.coordination_flag) === "unknown" ? "not measured yet" : riskFromFlag(o.coordination_flag)}
        {o.posts_today !== null ? `, from ${o.posts_today.toLocaleString("en-US")} posts on the day` : ""}.
      </p>
    </div>
  );
}

/** The outlook as a hero: sentence, fork, 50/50 scale, move, drivers, record, disclaimer. */
export function OutlookPanel({ o, model, drivers = true, animate = false }: {
  o: TickerOutlookResponse;
  model: OutlookModelResponse | undefined;
  drivers?: boolean;
  animate?: boolean;
}) {
  if (!o.available || o.prob_up === null) {
    return (
      <section aria-labelledby="outlook-h" className="space-y-5">
        <h2 id="outlook-h" className="t-h2">{headline(o)}</h2>
        <Fork probUp={null} expected={null} typical={null} label={forkLabel(o)} />
        <Unavailable title="Not enough history for a call">
          {o.coverage_note ?? "The model needs more post history for this ticker before it can make a call."}
        </Unavailable>
        <Disclaimer o={o} />
      </section>
    );
  }
  const record = trackRecordSentence(o, model);
  const moveText = moveSentence(o);
  return (
    <section aria-labelledby="outlook-h" className="space-y-7">
      <div>
        <p className="text-sm text-text-2">{leanWords(o)}. {edgeNote(o.prob_up)}</p>
        <h2 id="outlook-h" className="t-h1 mt-1">{headline(o)}.</h2>
      </div>
      <div className="max-w-[620px]">
        <Fork probUp={o.prob_up} expected={o.expected_move_pct} typical={o.typical_move_pct} label={forkLabel(o)} animate={animate} />
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
        <ProbabilityScale p={o.prob_up} />
        {moveText && <p className="text-[0.9375rem] leading-relaxed text-text">{moveText}</p>}
      </div>
      <CoordinationNote o={o} />
      {drivers && (o.direction_drivers.length > 0 || o.move_drivers.length > 0) && (
        <div className="grid max-w-[640px] gap-10 border-t border-line pt-6">
          {o.direction_drivers.length > 0 && (
            <div>
              <h3 className="t-h3 mb-4">What moves the up/down estimate</h3>
              <DivergingBars
                items={o.direction_drivers.map((d) => ({ key: d.feature, label: d.label, value: d.contribution, tag: d.kind === "narrative" ? "social" : "price" }))}
              />
            </div>
          )}
          {o.move_drivers.length > 0 && (
            <div>
              <h3 className="t-h3 mb-4">What moves the size estimate</h3>
              <DivergingBars
                upWord="bigger"
                downWord="smaller"
                items={o.move_drivers.map((d) => ({ key: d.feature, label: d.label, value: d.contribution, tag: d.kind === "narrative" ? "social" : "price" }))}
              />
            </div>
          )}
        </div>
      )}
      <div className="space-y-2 border-t border-line pt-5">
        {record && <p className="text-sm text-text">{record}</p>}
        <Disclaimer o={o} />
      </div>
    </section>
  );
}
