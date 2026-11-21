import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Fork } from "./Fork";

function widths(container: HTMLElement) {
  const paths = container.querySelectorAll("path[stroke='var(--up)'], path[stroke='var(--down)']");
  const get = (c: string) => Number([...paths].find((p) => p.getAttribute("stroke") === c)!.getAttribute("stroke-width"));
  return { up: get("var(--up)"), down: get("var(--down)") };
}

describe("Fork", () => {
  it("exposes the reading as an accessible image", () => {
    render(<Fork probUp={0.53} expected={1.6} typical={1.2} label="RELIANCE outlook: 53% higher" />);
    expect(screen.getByRole("img", { name: "RELIANCE outlook: 53% higher" })).toBeInTheDocument();
    expect(screen.getByText("53%")).toBeInTheDocument();
    expect(screen.getByText("47%")).toBeInTheDocument();
  });

  it("makes the likelier branch thicker, and a coin flip symmetric", () => {
    const up = render(<Fork probUp={0.7} expected={1} typical={1} label="a" />);
    const w = widths(up.container);
    expect(w.up).toBeGreaterThan(w.down);
    up.unmount();
    const flat = render(<Fork probUp={0.5} expected={1} typical={1} label="b" />);
    const f = widths(flat.container);
    expect(f.up).toBeCloseTo(f.down);
  });

  it("draws a no-call state instead of inventing a fork", () => {
    const { container } = render(<Fork probUp={null} expected={null} typical={null} label="no call" />);
    expect(screen.getByText("no call yet")).toBeInTheDocument();
    expect(container.querySelector("path[stroke='var(--up)']")).toBeNull();
  });
});
