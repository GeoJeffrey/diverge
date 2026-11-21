import { useOutlookModel, errorMessage } from "@/lib/queries";
import { Calibration } from "@/design-system/charts/Calibration";
import { CompareBars } from "@/design-system/charts/CompareBars";
import { DivergingBars } from "@/design-system/charts/DivergingBars";
import { ErrorBlock, Skeleton, Unavailable } from "@/design-system/components/States";
import { Term } from "@/design-system/components/Term";
import { ExternalLink, TextLink } from "@/design-system/components/Controls";
import { dateTime, pct } from "@/lib/format";
import { REPO_URL } from "@/app/Shell";

function Section({ id, title, intro, children }: { id: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-6 border-t border-line py-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
      <div>
        <h2 id={id} className="t-h2">{title}</h2>
        {intro && <div className="t-body mt-3">{intro}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function ModelPage() {
  const q = useOutlookModel();

  if (q.isPending) {
    // The headline is static, so it shows at once; only the data-driven intro waits.
    // Keep in step with the "/model" fragment in prerender-shell.ts.
    return (
      <div className="page">
        <header className="max-w-[880px] pb-10 pt-12">
          <h1 className="t-display">Checked against days it had never seen.</h1>
          <Skeleton className="mt-6 h-16 max-w-[62ch]" label="Loading the track record" />
        </header>
      </div>
    );
  }
  if (q.isError) {
    return <div className="page pt-12"><ErrorBlock message={errorMessage(q.error)} onRetry={() => void q.refetch()} /></div>;
  }
  const m = q.data;
  if (!m.available || !m.track_record.direction || !m.track_record.move) {
    return (
      <div className="page pt-12">
        <h1 className="t-h1">How accurate is the next-day outlook?</h1>
        <Unavailable title="The outlook model hasn't been trained yet" className="mt-8 max-w-[60ch]">
          Until it is, there are no calls and no track record to show. It is trained with{" "}
          <code className="t-num">python -m diverge.evaluation.run_all</code>.
        </Unavailable>
      </div>
    );
  }

  const tr = m.track_record;
  const d = tr.direction!;
  const mv = tr.move!;
  const big = mv.larger_than_usual_calls;
  const leanBeatsBaseline = (d.lean_calls.accuracy ?? 0) > d.always_up_accuracy;
  const features = [...m.features].sort((a, b) => Math.abs(b.direction_weight) - Math.abs(a.direction_weight));
  const moveFeatures = [...m.features].sort((a, b) => Math.abs(b.move_weight) - Math.abs(a.move_weight)).slice(0, 8);

  return (
    <div className="page">
      <header className="max-w-[880px] pb-10 pt-12">
        <h1 className="t-display">Checked against days it had never seen.</h1>
        <p className="t-lead mt-6">
          The outlook was trained only on earlier years and scored on later ones, {tr.test_period}:{" "}
          {tr.test_days?.toLocaleString("en-US")} ticker-days of {tr.tickers?.join(", ")}. These are its results, good and bad.
        </p>
      </header>

      <Section
        id="direction"
        title="Up or down: close to a coin flip"
        intro={
          <>
            <p>
              On all test days the call was right {pct(d.accuracy, 1)} of the time. Always guessing “up” would have scored{" "}
              {pct(d.always_up_accuracy, 1)}.{" "}
              {leanBeatsBaseline
                ? "Clear leans did slightly better than that baseline."
                : "Even its clearer leans did not beat that simple baseline."}
            </p>
            <p className="mt-3">
              <Term explain="ROC-AUC measures how well the estimate ranks up days above down days. 0.5 is a coin flip, 1.0 is perfect.">ROC-AUC</Term>{" "}
              is <span className="t-num">{d.auc.toFixed(3)}</span> (0.5 is a coin flip).{" "}
              <Term explain="Brier score is the average squared error of the probability. Always saying 50% scores 0.25; lower is better.">Brier score</Term>{" "}
              is <span className="t-num">{d.brier.toFixed(4)}</span> (always saying 50% scores 0.25).
            </p>
          </>
        }
      >
        <CompareBars
          reference={d.always_up_accuracy}
          referenceLabel="Always guessing “up”"
          rows={[
            { key: "lean", label: "“Leans” calls", value: d.lean_calls.accuracy ?? 0, emphasis: true, note: `Issued on ${pct(d.lean_calls.share_of_days)} of days (${d.lean_calls.days.toLocaleString("en-US")})` },
            { key: "slight", label: "“Slight lean” calls", value: d.slight_calls.accuracy ?? 0, note: `Issued on ${pct(d.slight_calls.share_of_days)} of days (${d.slight_calls.days.toLocaleString("en-US")})` },
            { key: "none", label: "No clear lean", value: d.no_call.accuracy ?? 0, note: `${pct(d.no_call.share_of_days)} of days (${d.no_call.days.toLocaleString("en-US")})` },
            { key: "all", label: "All days", value: d.accuracy },
          ]}
        />
      </Section>

      <Section
        id="calibration"
        title="When it says 55%, does it happen 55% of the time?"
        intro={
          <p>
            Forecasters call this verification. Each dot groups a fifth of the test days by the predicted chance of a higher
            close. Dots on the dashed diagonal would mean the percentages can be taken at face value; dots that stay level
            show the estimate barely separates up days from down days.
          </p>
        }
      >
        <Calibration bins={d.calibration} />
      </Section>

      <Section
        id="move"
        title="Move size: where the social signal helps"
        intro={
          <p>
            Predicting how big tomorrow's move will be is easier than predicting its direction. Adding social signals to
            price history raised the share of move-size variation explained from {pct(mv.oos_r2_price_only, 1)} to{" "}
            {pct(mv.oos_r2, 1)}.
          </p>
        }
      >
        <CompareBars
          max={Math.max(mv.oos_r2, mv.oos_r2_price_only) * 1.25}
          rows={[
            { key: "price", label: "Price history only", value: mv.oos_r2_price_only },
            { key: "social", label: "Price history plus social signals", value: mv.oos_r2, emphasis: true },
          ]}
        />
        <p className="mt-8 text-[0.9375rem] leading-relaxed text-text">
          “Bigger move than usual” calls were right {pct(big.precision, 1)} of the time, against {pct(big.base_rate, 1)} for
          an average day{big.precision && big.base_rate ? ` (${(big.precision / big.base_rate).toFixed(2)}× as often)` : ""}. They
          were issued on {pct(big.share_of_days)} of days.
        </p>
      </Section>

      <Section
        id="weights"
        title="What the model looks at"
        intro={
          <p>
            Weights from the up/down model, on standardised inputs. Longer bars move the estimate more. Social signals are
            marked; the rest come from prices.
          </p>
        }
      >
        <DivergingBars
          items={features.map((f) => ({ key: f.feature, label: f.label, value: f.direction_weight, tag: f.kind === "narrative" ? "social" : undefined }))}
        />
        <h3 className="t-h3 mb-4 mt-12">Strongest inputs to the move-size estimate</h3>
        <DivergingBars
          upWord="bigger"
          downWord="smaller"
          items={moveFeatures.map((f) => ({ key: f.feature, label: f.label, value: f.move_weight, tag: f.kind === "narrative" ? "social" : undefined }))}
        />
      </Section>

      <section aria-labelledby="data-h" className="border-t border-line py-12">
        <h2 id="data-h" className="t-h3">Model and data</h2>
        <dl className="mt-4 grid max-w-[720px] grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm">
          <dt className="text-text-3">Version</dt><dd className="t-num">{m.version}</dd>
          <dt className="text-text-3">Trained</dt><dd>{dateTime(m.trained_at)}</dd>
          <dt className="text-text-3">Training data</dt>
          <dd>{m.training_data.source}, {m.training_data.ticker_days?.toLocaleString("en-US")} ticker-days ({m.training_data.first_day} to {m.training_data.last_day})</dd>
        </dl>
        <p className="t-small mt-6 max-w-[70ch]">
          {m.disclaimer} The full evaluation, including the backtest and its limits, is reproducible from the{" "}
          <ExternalLink href={REPO_URL}>source code</ExternalLink>. <TextLink to="/method">How the pipeline works</TextLink>.
        </p>
      </section>
    </div>
  );
}
