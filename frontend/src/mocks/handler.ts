import type {
  AuthTokenResponse,
  ErrorResponse,
  LoginRequest,
  RefreshTokenRequest,
  SignupRequest,
} from "@/types/api";
import {
  advancedBySymbol,
  demoOutlookModel,
  demoOutlooks,
  health,
  issueTokens,
  mockUsers,
  reasoningBySymbol,
  simpleFor,
  tickerList,
} from "./fixtures";

interface MockResult {
  status: number;
  body: unknown;
}

function jsonError(status: number, error_code: string, message: string, details?: Record<string, unknown>): MockResult {
  const body: ErrorResponse = { error_code, message, details: details ?? null };
  return { status, body };
}

function parsePath(url: string): { pathname: string; search: URLSearchParams } {
  const u = new URL(url, "http://mock.local");
  return { pathname: u.pathname.replace(/\/$/, "") || "/", search: u.searchParams };
}

export async function mockRequest(method: string, url: string, body?: unknown, accessToken?: string | null): Promise<MockResult> {
  const { pathname, search } = parsePath(url);
  const m = method.toUpperCase();
  const window = search.get("window");

  if (m === "GET" && pathname === "/health") {
    return { status: 200, body: { ...health, timestamp_utc: new Date().toISOString() } };
  }

  if (m === "POST" && pathname === "/auth/signup") {
    const req = body as SignupRequest;
    if (!req?.email || !req.password || !req.full_name) {
      return jsonError(400, "INVALID_INPUT", "email, password, and full_name are required.");
    }
    if (req.password.length < 8) {
      return jsonError(400, "INVALID_INPUT", "Password must be at least 8 characters.", { field: "password" });
    }
    if (mockUsers.some((u) => u.email.toLowerCase() === req.email.toLowerCase())) {
      return jsonError(400, "EMAIL_TAKEN", "This email is already registered.", { field: "email" });
    }
    const user = {
      id: crypto.randomUUID(),
      email: req.email,
      password: req.password,
      full_name: req.full_name,
      role: "standard" as const,
      created_at: new Date().toISOString(),
    };
    mockUsers.push(user);
    return { status: 201, body: issueTokens(user.id) };
  }

  if (m === "POST" && pathname === "/auth/login") {
    const req = body as LoginRequest;
    const user = mockUsers.find(
      (u) => u.email.toLowerCase() === req?.email?.toLowerCase() && u.password === req.password,
    );
    if (!user) {
      return jsonError(401, "INVALID_CREDENTIALS", "Invalid email or password provided.");
    }
    return { status: 200, body: issueTokens(user.id) };
  }

  if (m === "POST" && pathname === "/auth/refresh") {
    const req = body as RefreshTokenRequest;
    if (!req?.refresh_token?.startsWith("mock-refresh.")) {
      return jsonError(401, "INVALID_REFRESH", "Invalid or expired refresh token.");
    }
    const userId = req.refresh_token.split(".")[1] ?? "unknown";
    return { status: 200, body: issueTokens(userId) };
  }

  if (m === "GET" && pathname === "/auth/me") {
    if (!accessToken?.startsWith("mock-access.")) {
      return jsonError(401, "UNAUTHORIZED", "Missing, invalid, or expired authorization header.");
    }
    const userId = accessToken.split(".")[1];
    const user = mockUsers.find((u) => u.id === userId) ?? mockUsers[0];
    return {
      status: 200,
      body: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        created_at: user.created_at,
      },
    };
  }

  if (m === "GET" && pathname === "/tickers") {
    return { status: 200, body: { total: tickerList.length, tickers: tickerList } };
  }

  if (m === "GET" && pathname === "/outlook") {
    return { status: 200, body: { total: demoOutlooks.length, outlooks: demoOutlooks } };
  }

  if (m === "GET" && pathname === "/outlook/model") {
    return { status: 200, body: demoOutlookModel };
  }

  const outlookMatch = pathname.match(/^\/ticker\/([^/]+)\/outlook$/);
  if (m === "GET" && outlookMatch) {
    const symbol = decodeURIComponent(outlookMatch[1]).toUpperCase();
    const hit = demoOutlooks.find((o) => o.symbol === symbol);
    return {
      status: 200,
      body: hit ?? {
        symbol, name: symbol, available: false, coverage_note: "No outlook has been computed for this ticker yet.",
        as_of_day: null, prob_up: null, lean: null, lean_strength: null, expected_move_pct: null,
        typical_move_pct: null, move_label: null, direction_drivers: [], move_drivers: [],
        coordination_flag: null, coordination_dampened: false, posts_today: null, model_version: null,
        generated_at: null, disclaimer: demoOutlookModel.disclaimer,
      },
    };
  }

  const tickerMatch = pathname.match(/^\/ticker\/([^/]+)$/);
  if (m === "GET" && tickerMatch) {
    const symbol = decodeURIComponent(tickerMatch[1]).toUpperCase();
    const data = advancedBySymbol[symbol];
    if (!data) return jsonError(404, "NOT_FOUND", `Ticker or requested metric window not found.`);
    return { status: 200, body: window ? { ...data, window_start_utc: window } : data };
  }

  const simpleMatch = pathname.match(/^\/ticker\/([^/]+)\/simple$/);
  if (m === "GET" && simpleMatch) {
    const symbol = decodeURIComponent(simpleMatch[1]).toUpperCase();
    const data = simpleFor(symbol);
    if (!data) return jsonError(404, "NOT_FOUND", `Ticker or requested metric window not found.`);
    return { status: 200, body: window ? { ...data, window_start_utc: window } : data };
  }

  const reasoningMatch = pathname.match(/^\/ticker\/([^/]+)\/reasoning$/);
  if (m === "GET" && reasoningMatch) {
    const symbol = decodeURIComponent(reasoningMatch[1]).toUpperCase();
    const data = reasoningBySymbol[symbol];
    if (!data) return jsonError(404, "NOT_FOUND", "Ticker or reasoning traces not found.");
    return { status: 200, body: window ? { ...data, window_start_utc: window } : data };
  }

  return jsonError(404, "NOT_FOUND", `No mock handler for ${m} ${pathname}`);
}

export type { AuthTokenResponse };
