import { pct } from "@/lib/format";

/**
 * 0–100% chance-of-closing-higher scale with the 50/50 midpoint drawn as the reference.
 * The filled span runs from 50% to the estimate, so its length is the model's edge over a coin flip.
 */
export function ProbabilityScale({ p }: { p: number }) {
  const left = Math.min(p, 0.5) * 100;
  const width = Math.abs(p - 0.5) * 100;
  const up = p >= 0.5;
  return (
    <figure aria-label={`Estimate ${pct(p)} chance of a higher close; 50% is a coin flip.`}>
      <div className="relative h-8" aria-hidden="true">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{ left: `${left}%`, width: `${Math.max(width, 0.6)}%`, background: up ? "var(--up)" : "var(--down)" }}
        />
        <div className="absolute top-0 h-full w-px bg-text-3" style={{ left: "50%" }} />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg"
          style={{ left: `${p * 100}%`, background: up ? "var(--up)" : "var(--down)", transition: "left .5s var(--ease)" }}
        />
      </div>
      <figcaption className="t-small mt-1 grid grid-cols-3">
        <span>Lower</span>
        <span className="text-center">50/50</span>
        <span className="text-right">Higher</span>
      </figcaption>
    </figure>
  );
}
