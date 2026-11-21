import { pct } from "@/lib/format";

/**
 * Reliability diagram (what weather forecasters call forecast verification): each dot groups test
 * days by the predicted chance of a higher close; a perfectly calibrated model sits on the diagonal.
 * Both axes share one range so the diagonal is a true 45° line and gaps are not exaggerated.
 */
export interface CalibrationBin {
  mean_predicted: number;
  actual_up_rate: number;
  days: number;
}

export function Calibration({ bins, baseline }: { bins: CalibrationBin[]; baseline?: number }) {
  const W = 420, H = 420, P = { l: 52, r: 16, t: 16, b: 44 };
  const lo = 0.35, hi = 0.65;
  const x = (v: number) => P.l + ((v - lo) / (hi - lo)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - ((v - lo) / (hi - lo)) * (H - P.t - P.b);
  const ticks = [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65];
  const maxDays = Math.max(...bins.map((b) => b.days), 1);
  const summary = bins
    .map((b) => `predicted ${pct(b.mean_predicted, 1)}, actually higher ${pct(b.actual_up_rate, 1)} over ${b.days} days`)
    .join("; ");

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full max-w-[460px]" role="img"
        aria-label={`Calibration of the up/down estimate. ${summary}.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={y(lo)} y2={y(hi)} stroke="var(--line)" />
            <line x1={x(lo)} x2={x(hi)} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={x(t)} y={H - P.b + 18} textAnchor="middle" fontSize="12" fill="var(--text-3)" className="t-num">{pct(t)}</text>
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--text-3)" className="t-num">{pct(t)}</text>
          </g>
        ))}
        <line x1={x(lo)} y1={y(lo)} x2={x(hi)} y2={y(hi)} stroke="var(--text-3)" strokeDasharray="4 5" />
        <text x={x(0.63)} y={y(0.63) + 18} textAnchor="end" fontSize="12" fill="var(--text-3)">perfect calibration</text>
        {baseline !== undefined && (
          <>
            <line x1={x(lo)} x2={x(hi)} y1={y(baseline)} y2={y(baseline)} stroke="var(--text-2)" strokeWidth="1" />
            <text x={x(lo) + 6} y={y(baseline) - 6} fontSize="12" fill="var(--text-2)">{`share of up days ${pct(baseline, 1)}`}</text>
          </>
        )}
        {bins.map((b, i) => (
          <circle key={i} cx={x(b.mean_predicted)} cy={y(b.actual_up_rate)} r={4 + 5 * Math.sqrt(b.days / maxDays)}
            fill="var(--up)" fillOpacity="0.85" stroke="var(--bg)" strokeWidth="1.5" />
        ))}
        <text x={(x(lo) + x(hi)) / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--text-2)">Predicted chance of a higher close</text>
        <text transform={`translate(14 ${(y(lo) + y(hi)) / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill="var(--text-2)">How often it closed higher</text>
      </svg>
    </figure>
  );
}
