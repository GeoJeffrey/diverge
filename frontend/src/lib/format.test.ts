import { describe, expect, it } from "vitest";
import { dayLabel, leanWords, move, pct, ratio, riskFromFlag, riskFromTrustLabel } from "./format";

describe("format", () => {
  it("formats percentages and moves, with a dash for missing values", () => {
    expect(pct(0.534)).toBe("53%");
    expect(pct(0.5264, 1)).toBe("52.6%");
    expect(pct(null)).toBe("–");
    expect(move(1.616)).toBe("±1.62%");
    expect(move(null)).toBe("–");
    expect(ratio(2, 1.6)).toBeCloseTo(1.25);
    expect(ratio(2, 0)).toBeNull();
  });

  it("words the lean the same way the API's thresholds do", () => {
    expect(leanWords({ lean: "up", lean_strength: "lean" })).toBe("Leans up");
    expect(leanWords({ lean: "down", lean_strength: "slight" })).toBe("Slight lean down");
    expect(leanWords({ lean: "neutral", lean_strength: "none" })).toBe("No clear lean");
    expect(leanWords({ lean: null, lean_strength: null })).toBe("No clear lean");
  });

  it("translates the API's trust wording into coordination risk (higher = more coordinated)", () => {
    expect(riskFromTrustLabel("High confidence")).toBe("low");
    expect(riskFromTrustLabel("Moderate confidence - treat with caution")).toBe("moderate");
    expect(riskFromTrustLabel("Low confidence - possible manipulation detected")).toBe("high");
    expect(riskFromTrustLabel(undefined)).toBe("unknown");
    expect(riskFromFlag("high_trust")).toBe("low");
    expect(riskFromFlag("low_trust")).toBe("high");
    expect(riskFromFlag("insufficient_data")).toBe("unknown");
  });

  it("labels trading days without shifting time zones", () => {
    expect(dayLabel("2026-11-20")).toBe("20 Nov");
    expect(dayLabel(null)).toBe("");
  });
});
