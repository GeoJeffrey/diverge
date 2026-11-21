import { Link } from "react-router";
import type { CallTier, OutlookDriver, OutlookModelResponse, TickerOutlookResponse } from "@/types/api";

const UP = "#2d5a34";
const DOWN = "#7a2e1a";
const NEUTRAL = "#555";

export function leanText(o: Pick<TickerOutlookResponse, "lean" | "lean_strength">): string {
  if (!o.lean || o.lean === "neutral") return "No clear lean";
  const dir = o.lean === "up" ? "up" : "down";
  return o.lean_strength === "slight" ? `Slight lean ${dir}` : `Leans ${dir}`;
}

export function leanColor(lean: string | null): string {
  return lean === "up" ? UP : lean === "down" ? DOWN : NEUTRAL;
}

const MOVE_TEXT: Record<string, string> = {
  larger_than_usual: "Bigger move than usual expected",
  typical: "Typical-sized move expected",
  smaller_than_usual: "Quieter than usual expected",
  unknown: "Move size unknown",
};

function pct(v: number | null | undefined, digits = 0): string {
  return v === null || v === undefined ? "—" : `${(100 * v).toFixed(digits)}%`;
}

export function LeanPill({ outlook }: { outlook: TickerOutlookResponse }) {
  if (!outlook.available || outlook.prob_up === null) {
    return <span className="text-xs text-[#6b6b6b]">Not available</span>;
  }
  const color = leanColor(outlook.lean);
  const arrow = outlook.lean === "up" ? "▲" : outlook.lean === "down" ? "▼" : "•";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color }}>
      <span aria-hidden="true">{arrow}</span>
      {leanText(outlook)}
      <span className="font-normal text-[#6b6b6b] tabular-nums">· {pct(outlook.prob_up)} up</span>
    </span>
  );
}

function DriverList({ drivers, title }: { drivers: OutlookDriver[]; title: string }) {
  if (drivers.length === 0) return null;
  const max = Math.max(...drivers.map((d) => Math.abs(d.contribution)), 1e-9);
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">{title}</p>
      <ul className="space-y-2">
        {drivers.map((d) => (
          <li key={d.feature} className="flex items-center gap-3">
            <span className="w-44 shrink-0 text-sm">
              {d.label}
              {d.kind === "narrative" && (
                <span className="ml-1.5 rounded bg-[#f3ead4] px-1.5 py-0.5 text-[10px] font-semibold text-[#6a5208]">social</span>
              )}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded bg-[#f0ede8]" aria-hidden="true">
              <span
                className="block h-full rounded"
                style={{ width: `${(100 * Math.abs(d.contribution)) / max}%`, background: d.pushes === "up" ? UP : DOWN }}
              />
            </span>
            <span className="w-16 text-right text-xs font-semibold" style={{ color: d.pushes === "up" ? UP : DOWN }}>
              {d.pushes === "up" ? "pushes ▲" : "pushes ▼"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function trackRecordLine(o: TickerOutlookResponse, model: OutlookModelResponse | null): string | null {
  const tr = model?.track_record?.direction;
  if (!tr) return null;
  const tier: CallTier | undefined =
    o.lean_strength === "lean" ? tr.lean_calls : o.lean_strength === "slight" ? tr.slight_calls : tr.no_call;
  if (!tier || tier.accuracy === null) return null;
  const kind = o.lean_strength === "lean" ? "“Leans”" : o.lean_strength === "slight" ? "“Slight lean”" : "“No clear lean”";
  return `${kind} calls were right ${pct(tier.accuracy, 1)} of the time in out-of-sample testing (${tier.days.toLocaleString()} days; always guessing “up” scored ${pct(tr.always_up_accuracy, 1)}).`;
}

export function OutlookCard({
  outlook,
  model,
  compact = false,
}: {
  outlook: TickerOutlookResponse;
  model: OutlookModelResponse | null;
  compact?: boolean;
}) {
  if (!outlook.available || outlook.prob_up === null) {
    return (
      <section className="rounded-xl border border-dashed border-[#c9b8a4] bg-[#f8f4ee] p-5" aria-labelledby="outlook-title">
        <h3 id="outlook-title" className="text-sm font-semibold text-ink">
          Next-day outlook: not available yet
        </h3>
        <p className="mt-1 text-sm text-[#5c4a3c]">{outlook.coverage_note ?? "No outlook has been computed for this ticker."}</p>
      </section>
    );
  }

  const color = leanColor(outlook.lean);
  const record = trackRecordLine(outlook, model);
  const ratio =
    outlook.expected_move_pct !== null && outlook.typical_move_pct
      ? outlook.expected_move_pct / outlook.typical_move_pct
      : null;

  return (
    <section className="rounded-xl border border-[#e7e1d8] bg-white p-5" aria-labelledby="outlook-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">
            Next-day outlook{outlook.as_of_day ? ` · after ${outlook.as_of_day} close` : ""}
          </p>
          <h3 id="outlook-title" className="mt-1 text-2xl font-bold" style={{ color, letterSpacing: "-0.02em" }}>
            {leanText(outlook)}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums" style={{ color }}>
            {pct(outlook.prob_up)}
          </p>
          <p className="text-xs text-[#6b6b6b]">chance of closing higher</p>
        </div>
      </div>

      <div className="mt-4" aria-hidden="true">
        <div className="relative h-2.5 overflow-hidden rounded-full" style={{ background: `linear-gradient(90deg, ${DOWN}33, #eee 50%, ${UP}33)` }}>
          <span className="absolute top-0 h-full w-0.5 bg-[#999]" style={{ left: "50%" }} />
          <span
            className="absolute -top-0.5 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${100 * outlook.prob_up}%`, background: color }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-[#888]">
          <span>Down</span>
          <span>50 / 50</span>
          <span>Up</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-[#faf7f2] p-3">
          <p className="text-sm font-semibold">{MOVE_TEXT[outlook.move_label ?? "unknown"]}</p>
          <p className="mt-1 text-xs text-[#555] tabular-nums">
            Expected ±{outlook.expected_move_pct?.toFixed(2)}% vs typical ±{outlook.typical_move_pct?.toFixed(2)}%
            {ratio !== null && ` (${ratio.toFixed(1)}×)`}
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ background: outlook.coordination_dampened ? "#f3e4dc" : "#eef0f6" }}>
          {outlook.coordination_dampened ? (
            <>
              <p className="text-sm font-semibold text-[#7a2e1a]">Coordination warning</p>
              <p className="mt-1 text-xs text-[#5c4a3c]">
                The conversation looks partly coordinated, so this estimate was pulled toward 50/50.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-[#3d4a66]">Conversation looks organic</p>
              <p className="mt-1 text-xs text-[#4a5568]">
                No sign of copy-paste campaigns{outlook.posts_today !== null ? ` · ${outlook.posts_today} posts on the day` : ""}.
              </p>
            </>
          )}
        </div>
      </div>

      {!compact && (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <DriverList drivers={outlook.direction_drivers} title="What moves the up/down estimate" />
          <DriverList drivers={outlook.move_drivers} title="What moves the size estimate" />
        </div>
      )}

      <div className="mt-5 border-t border-[#f0ede8] pt-3 text-xs leading-relaxed text-[#6b6b6b]">
        {record && <p className="mb-1">{record}</p>}
        <p>
          {outlook.disclaimer}{" "}
          <Link to="/model" className="font-semibold text-terracotta">
            How accurate is this?
          </Link>
        </p>
      </div>
    </section>
  );
}
