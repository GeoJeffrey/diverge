import { pct } from "@/lib/format";

/**
 * Horizontal bars on a shared 0–max scale with an optional reference line (e.g. "always guess up").
 * One question per chart: how does each row compare with the reference?
 */
export interface CompareRow {
  key: string;
  label: string;
  value: number;
  note?: string;
  emphasis?: boolean;
}

export function CompareBars({ rows, reference, referenceLabel, max = 1, format = (v: number) => pct(v, 1) }: {
  rows: CompareRow[];
  reference?: number;
  referenceLabel?: string;
  max?: number;
  format?: (v: number) => string;
}) {
  return (
    <figure>
      <ul className="list-none space-y-4 p-0">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-4">
              <span className={r.emphasis ? "text-sm font-semibold text-text" : "text-sm text-text-2"}>{r.label}</span>
              <span className="t-num text-sm text-text">{format(r.value)}</span>
            </div>
            <div className="relative mt-1.5 h-2" aria-hidden="true">
              <div className="absolute inset-0 rounded-full bg-sunk" />
              <div className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${(r.value / max) * 100}%`, background: r.emphasis ? "var(--up)" : "var(--text-3)" }} />
              {reference !== undefined && (
                <div className="absolute -inset-y-1 w-0.5 bg-text" style={{ left: `${(reference / max) * 100}%` }} />
              )}
            </div>
            {r.note && <p className="t-small mt-1">{r.note}</p>}
          </li>
        ))}
      </ul>
      {reference !== undefined && referenceLabel && (
        <figcaption className="t-small mt-3 flex items-center gap-2">
          <span className="inline-block h-3 w-0.5 bg-text" aria-hidden="true" />
          {referenceLabel} ({format(reference)})
        </figcaption>
      )}
    </figure>
  );
}
