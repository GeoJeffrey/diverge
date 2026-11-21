import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { demoOutlookModel, demoOutlooks } from "@/mocks/fixtures";
import { renderAt } from "@/test/render";
import { OutlookPanel } from "./OutlookPanel";

const by = (s: string) => demoOutlooks.find((o) => o.symbol === s)!;

describe("OutlookPanel", () => {
  it("shows the call with its disclaimer and a link to the track record", async () => {
    renderAt(<OutlookPanel o={by("RELIANCE")} model={demoOutlookModel} />);
    expect(await screen.findByRole("heading", { name: /53% chance RELIANCE closes higher/ })).toBeInTheDocument();
    expect(screen.getByText(/Close to a coin flip/)).toBeInTheDocument();
    expect(screen.getByText(/Not investment advice/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How accurate is this?" })).toHaveAttribute("href", "/model");
    expect(screen.getByText(/always guessing “up” was right/i)).toBeInTheDocument();
  });

  it("shows the coverage note when there is no outlook", async () => {
    renderAt(<OutlookPanel o={by("SBIN")} model={demoOutlookModel} />);
    expect(await screen.findByText("Not enough history for a call")).toBeInTheDocument();
    expect(screen.getByText(/Needs about 2 weeks of post history/)).toBeInTheDocument();
    expect(screen.queryByText(/chance SBIN closes higher/)).toBeNull();
  });

  it("warns when coordination pulled the estimate toward 50/50", async () => {
    renderAt(<OutlookPanel o={by("HDFCBANK")} model={demoOutlookModel} />);
    expect(await screen.findByText(/looks coordinated/)).toBeInTheDocument();
    expect(screen.getByText(/pulled toward 50\/50/)).toBeInTheDocument();
  });
});
