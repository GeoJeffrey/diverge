/**
 * Diverging bars around a centre axis: right/teal pushes the estimate up, left/coral pushes it down.
 * Lengths are relative within the list (the largest push fills its half). Direction is also stated
 * in words for anyone who can't rely on colour.
 */
export interface DivergingItem {
  key: string;
  label: string;
  value: number;
  tag?: string;
}

export function DivergingBars({ items, upWord = "up", downWord = "down", caption }: {
  items: DivergingItem[];
  upWord?: string;
  downWord?: string;
  caption?: string;
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1e-12);
  return (
    <figure>
      <ul className="list-none space-y-2.5 p-0">
        {items.map((i) => {
          const share = (Math.abs(i.value) / max) * 50;
          const up = i.value >= 0;
          return (
            <li key={i.key} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(11rem,1.3fr)_minmax(0,1fr)_6.5rem]">
              <span className="text-sm leading-snug text-text">
                {i.label}
                {i.tag && <span className="t-small ml-1.5 whitespace-nowrap">{i.tag}</span>}
              </span>
              <span className="relative h-3" aria-hidden="true">
                <span className="absolute top-0 h-full w-px bg-line-strong" style={{ left: "50%" }} />
                <span
                  className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                  style={{
                    left: up ? "50%" : `${50 - share}%`,
                    width: `${Math.max(share, 1)}%`,
                    background: up ? "var(--up)" : "var(--down)",
                  }}
                />
              </span>
              <span className="t-small col-span-2 -mt-1.5 text-right sm:col-span-1 sm:mt-0" style={{ color: up ? "var(--up)" : "var(--down)" }}>
                pushes {up ? upWord : downWord}
              </span>
            </li>
          );
        })}
      </ul>
      {caption && <figcaption className="t-small mt-3">{caption}</figcaption>}
    </figure>
  );
}
