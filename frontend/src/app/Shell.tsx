import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useIsFetching } from "@tanstack/react-query";
import { Wordmark } from "@/design-system/components/Brand";
import { ThemeToggle } from "@/design-system/components/ThemeToggle";
import { ExternalLink, TextLink } from "@/design-system/components/Controls";
import { IS_DEMO_DATA } from "@/lib/api";
import { useAuth } from "@/auth/AuthProvider";

export const REPO_URL = "https://github.com/GeoJeffrey/diverge";

const NAV = [
  { to: "/market", label: "Market" },
  { to: "/model", label: "Accuracy" },
  { to: "/method", label: "Method" },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-[var(--r-control)] px-3 py-2 text-sm no-underline ${
    isActive ? "text-text font-semibold" : "text-text-2 hover:text-text"
  }`;
}

/** Can't be missed, can't be mistaken for live data: hatched band on every page in demo mode. */
function DemoBand() {
  if (!IS_DEMO_DATA) return null;
  return (
    <div className="hatch border-b border-line-strong">
      <p className="page py-2 text-[0.8125rem] text-text">
        <strong className="font-semibold">Demo data.</strong>{" "}
        <span className="text-text-2">
          Per-ticker values are illustrative, not live readings. The accuracy page shows the real model's test results.
        </span>
      </p>
    </div>
  );
}

/** The free API sleeps when idle. If any request runs past 4 s, say so instead of looking broken. */
export function WakingBanner({ delayMs = 4000 }: { delayMs?: number }) {
  const fetching = useIsFetching();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!fetching) {
      setSlow(false);
      return;
    }
    const t = window.setTimeout(() => setSlow(true), delayMs);
    return () => window.clearTimeout(t);
  }, [fetching, delayMs]);
  if (!slow) return null;
  return (
    <div role="status" className="border-b border-line bg-raise">
      <p className="page flex items-center gap-3 py-2.5 text-sm text-text">
        <span className="inline-block h-2 w-2 animate-[pulse-soft_1.4s_ease-in-out_infinite] rounded-full bg-text-2" aria-hidden="true" />
        Waking up the free server, this can take up to a minute…
      </p>
    </div>
  );
}

function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <div role="alert" className="border-b border-down bg-down-soft">
      <p className="page py-2.5 text-sm text-text">
        You're offline. Pages you've already opened still work; new data will load when you reconnect.
      </p>
    </div>
  );
}

export function Shell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="border-b border-line">
        <div className="page flex h-14 items-center gap-4">
          <Wordmark />
          <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={navClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NavLink to={user ? "/settings" : "/login"} className={`${navClass({ isActive: false })} hidden md:inline-flex`}>
              {user ? user.full_name.split(" ")[0] : "Sign in"}
            </NavLink>
            <button
              type="button"
              className="rounded-[var(--r-control)] px-3 py-2 text-sm text-text md:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Main" className="page flex flex-col border-t border-line py-2 md:hidden">
            {[...NAV, { to: user ? "/settings" : "/login", label: user ? "Account" : "Sign in" }].map((n) => (
              <NavLink key={n.to} to={n.to} className={navClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <DemoBand />
      <OfflineBanner />
      <WakingBanner />
      <main id="main" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <footer className="mt-24 border-t border-line">
        <div className="page grid gap-6 py-10 text-sm text-text-2 md:grid-cols-[1fr_auto]">
          <p className="max-w-[60ch]">
            Diverge is a research project. Outlooks are statistical estimates from public posts and prices, shown with their
            measured track record. Not investment advice.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <TextLink to="/model">How accurate is it?</TextLink>
            <TextLink to="/method">How it works</TextLink>
            <ExternalLink href={REPO_URL}>Source code</ExternalLink>
          </div>
        </div>
      </footer>
    </>
  );
}
