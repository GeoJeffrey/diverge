import { NavLink } from "react-router";
import { Segmented } from "@/design-system/components/Controls";
import { MARKET_NAME, tickerMeta } from "@/lib/markets";

type View = "simple" | "advanced" | "why" | "integrity";

export function TickerHeader({ symbol, view }: { symbol: string; view: View }) {
  const meta = tickerMeta(symbol);
  const sub = [
    { to: `/ticker/${symbol}/advanced`, label: "All readings" },
    { to: `/ticker/${symbol}/why`, label: "Why this score" },
    { to: `/ticker/${symbol}/integrity`, label: "Integrity" },
  ];
  return (
    <header className="border-b border-line pt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-6">
        <div>
          <h1 className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="t-sym text-[clamp(2rem,1.4rem+2.4vw,3rem)] leading-none tracking-[-0.02em]">{symbol}</span>
            <span className="text-lg font-normal text-text-2">{meta?.name ?? ""}</span>
          </h1>
          {meta && (
            <p className="t-small mt-2">
              {MARKET_NAME[meta.market]}, {meta.market === "NSE" ? "National Stock Exchange of India" : "US market"}. {meta.sector}.
            </p>
          )}
        </div>
        <Segmented
          label="Detail level"
          options={[
            { to: `/ticker/${symbol}`, label: "Simple", active: view === "simple" },
            { to: `/ticker/${symbol}/advanced`, label: "Advanced", active: view !== "simple" },
          ]}
        />
      </div>
      {view !== "simple" && (
        <nav aria-label={`${symbol} advanced views`} className="-mb-px flex gap-6 overflow-x-auto">
          {sub.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end
              className={({ isActive }) =>
                `whitespace-nowrap border-b-2 pb-3 text-sm no-underline ${isActive ? "border-text font-semibold text-text" : "border-transparent text-text-2 hover:text-text"}`
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
