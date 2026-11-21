import { useId, useMemo, useState } from "react";
import { Link } from "react-router";
import { Fork } from "@/design-system/charts/Fork";
import { RiskMeter } from "@/design-system/components/Risk";
import { ErrorBlock, Skeleton } from "@/design-system/components/States";
import { Term } from "@/design-system/components/Term";
import { TextLink } from "@/design-system/components/Controls";
import { dayLabel, directionOf, leanWords, move, pct } from "@/lib/format";
import { errorMessage } from "@/lib/queries";
import { MARKET_NAME, type Market } from "@/lib/markets";
import { forkLabel } from "@/features/outlook/OutlookPanel";
import { useMarketRows, type MarketRow } from "./useMarketRows";

type SortKey = "symbol" | "chance" | "move" | "intensity" | "risk";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "symbol", label: "Name" },
  { key: "chance", label: "Chance higher" },
  { key: "move", label: "Move vs typical" },
  { key: "intensity", label: "Narrative intensity" },
  { key: "risk", label: "Coordination risk" },
];
const RISK_ORDER = { high: 3, moderate: 2, low: 1, unknown: 0 } as const;

function sortValue(r: MarketRow, key: SortKey): number | string {
  switch (key) {
    case "symbol": return r.meta.symbol;
    case "chance": return r.outlook?.prob_up ?? -1;
    case "move": return r.moveRatio ?? -1;
    case "intensity": return r.reading?.score ?? -1;
    case "risk": return RISK_ORDER[r.risk];
  }
}

function Call({ r }: { r: MarketRow }) {
  const o = r.outlook;
  if (!o?.available || o.prob_up === null) {
    return <span className="t-small">{o?.coverage_note ? "Collecting history" : "No outlook yet"}</span>;
  }
  const dir = directionOf(o);
  return (
    <span className="flex items-center gap-3">
      <span className="w-12 shrink-0"><Fork size="glyph" probUp={o.prob_up} expected={o.expected_move_pct} typical={o.typical_move_pct} label={forkLabel(o)} /></span>
      <span>
        <span className="t-num text-[0.9375rem] font-semibold" style={{ color: dir === "up" ? "var(--up)" : dir === "down" ? "var(--down)" : "var(--text)" }}>
          {pct(o.prob_up)}
        </span>
        <span className="t-small ml-1.5 whitespace-nowrap">{leanWords(o).toLowerCase()}</span>
      </span>
    </span>
  );
}

function MoveCell({ r }: { r: MarketRow }) {
  const o = r.outlook;
  if (!o?.available || o.expected_move_pct === null) return <span className="t-small">–</span>;
  const big = (r.moveRatio ?? 0) >= 1.2;
  return (
    <span className="t-num text-sm">
      <span className={big ? "font-semibold text-text" : "text-text"}>{move(o.expected_move_pct)}</span>
      <span className="text-text-3"> vs {move(o.typical_move_pct)}</span>
    </span>
  );
}

function Group({ market, rows }: { market: Market; rows: MarketRow[] }) {
  const id = useId();
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="t-h2 mb-1">{MARKET_NAME[market]}</h2>
      <p className="t-small mb-4">{market === "NSE" ? "National Stock Exchange of India" : "Nasdaq and NYSE"}, {rows.length} names</p>
      <table className="block w-full border-collapse text-left md:table md:table-fixed">
        <caption className="sr-only">{MARKET_NAME[market]} next-day outlooks</caption>
        {/* fixed widths keep both exchange groups' columns aligned */}
        <colgroup className="hidden md:table-column-group">
          <col style={{ width: "26%" }} />
          <col style={{ width: "29%" }} />
          <col style={{ width: "19%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "16%" }} />
        </colgroup>
        <thead className="hidden md:table-header-group">
          <tr className="border-b border-line-strong text-[0.8125rem] text-text-3">
            <th scope="col" className="py-2 pr-4 font-normal">Name</th>
            <th scope="col" className="py-2 pr-4 font-normal">Next-day call</th>
            <th scope="col" className="py-2 pr-4 font-normal">Expected move</th>
            <th scope="col" className="py-2 pr-4 text-right font-normal">
              <Term explain="How strong the conversation is right now (0–100). Loudness, not direction.">Intensity</Term>
            </th>
            <th scope="col" className="py-2 font-normal">
              <Term explain="How likely the posts include a coordinated campaign. Higher means more likely coordinated.">Coordination risk</Term>
            </th>
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {rows.map((r) => (
            <tr key={r.meta.symbol} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-b border-line py-4 md:table-row md:py-0">
              <th scope="row" className="text-left font-normal md:py-4 md:pr-4">
                <Link to={`/ticker/${r.meta.symbol}`} className="group no-underline">
                  <span className="t-sym block text-[0.9375rem] text-text group-hover:underline">{r.meta.symbol}</span>
                  <span className="t-small block">{r.meta.name}</span>
                </Link>
              </th>
              <td className="row-span-1 md:py-4 md:pr-4"><Call r={r} /></td>
              <td className="md:py-4 md:pr-4"><span className="t-small mr-2 md:hidden">Move</span><MoveCell r={r} /></td>
              <td className="text-right md:py-4 md:pr-4">
                <span className="t-small mr-2 md:hidden">Intensity</span>
                {r.reading?.score != null ? <span className="t-num text-sm">{r.reading.score.toFixed(1)}</span> : <span className="t-small">–</span>}
              </td>
              <td className="col-span-2 md:py-4"><span className="t-small mr-2 md:hidden">Coordination risk</span><RiskMeter level={r.risk} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function MarketPage() {
  const { rows, outlooks, tickers } = useMarketRows();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("symbol");
  const filterId = useId();
  const sortId = useId();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => !q || `${r.meta.symbol} ${r.meta.name} ${r.meta.sector}`.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      const va = sortValue(a, sort), vb = sortValue(b, sort);
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb);
      return (vb as number) - (va as number);
    });
  }, [rows, query, sort]);

  const available = rows.filter((r) => r.outlook?.available);
  const leaning = available.filter((r) => r.outlook && Math.abs((r.outlook.prob_up ?? 0.5) - 0.5) >= 0.05).length;
  const day = available[0]?.outlook?.as_of_day;
  const loading = outlooks.isPending || tickers.isPending;

  return (
    <div className="page">
      <header className="grid gap-6 border-b border-line pb-8 pt-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
        <div>
          <h1 className="t-h1">Market</h1>
          <p className="t-lead mt-3">
            Every tracked stock with its next-day call, the move to expect, how loud the conversation is and how likely it
            is to be coordinated.
          </p>
          {/* Reserves the summary's height (3 lines on phones, 2 on wide screens) so it doesn't push the page down. */}
          <div className="mt-3 min-h-[4.5rem] lg:min-h-[3rem]">
            {loading ? (
              <Skeleton className="h-5 w-2/3" label="Loading outlooks" />
            ) : outlooks.isError ? null : (
              <p className="text-[0.9375rem] text-text">
                {available.length} of {outlooks.data?.total ?? rows.length} names have a call{day ? ` for after the ${dayLabel(day)} close` : ""}.{" "}
                {leaning === 0
                  ? "None leans clearly; all are close to a coin flip."
                  : `${leaning} ${leaning === 1 ? "leans" : "lean"} one way; the rest are close to a coin flip.`}
              </p>
            )}
          </div>
        </div>
        <p className="t-small lg:text-right">
          Direction calls are close to chance. <TextLink to="/model">See the track record</TextLink>
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5 sm:max-w-[320px]">
          <label htmlFor={filterId} className="text-sm text-text-2">Filter</label>
          <input
            id={filterId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, symbol or sector"
            className="h-10 rounded-[var(--r-control)] border border-edge bg-raise px-3 text-sm text-text placeholder:text-text-3"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={sortId} className="text-sm text-text-2">Sort by</label>
          <select
            id={sortId}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 rounded-[var(--r-control)] border border-edge bg-raise px-3 text-sm text-text"
          >
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {outlooks.isError && (
        <div className="mt-10"><ErrorBlock message={errorMessage(outlooks.error)} onRetry={() => void outlooks.refetch()} /></div>
      )}
      {loading && (
        <div className="mt-12 space-y-3" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      )}
      {!loading && !outlooks.isError && (
        <>
          {shown.length === 0 && <p className="mt-10 text-text-2">No tracked name matches “{query}”.</p>}
          <Group market="NSE" rows={shown.filter((r) => r.meta.market === "NSE")} />
          <Group market="US" rows={shown.filter((r) => r.meta.market === "US")} />
        </>
      )}
    </div>
  );
}
