/**
 * The 16 tracked names and which exchange they trade on. This is static metadata that mirrors
 * src/diverge/api/ticker_metadata.py (names, sectors); it is never used for any metric.
 */
export type Market = "NSE" | "US";

export interface TrackedTicker {
  symbol: string;
  name: string;
  sector: string;
  market: Market;
}

export const TICKERS: TrackedTicker[] = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd.", sector: "Energy", market: "NSE" },
  { symbol: "TCS", name: "Tata Consultancy Services Ltd.", sector: "Information Technology", market: "NSE" },
  { symbol: "INFY", name: "Infosys Ltd.", sector: "Information Technology", market: "NSE" },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd.", sector: "Financial Services", market: "NSE" },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd.", sector: "Financial Services", market: "NSE" },
  { symbol: "SBIN", name: "State Bank of India", sector: "Financial Services", market: "NSE" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd.", sector: "Consumer Discretionary", market: "NSE" },
  { symbol: "ITC", name: "ITC Ltd.", sector: "Consumer Goods", market: "NSE" },
  { symbol: "LT", name: "Larsen & Toubro Ltd.", sector: "Conglomerate", market: "NSE" },
  { symbol: "WIPRO", name: "Wipro Ltd.", sector: "Information Technology", market: "NSE" },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd.", sector: "Basic Materials", market: "NSE" },
  { symbol: "AAPL", name: "Apple Inc.", sector: "Information Technology", market: "US" },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Automotive", market: "US" },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Information Technology", market: "US" },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Information Technology", market: "US" },
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Discretionary", market: "US" },
];

export const MARKET_NAME: Record<Market, string> = { NSE: "Dalal Street", US: "Wall Street" };

export function marketOf(symbol: string): Market {
  return TICKERS.find((t) => t.symbol === symbol.toUpperCase())?.market ?? "US";
}

export function tickerMeta(symbol: string): TrackedTicker | undefined {
  return TICKERS.find((t) => t.symbol === symbol.toUpperCase());
}
