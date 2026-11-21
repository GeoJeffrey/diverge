import { describe, expect, it } from "vitest";
import { demoOutlookModel, demoOutlooks } from "@/mocks/fixtures";
import { edgeNote, headline, moveSentence, trackRecordSentence } from "./words";

const reliance = demoOutlooks.find((o) => o.symbol === "RELIANCE")!;
const sbin = demoOutlooks.find((o) => o.symbol === "SBIN")!;

describe("outlook wording", () => {
  it("never lets a lean read as a certainty", () => {
    expect(edgeNote(0.51)).toBe("Effectively a coin flip.");
    expect(edgeNote(0.534)).toBe("Close to a coin flip.");
    expect(edgeNote(0.47)).toBe("Close to a coin flip.");
    expect(edgeNote(0.62)).toBe("A lean, not a certainty.");
  });

  it("builds the headline only from API fields", () => {
    expect(headline(reliance)).toBe("53% chance RELIANCE closes higher after the 20 Nov close");
    expect(headline(sbin)).toBe("No outlook for SBIN yet");
  });

  it("states expected vs typical move", () => {
    expect(moveSentence(reliance)).toBe("Bigger move than usual: ±1.62% expected, against a typical ±1.18% (1.4×).");
  });

  it("quotes the track record for the call's own tier, next to the always-up baseline", () => {
    const s = trackRecordSentence(reliance, demoOutlookModel)!;
    const d = demoOutlookModel.track_record.direction!;
    expect(s).toContain("“Slight lean” calls");
    expect(s).toContain(`${(100 * d.slight_calls.accuracy!).toFixed(1)}%`);
    expect(s).toContain(`${(100 * d.always_up_accuracy).toFixed(1)}%`);
    expect(trackRecordSentence(reliance, undefined)).toBeNull();
  });
});
