import { createBrowserRouter, Navigate, useParams } from "react-router";
import { Shell } from "./Shell";
import { RequireAuth } from "./RequireAuth";
import NotFoundPage from "@/features/system/NotFoundPage";
import RouteError from "@/features/system/RouteError";
import { api } from "@/lib/api";
import { qk, queryClient } from "@/lib/queries";

function RedirectSimple() {
  const { symbol = "" } = useParams();
  return <Navigate to={`/ticker/${symbol}`} replace />;
}

const page = (load: () => Promise<{ default: React.ComponentType }>) => () => load().then((m) => ({ Component: m.default }));
const protectedPage = (load: () => Promise<{ default: React.ComponentType }>) => () =>
  load().then((m) => {
    const Page = m.default;
    return { Component: () => <RequireAuth><Page /></RequireAuth> };
  });

/**
 * Start a page's data requests as soon as navigation starts, in parallel with downloading its code,
 * instead of after the page chunk has loaded (no waterfall). Never blocks: the page renders its own
 * loading state if data isn't there yet.
 */
function warm(...keys: ((p: Record<string, string | undefined>) => Promise<unknown>)[]) {
  return ({ params }: { params: Record<string, string | undefined> }) => {
    keys.forEach((k) => void k(params).catch(() => undefined));
    return null;
  };
}
const sym = (p: Record<string, string | undefined>) => (p.symbol ?? "").toUpperCase();
const outlooks = () => queryClient.prefetchQuery({ queryKey: qk.outlooks, queryFn: api.outlooks });
const tickers = () => queryClient.prefetchQuery({ queryKey: qk.tickers, queryFn: api.tickers });
const model = () => queryClient.prefetchQuery({ queryKey: qk.model, queryFn: api.outlookModel });
const outlook = (p: Record<string, string | undefined>) => queryClient.prefetchQuery({ queryKey: qk.outlook(sym(p)), queryFn: () => api.outlook(sym(p)) });
const simple = (p: Record<string, string | undefined>) => queryClient.prefetchQuery({ queryKey: qk.simple(sym(p)), queryFn: () => api.tickerSimple(sym(p)) });

/** Route-level code splitting: each page is its own chunk. */
export const routes = [
  {
    Component: Shell,
    ErrorBoundary: RouteError,
    children: [
      {
        ErrorBoundary: RouteError,
        children: [
          { index: true, loader: warm(outlooks, model), lazy: page(() => import("@/features/landing/LandingPage")) },
          { path: "market", loader: warm(outlooks, tickers), lazy: page(() => import("@/features/market/MarketPage")) },
          { path: "ticker/:symbol", loader: warm(outlook, model, simple), lazy: page(() => import("@/features/ticker/TickerSimplePage")) },
          { path: "ticker/:symbol/advanced", lazy: protectedPage(() => import("@/features/ticker/AdvancedPage")) },
          { path: "ticker/:symbol/why", lazy: protectedPage(() => import("@/features/ticker/WhyPage")) },
          { path: "ticker/:symbol/integrity", lazy: protectedPage(() => import("@/features/ticker/IntegrityPage")) },
          { path: "model", loader: warm(model), lazy: page(() => import("@/features/model/ModelPage")) },
          { path: "method", lazy: page(() => import("@/features/method/MethodPage")) },
          { path: "login", lazy: () => import("@/features/auth/AuthPage").then((m) => ({ Component: () => <m.default mode="login" /> })) },
          { path: "signup", lazy: () => import("@/features/auth/AuthPage").then((m) => ({ Component: () => <m.default mode="signup" /> })) },
          { path: "settings", lazy: protectedPage(() => import("@/features/auth/SettingsPage")) },
          // Old URLs keep working.
          { path: "tickers", element: <Navigate to="/market" replace /> },
          { path: "dashboard", element: <Navigate to="/market" replace /> },
          { path: "indices", element: <Navigate to="/market" replace /> },
          { path: "integrity", element: <Navigate to="/market" replace /> },
          { path: "explainability", element: <Navigate to="/market" replace /> },
          { path: "ticker/:symbol/simple", Component: RedirectSimple },
          { path: "*", Component: NotFoundPage },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
