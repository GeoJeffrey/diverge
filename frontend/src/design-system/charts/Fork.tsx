import { useId } from "react";
import { pct } from "@/lib/format";

/**
 * The Fork: Diverge's signature chart. A line splits at "tomorrow" into an up and a down branch.
 *  - branch thickness  = probability of that direction (a 53/47 call looks nearly symmetric)
 *  - spread of the fork = expected move size (±%)
 *  - dashed ghost fork  = the ticker's typical move, for comparison
 * It deliberately has no price axis: it is a probability picture, not a price forecast.
 */
export interface ForkProps {
  probUp: number | null;
  expected: number | null;
  typical: number | null;
  size?: "hero" | "card" | "glyph";
  /** Short text for screen readers; the visible labels carry the same numbers. */
  label: string;
  /** Draw-in animation (once). Disabled automatically for reduced motion via CSS. */
  animate?: boolean;
}

const DIMS = {
  hero: { w: 560, h: 300, split: 0.5, max: 16, min: 2, labels: true },
  card: { w: 480, h: 220, split: 0.46, max: 12, min: 1.5, labels: true },
  glyph: { w: 48, h: 22, split: 0.42, max: 4.5, min: 0.8, labels: false },
} as const;

function branch(x0: number, y0: number, x1: number, y1: number) {
  const c = (x1 - x0) * 0.45;
  return `M${x0},${y0} C${x0 + c},${y0} ${x1 - c},${y1} ${x1},${y1}`;
}

export function Fork({ probUp, expected, typical, size = "card", label, animate = false }: ForkProps) {
  const d = DIMS[size];
  const hatchId = useId();
  const padR = d.labels ? (size === "hero" ? 132 : 112) : 2;
  const mid = d.h / 2;
  const x0 = 2;
  const sx = d.w * d.split;
  const x1 = d.w - padR;
  const available = probUp !== null && expected !== null;

  if (!available) {
    return (
      <svg viewBox={`0 0 ${d.w} ${d.h}`} className="block h-auto w-full" role="img" aria-label={label}>
        <defs>
          <pattern id={hatchId} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--hatch)" strokeWidth="2" />
          </pattern>
        </defs>
        <line x1={x0} y1={mid} x2={sx} y2={mid} stroke="var(--text-3)" strokeWidth={d.min + 0.5} strokeLinecap="round" />
        <rect x={sx} y={mid - d.h * 0.32} width={x1 - sx} height={d.h * 0.64} fill={`url(#${hatchId})`} />
        <line x1={sx} y1={mid} x2={x1} y2={mid} stroke="var(--text-3)" strokeWidth="1" strokeDasharray="2 5" />
        {d.labels && (
          <text x={x1 + 12} y={mid + 5} className="t-small" fill="var(--text-3)" fontSize="13">
            no call yet
          </text>
        )}
      </svg>
    );
  }

  const p = probUp;
  const span = Math.max(expected ?? 0, typical ?? 0) * 1.25 || 1;
  const maxSpread = d.h * 0.42;
  const spread = (v: number) => (Math.min(v, span) / span) * maxSpread;
  const eS = spread(expected ?? 0);
  const tS = typical !== null ? spread(typical) : null;
  const wUp = d.min + (d.max - d.min) * p;
  const wDown = d.min + (d.max - d.min) * (1 - p);
  const labelGap = Math.max(eS, 34); // keep the two probability labels from colliding
  const upPath = branch(sx, mid, x1, mid - eS);
  const downPath = branch(sx, mid, x1, mid + eS);
  const draw = animate ? { strokeDasharray: 900, ["--len" as string]: 900, animation: "draw 1.1s var(--ease) both" } : undefined;
  const drawLate = animate ? { ...draw, animationDelay: "0.35s" } : undefined;

  return (
    <svg viewBox={`0 0 ${d.w} ${d.h}`} className="block h-auto w-full overflow-visible" role="img" aria-label={label}>
      {/* "no change" reference */}
      <line x1={sx} y1={mid} x2={x1} y2={mid} stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="1 5" strokeLinecap="round" />
      {/* typical move: the ghost fork */}
      {tS !== null && (
        <g stroke="var(--text-3)" strokeWidth={size === "glyph" ? 0.6 : 1} strokeDasharray={size === "glyph" ? "1.5 2" : "3 5"} fill="none" opacity="0.8">
          <path d={branch(sx, mid, x1, mid - tS)} />
          <path d={branch(sx, mid, x1, mid + tS)} />
        </g>
      )}
      {/* today: the stem */}
      <line x1={x0} y1={mid} x2={sx} y2={mid} stroke="var(--text)" strokeWidth={d.min + 1} strokeLinecap="round" style={draw} />
      {/* tomorrow: the two branches, weighted by probability */}
      <path d={downPath} stroke="var(--down)" strokeWidth={wDown} fill="none" strokeLinecap="round"
        style={{ transition: "stroke-width .5s var(--ease)", ...drawLate }} />
      <path d={upPath} stroke="var(--up)" strokeWidth={wUp} fill="none" strokeLinecap="round"
        style={{ transition: "stroke-width .5s var(--ease)", ...drawLate }} />
      {d.labels && (
        <g className="t-num" style={animate ? { animation: "rise .5s var(--ease) both", animationDelay: "1.1s" } : undefined}>
          <text x={x1 + 14} y={mid - labelGap + 6} fill="var(--up)" fontSize={size === "hero" ? 26 : 30} fontWeight="600">{pct(p)}</text>
          <text x={x1 + 14} y={mid - labelGap + 24} fill="var(--text-3)" fontSize={size === "hero" ? 12 : 16}>higher</text>
          <text x={x1 + 14} y={mid + labelGap - 12} fill="var(--down)" fontSize={size === "hero" ? 26 : 30} fontWeight="600">{pct(1 - p)}</text>
          <text x={x1 + 14} y={mid + labelGap + 6} fill="var(--text-3)" fontSize={size === "hero" ? 12 : 16}>lower</text>
          <text x={x0} y={mid - 12} fill="var(--text-3)" fontSize={size === "hero" ? 12 : 16}>today</text>
        </g>
      )}
    </svg>
  );
}
