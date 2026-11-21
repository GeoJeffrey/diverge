import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api, ApiError } from "@/lib/api";
import { renderAt } from "@/test/render";
import MarketPage from "./MarketPage";

describe("MarketPage", () => {
  it("shows a loading state, then all 16 names grouped by exchange", async () => {
    renderAt(<MarketPage />);
    expect(screen.getByRole("status", { name: "Loading outlooks" })).toBeInTheDocument();
    const dalal = await screen.findByRole("table", { name: /Dalal Street/ });
    const wall = screen.getByRole("table", { name: /Wall Street/ });
    expect(within(dalal).getAllByRole("rowheader")).toHaveLength(11);
    expect(within(wall).getAllByRole("rowheader")).toHaveLength(5);
    expect(screen.getByText(/14 of 16 names have a call/)).toBeInTheDocument();
  });

  it("filters by name, symbol or sector, and says when nothing matches", async () => {
    renderAt(<MarketPage />);
    await screen.findByRole("table", { name: /Dalal Street/ });
    const filter = screen.getByLabelText("Filter");
    await userEvent.type(filter, "bank");
    expect(screen.getAllByRole("rowheader").map((r) => r.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("HDFCBANK"), expect.stringContaining("ICICIBANK")]),
    );
    expect(screen.queryByRole("table", { name: /Wall Street/ })).toBeNull();
    await userEvent.clear(filter);
    await userEvent.type(filter, "zzz");
    expect(screen.getByText(/No tracked name matches/)).toBeInTheDocument();
  });

  it("sorts by chance of a higher close", async () => {
    renderAt(<MarketPage />);
    await screen.findByRole("table", { name: /Dalal Street/ });
    await userEvent.selectOptions(screen.getByLabelText("Sort by"), "chance");
    const dalal = screen.getByRole("table", { name: /Dalal Street/ });
    expect(within(dalal).getAllByRole("rowheader")[0]).toHaveTextContent("INFY");
  });

  it("shows an error with a retry when the API fails", async () => {
    vi.spyOn(api, "outlooks").mockRejectedValue(new ApiError(503, { error_code: "UNAVAILABLE", message: "Database unavailable." }));
    renderAt(<MarketPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
