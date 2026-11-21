import { useMemo, useState } from "react";
import { Fork } from "@/design-system/charts/Fork";
import { CompareBars } from "@/design-system/charts/CompareBars";
import { ForkKey } from "@/design-system/charts/ForkKey";
import { ButtonLink, ExternalLink, TextLink } from "@/design-system/components/Controls";
import { ErrorBlock, Skeleton } from "@/design-system/components/States";
import { useOutlookModel, useOutlooks, errorMessage } from "@/lib/queries";
import { TICKERS } from "@/lib/markets";
import { leanWords, pct } from "@/lib/format";
import { forkLabel } from "@/features/outlook/OutlookPanel";
import { edgeNote, headline, moveSentence } from "@/features/outlook/words";
import { REPO_URL } from "@/app/Shell";

function HeroFork() {
  const q = useOutlooks();
  const bySymbol = useMemo(() => new Map((q.data?.outlooks ?? []).map((o) => [o.symbol, o])), [q.data]);
  const firstAvailable = TICKERS.find((t) => bySymbol.get(t.symbol)?.available)?.symbol ?? TICKERS[0].symbol;
  const [picked, setPicked] = useState<string | null>(null);
  const symbol = picked ?? firstAvailable;
  const o = bySymbol.get(symbol);

  if (q.isPending) return <Skeleton className="mt-[4.5rem] aspect-[56/30] w-full" label="Loading a live outlook" />;
  if (q.isError) return <ErrorBlock message={errorMessage(q.error)} onRetry={() => void q.refetch()} />;

  return (
    <div>
      <div className="min-h-[3.5rem]" aria-live="polite">
        {o ? (
          <>
            <p className="text-sm text-text-2">
              {o.available && o.prob_up !== null ? `${leanWords(o)}. ${edgeNote(o.prob_up)}` : (o.coverage_note ?? "No call yet.")}
            </p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.01em] text-text">{headline(o)}.</p>
          </>
        ) : (
          <p className="text-text-2">No outlook has been published for {symbol} yet.</p>
        )}
      </div>
      <div className="mt-4">
        <Fork
          key={symbol}
          size="hero"
          animate
          probUp={o?.available ? o.prob_up : null}
          expected={o?.available ? o.expected_move_pct : null}
          typical={o?.available ? o.typical_move_pct : null}
          label={o ? forkLabel(o) : `${symbol}: no outlook yet.`}
        />
      </div>
      {o?.available && <p className="t-small mt-2">{moveSentence(o)}</p>}
      <fieldset className="mt-6 border-0 p-0">
        <legend className="t-small mb-2">Pick a name</legend>
        <div className="flex flex-wrap gap-1.5">
          {TICKERS.map((t) => {
            const active = t.symbol === symbol;
            const has = bySymbol.get(t.symbol)?.available;
            return (
              <button
                key={t.symbol}
                type="button"
                aria-pressed={active}
                onClick={() => setPicked(t.symbol)}
                className={`t-sym rounded-[4px] border px-2 py-1 text-[0.75rem] ${
                  active ? "border-mark bg-text text-bg" : has ? "border-line-strong text-text-2 hover:text-text" : "hatch border-dashed border-line-strong text-text-3"
                }`}
                title={has ? t.name : `${t.name}: no call yet`}
              >
                {t.symbol}
              </button>
            );
          })}
        </div>
      </fieldset>
      <p className="mt-4 text-sm">
        <TextLink to={`/ticker/${symbol}`}>Why {symbol} looks like this</TextLink>
      </p>
    </div>
  );
}

/** Illustration of what coordinated posting looks like. Words, not data: no counts or scores. */
function CopyPasteIllustration() {
  const posts = [
    { who: "acct_8841", text: ["deposit growth is", "about to surprise everyone.", "Load up before results"] },
    { who: "acct_8842", text: ["deposit growth is", "about to surprise everyone!!", "Load up before the results"] },
    { who: "acct_8847", text: ["Deposit growth", "about to surprise everyone.", "load up before results"] },
  ];
  return (
    <figure>
      <ul className="list-none space-y-3 p-0">
        {posts.map((p, i) => (
          <li key={p.who} className="border-l-2 border-down pl-4" style={{ marginLeft: i * 14 }}>
            <p className="t-num text-[0.75rem] text-text-3">{p.who}, posted 09:4{i}</p>
            <p className="mt-0.5 text-[0.9375rem] text-text">
              {p.text[0]} <mark className="bg-down-soft text-text">{p.text[1]}</mark> {p.text[2]}
            </p>
          </li>
        ))}
        <li className="border-l-2 border-up pl-4">
          <p className="t-num text-[0.75rem] text-text-3">long_time_holder, posted 10:12</p>
          <p className="mt-0.5 text-[0.9375rem] text-text">Results next week. Deposits matter but I'm watching margins more.</p>
        </li>
      </ul>
      <figcaption className="t-small mt-4">
        Illustration. Diverge finds near-duplicates across accounts with MinHash and scores the timing; a window full of them
        is discounted, and the outlook is pulled toward 50/50.
      </figcaption>
    </figure>
  );
}

function TrackRecord() {
  const q = useOutlookModel();
  if (q.isPending) return <Skeleton className="h-56" label="Loading the track record" />;
  if (q.isError) return <ErrorBlock message={errorMessage(q.error)} onRetry={() => void q.refetch()} />;
  const d = q.data.track_record.direction;
  const mv = q.data.track_record.move;
  if (!q.data.available || !d || !mv) {
    return <p className="t-body">The model hasn't been trained yet, so there's no track record to show.</p>;
  }
  return (
    <div className="space-y-8">
      <p className="text-[1.375rem] leading-snug tracking-[-0.01em] text-text">
        On {d.lean_calls.days.toLocaleString("en-US")} test days where it leaned, it was right{" "}
        <span className="t-num">{pct(d.lean_calls.accuracy, 1)}</span> of the time. Always guessing “up” was right{" "}
        <span className="t-num">{pct(d.always_up_accuracy, 1)}</span>.
      </p>
      <CompareBars
        reference={d.always_up_accuracy}
        referenceLabel="Always guessing “up”"
        rows={[
          { key: "lean", label: "“Leans” calls", value: d.lean_calls.accuracy ?? 0, emphasis: true },
          { key: "all", label: "All days", value: d.accuracy },
        ]}
      />
      <p className="t-body">
        Where social signals do help is the size of the move: they lift the share of move size explained from{" "}
        {pct(mv.oos_r2_price_only, 1)} to {pct(mv.oos_r2, 1)}. That's why every call shows an expected move next to the odds.
      </p>
    </div>
  );
}

export default function LandingPage() {
  // Counts come from the API, never from the copy.
  const total = useOutlooks().data?.total;
  return (
    <div className="page">
      <section className="grid gap-12 pb-20 pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:pt-20">
        <div className="lg:pt-6">
          <h1 className="t-display">Tomorrow, read from today's chatter.</h1>
          <p className="t-lead mt-6">
            Diverge reads public posts about {total ? `${total} stocks` : "a set of stocks"} on Dalal Street and Wall Street,
            discounts the ones that look bot-driven, and gives each a next-day call: the chance it closes higher and how big a
            move to expect. Every call shows its reasons and how often calls like it have been right.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink to="/market">{total ? `See all ${total} calls` : "See every call"}</ButtonLink>
            <ButtonLink to="/model" variant="quiet">How accurate is it?</ButtonLink>
          </div>
        </div>
        <HeroFork />
      </section>

      <section aria-labelledby="fork-h" className="grid gap-10 border-t border-line py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-16">
        <div>
          <h2 id="fork-h" className="t-h2">How to read the fork</h2>
          <p className="t-body mt-4">
            Today's line splits in two. When the call is close to a coin flip the branches look almost the same, and
            that's the honest picture. A wider fork means a bigger move; compare it with the dashed fork to see whether
            tomorrow looks calmer or rougher than usual for that stock.
          </p>
        </div>
        <ForkKey />
      </section>

      <section aria-labelledby="buzz-h" className="grid gap-10 border-t border-line py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
        <div>
          <h2 id="buzz-h" className="t-h2">Is the buzz real?</h2>
          <p className="t-body mt-4">
            A burst of posts can be a story spreading, or a few people with many accounts. Diverge checks which before it
            lets the buzz count.
          </p>
        </div>
        <CopyPasteIllustration />
      </section>

      <section aria-labelledby="record-h" className="grid gap-10 border-t border-line py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
        <div>
          <h2 id="record-h" className="t-h2">It tells you how often it's wrong</h2>
          <p className="t-body mt-4">
            Next-day direction for large, liquid stocks is close to a coin flip, and Diverge doesn't pretend otherwise. Its
            record comes from walk-forward testing on years the model had never seen.
          </p>
          <p className="mt-6 text-sm">
            <TextLink to="/model">Full track record</TextLink>
            <span className="mx-3 text-text-3" aria-hidden="true">/</span>
            <TextLink to="/method">How it works</TextLink>
            <span className="mx-3 text-text-3" aria-hidden="true">/</span>
            <ExternalLink href={REPO_URL}>Source code</ExternalLink>
          </p>
        </div>
        <TrackRecord />
      </section>
    </div>
  );
}
