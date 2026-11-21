import type { ReactNode } from "react";
import { ExternalLink, TextLink } from "@/design-system/components/Controls";
import { REPO_URL } from "@/app/Shell";

/** Plain-English methodology, written from docs/architecture.md. No claims beyond it, no metrics. */

const STEPS: { title: string; body: string }[] = [
  { title: "Collect", body: "Public posts from StockTwits, Telegram, Reddit, financial news feeds and Google Trends, through public endpoints only, respecting robots.txt and rate limits. Duplicate posts are dropped and raw text is kept for 90 days." },
  { title: "Read", body: "Each post gets a sentiment score from FinBERT fine-tuned on finance tweets (with a keyword fallback when no model is available), plus capitulation, sarcasm and language features, and its timing." },
  { title: "Measure the story", body: "Five narrative indices: contagion, capitulation, language divergence, reality check and cross-market spillover. Each returns a value or says what it is missing." },
  { title: "Check the buzz is real", body: "An integrity layer looks for coordinated campaigns: near-duplicate posts across accounts, scheduled timing and similar patterns, scored by a learned model." },
  { title: "Make the call", body: "A next-day outlook per stock: the chance it closes higher and the expected size of the move, with the inputs that pushed it. High coordination risk pulls it toward 50/50." },
  { title: "Publish", body: "Every four hours the pipeline writes its results to the database the website reads." },
];

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-line py-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
      <h2 id={id} className="t-h2">{title}</h2>
      <div className="t-body space-y-4">{children}</div>
    </section>
  );
}

export default function MethodPage() {
  return (
    <div className="page">
      <header className="max-w-[860px] pb-10 pt-12">
        <h1 className="t-display">How Diverge turns chatter into a call.</h1>
        <p className="t-lead mt-6">
          The short version: collect public posts, score them, discount anything that looks coordinated, and estimate
          tomorrow with a model whose track record is published next to every call.
        </p>
      </header>

      <section aria-labelledby="pipe-h" className="border-t border-line py-12">
        <h2 id="pipe-h" className="t-h2">The pipeline</h2>
        <ol className="mt-8 grid list-none gap-x-12 gap-y-8 p-0 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-x-2">
              <span className="t-num pt-0.5 text-sm text-text-3" aria-hidden="true">{i + 1}</span>
              <div>
                <h3 className="t-h3">{s.title}</h3>
                <p className="t-body mt-2">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Block id="rn-h" title="Contagion, measured like an epidemic">
        <p>
          Each account's first mention of a stock counts as a new “case”. Diverge estimates how many new posters each
          existing one recruits, the reproduction number Rn, with the renewal-equation method epidemiologists use (Cori et
          al., 2013), over a 7-day window, and reports it with a 95% credible interval.
        </p>
        <p>Above 1, the story is still spreading to new people. Below 1, it is running out of new voices.</p>
      </Block>

      <Block id="bot-h" title="Finding copy-paste armies">
        <p>
          Comparing every post with every other is slow, so Diverge uses MinHash with locality-sensitive hashing to find
          near-duplicate text quickly. Near-duplicates written by different accounts are the strongest sign of a campaign.
        </p>
        <p>
          A logistic model combines that with timing tests (do posts arrive at random, or on a schedule?), how spread out
          first mentions are, how uniform the sentiment is, whether there was news, and volume. The result is coordination
          risk: the probability that a window contains a coordinated campaign.
        </p>
        <p>
          No public labelled dataset of stock-promotion campaigns exists, so the detector was trained and tested on
          simulated campaigns injected into realistic traffic, including organic news bursts that share headline text.
        </p>
      </Block>

      <Block id="wf-h" title="Tested on years it had never seen">
        <p>
          The outlook is evaluated walk-forward: train on earlier years, test on the next, then repeat. It is compared with
          simple baselines (always guessing “up” for direction, price history alone for move size), and its calibration is
          checked. A separate backtest on synthetic data confirms the test harness finds a planted signal and finds nothing
          in pure noise, which guards against look-ahead leakage.
        </p>
        <p>
          The results, good and bad, are on the <TextLink to="/model">accuracy page</TextLink> and next to every call.
        </p>
      </Block>

      <Block id="lim-h" title="Honest limits">
        <ul className="list-disc space-y-2 pl-5 marker:text-text-3">
          <li>Next-day direction for large, liquid stocks is close to a coin flip. Diverge does not claim tradeable alpha.</li>
          <li>The bot detector was trained on simulated campaigns; real-world precision still has to be confirmed on hand-labelled windows. Organic news bursts are its main source of false alarms.</li>
          <li>The outlook model was trained on five US large caps and is applied to Indian and US stocks, so live accuracy can differ from the recorded track record.</li>
          <li>Reddit currently refuses unauthenticated requests, so live posts come mainly from StockTwits, Telegram, news feeds and Google Trends.</li>
          <li>Sarcasm and capitulation detection are rule-based.</li>
          <li>Some indices are often unavailable: language divergence needs enough posts in both languages, and the reality check only applies to consumer-facing companies.</li>
        </ul>
        <p>
          Every number is reproducible from the <ExternalLink href={REPO_URL}>source code</ExternalLink>.
        </p>
      </Block>
    </div>
  );
}
