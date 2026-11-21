import { useEffect, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { api, ApiError } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/StatusStates";
import type { OutlookModelResponse } from "@/types/api";

function pct(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined ? "—" : `${(100 * v).toFixed(digits)}%`;
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <article className="rounded-xl border border-[#e7e1d8] bg-white p-4">
      <p className="text-xs text-[#6b6b6b]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-[#6b6b6b]">{note}</p>}
    </article>
  );
}

export default function ModelCardPage() {
  const [model, setModel] = useState<OutlookModelResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setModel(await api.outlookModel());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load the model card.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <LoadingState label="Loading model card…" />;
  if (error || !model) return <ErrorState message={error ?? "Missing model card."} onRetry={() => void load()} />;
  if (!model.available) {
    return (
      <div className="px-4 py-5 md:px-7">
        <EmptyState
          title="The outlook model has not been trained yet"
          body="Run python -m diverge.evaluation.run_all to train it and record its track record."
        />
      </div>
    );
  }

  const tr = model.track_record;
  const d = tr.direction;
  const m = tr.move;
  const calibration = (d?.calibration ?? []).map((c) => ({
    predicted: +(100 * c.mean_predicted).toFixed(1),
    actual: +(100 * c.actual_up_rate).toFixed(1),
    days: c.days,
  }));
  const features = [...model.features].sort((a, b) => Math.abs(b.direction_weight) - Math.abs(a.direction_weight));
  const maxW = Math.max(...features.map((f) => Math.abs(f.direction_weight)), 1e-9);

  return (
    <div className="px-4 py-5 md:px-7">
      <div className="mb-5">
        <h2 className="text-lg font-bold" style={{ letterSpacing: "-0.02em" }}>
          How accurate is the next-day outlook?
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-[#555]">
          Every number below comes from walk-forward testing: the model was trained only on earlier years and scored on
          later years it had never seen ({tr.test_period}, {tr.test_days?.toLocaleString()} ticker-days,{" "}
          {tr.tickers?.join(", ")}). Trained on {model.training_data.ticker_days?.toLocaleString()} ticker-days from{" "}
          {model.training_data.source}.
        </p>
      </div>

      <h3 className="mb-2 text-base font-bold">Up / down</h3>
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <Stat label="Accuracy, all days" value={pct(d?.accuracy)} note={`Always guessing “up”: ${pct(d?.always_up_accuracy)}`} />
        <Stat label="Accuracy when it “leans”" value={pct(d?.lean_calls.accuracy)} note={`Issued on ${pct(d?.lean_calls.share_of_days, 0)} of days`} />
        <Stat label="ROC-AUC" value={d ? d.auc.toFixed(3) : "—"} note="0.5 = coin flip" />
        <Stat label="Brier score" value={d ? d.brier.toFixed(4) : "—"} note="Lower is better; 0.25 = always 50%" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-[#e7e1d8] bg-white p-5">
          <p className="text-sm font-semibold">Calibration: when it says X%, does it happen X% of the time?</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={calibration} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="#f0ede8" />
                <XAxis dataKey="predicted" type="number" domain={[30, 70]} unit="%" tick={{ fontSize: 11 }} name="Predicted" />
                <YAxis type="number" domain={[30, 70]} unit="%" tick={{ fontSize: 11 }} name="Actual" />
                <Tooltip formatter={(v: unknown) => `${String(v)}%`} />
                <Line dataKey="predicted" stroke="#bbb" dot={false} strokeDasharray="4 4" name="Perfect calibration" isAnimationActive={false} />
                <Scatter dataKey="actual" fill="#c4510b" name="Actual up-rate" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-[#6b6b6b]">Each dot groups 20% of test days by predicted probability.</p>
        </article>

        <article className="rounded-xl border border-[#e7e1d8] bg-white p-5">
          <p className="text-sm font-semibold">Move size</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="R², with social signals" value={m ? m.oos_r2.toFixed(3) : "—"} />
            <Stat label="R², prices only" value={m ? m.oos_r2_price_only.toFixed(3) : "—"} />
          </div>
          <p className="mt-4 text-sm">
            “Bigger move than usual” calls were right{" "}
            <strong>{pct(m?.larger_than_usual_calls.precision)}</strong> of the time, versus a base rate of{" "}
            {pct(m?.larger_than_usual_calls.base_rate)}.
          </p>
        </article>
      </div>

      <h3 className="mb-2 text-base font-bold">What the model looks at</h3>
      <div className="mb-6 overflow-x-auto rounded-xl border border-[#e7e1d8] bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#f0ede8] text-xs text-[#6b6b6b]">
              <th className="px-5 py-3 font-semibold">Signal</th>
              <th className="px-5 py-3 font-semibold">Source</th>
              <th className="px-5 py-3 font-semibold">Effect on “up” probability</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.feature} className="border-t border-[#f0ede8]">
                <td className="px-5 py-3">{f.label}</td>
                <td className="px-5 py-3 text-xs text-[#6b6b6b]">{f.kind === "narrative" ? "Social media" : "Price"}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-40 overflow-hidden rounded bg-[#f0ede8]" aria-hidden="true">
                      <span
                        className="block h-full"
                        style={{
                          width: `${(100 * Math.abs(f.direction_weight)) / maxW}%`,
                          background: f.direction_weight >= 0 ? "#2d5a34" : "#7a2e1a",
                        }}
                      />
                    </span>
                    <span className="text-xs tabular-nums text-[#555]">
                      {f.direction_weight >= 0 ? "+" : ""}
                      {f.direction_weight.toFixed(3)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="max-w-3xl text-xs leading-relaxed text-[#6b6b6b]">
        {model.disclaimer} Model version {model.version}, trained {model.trained_at?.slice(0, 10)} with the{" "}
        {model.training_data.sentiment_model} sentiment model. Live tickers include NSE stocks, while the historical test
        covered US large caps, so live accuracy may differ.
      </p>
    </div>
  );
}
