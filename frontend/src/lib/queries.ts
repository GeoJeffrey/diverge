import { QueryClient, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000, // the pipeline publishes every 4 hours
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

export const qk = {
  outlooks: ["outlooks"] as const,
  outlook: (s: string) => ["outlook", s] as const,
  model: ["outlook-model"] as const,
  tickers: ["tickers"] as const,
  simple: (s: string) => ["ticker-simple", s] as const,
  advanced: (s: string) => ["ticker-advanced", s] as const,
  reasoning: (s: string) => ["reasoning", s] as const,
  me: ["me"] as const,
};

export const useOutlooks = () => useQuery({ queryKey: qk.outlooks, queryFn: api.outlooks });
export const useOutlook = (s: string) => useQuery({ queryKey: qk.outlook(s), queryFn: () => api.outlook(s) });
export const useOutlookModel = () => useQuery({ queryKey: qk.model, queryFn: api.outlookModel });
export const useTickers = () => useQuery({ queryKey: qk.tickers, queryFn: api.tickers });
export const useTickerSimple = (s: string) =>
  useQuery({ queryKey: qk.simple(s), queryFn: () => api.tickerSimple(s) });
export const useTickerAdvanced = (s: string, enabled = true) =>
  useQuery({ queryKey: qk.advanced(s), queryFn: () => api.ticker(s), enabled });
export const useReasoning = (s: string, enabled = true) =>
  useQuery({ queryKey: qk.reasoning(s), queryFn: () => api.reasoning(s), enabled });

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) return "Couldn't reach the Diverge API. Check your connection and try again.";
  return "Something went wrong while loading this view.";
}
