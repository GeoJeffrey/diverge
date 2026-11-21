import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { api } from "@/lib/api";
import { demoOutlookModel } from "@/mocks/fixtures";
import { renderAt } from "@/test/render";
import ModelPage from "./ModelPage";

describe("ModelPage", () => {
  it("compares accuracy with the always-up baseline using the API's numbers", async () => {
    renderAt(<ModelPage />);
    const d = demoOutlookModel.track_record.direction!;
    expect(await screen.findByRole("heading", { name: /close to a coin flip/i })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`right ${(100 * d.accuracy).toFixed(1)}% of the time`))).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(`${(100 * d.always_up_accuracy).toFixed(1)}%`)).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /Calibration of the up\/down estimate/ })).toBeInTheDocument();
  });

  it("shows an untrained-model state instead of empty charts", async () => {
    vi.spyOn(api, "outlookModel").mockResolvedValue({
      available: false, version: null, trained_at: null, training_data: {}, track_record: {}, features: [], disclaimer: "x",
    });
    renderAt(<ModelPage />);
    expect(await screen.findByText("The outlook model hasn't been trained yet")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Calibration/ })).toBeNull();
  });
});
