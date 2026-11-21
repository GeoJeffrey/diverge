import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { AuthProvider } from "@/auth/AuthProvider";
import { renderAt } from "@/test/render";
import { RequireAuth } from "./RequireAuth";
import { Shell, WakingBanner } from "./Shell";

function Slow() {
  useQuery({ queryKey: ["slow"], queryFn: () => new Promise(() => {}) });
  return null;
}

describe("app shell", () => {
  it("marks demo data on every page so it can't be mistaken for live readings", async () => {
    const client = new QueryClient();
    const router = createMemoryRouter([{ path: "/", Component: Shell, children: [{ index: true, element: <p>page</p> }] }]);
    render(<QueryClientProvider client={client}><AuthProvider><RouterProvider router={router} /></AuthProvider></QueryClientProvider>);
    expect(await screen.findByText("Demo data.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
  });

  it("explains a slow (sleeping) API after 4 seconds", () => {
    vi.useFakeTimers();
    try {
      const client = new QueryClient();
      render(<QueryClientProvider client={client}><WakingBanner /><Slow /></QueryClientProvider>);
      act(() => { vi.advanceTimersByTime(50); }); // flush React Query's batched "fetching" notification
      expect(screen.queryByText(/Waking up the free server/)).toBeNull();
      act(() => { vi.advanceTimersByTime(4100); });
      expect(screen.getByText(/Waking up the free server, this can take up to a minute/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends signed-out visitors to sign in, keeping where they were going", async () => {
    const { router } = renderAt(<RequireAuth><p>secret</p></RequireAuth>, { path: "/ticker/:symbol/advanced", url: "/ticker/INFY/advanced" });
    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?next=%2Fticker%2FINFY%2Fadvanced");
    expect(screen.queryByText("secret")).toBeNull();
  });
});
