import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Stamp } from "@/components/ui";
import { palette } from "@/lib/theme";
import { VERDICT, type Verdict } from "@/lib/verdict";

const VERDICTS = Object.keys(VERDICT) as Verdict[];

// Rough average glyph advance per font, mirroring the sizing in ui.tsx. The
// stamp is a fixed 88px circle, so the widest line has to stay inside it.
const SERIF_ADVANCE = 0.52;
const MONO_ADVANCE = 0.74;
const MAX_LINE = 68;

// jsdom reports inline styles as rgb(), so compare against a converted hex.
function hexToRgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

function renderStamp(verdict: Verdict, colorOverride?: string) {
  const { container } = render(
    <Stamp
      verdict={verdict}
      P={palette("mustard")}
      animate={false}
      colorOverride={colorOverride}
    />,
  );
  const word = container.querySelector("[data-stamp='word']") as HTMLElement;
  const sub = container.querySelector("span") as HTMLElement;
  const ring = container.firstElementChild as HTMLElement;
  return { word, sub, ring };
}

describe("Stamp", () => {
  it.each(VERDICTS)("keeps the %s word inside the circle", (verdict) => {
    const { word } = renderStamp(verdict);
    const size = Number.parseFloat(word.style.fontSize);

    expect(word.textContent).toBe(VERDICT[verdict].stampWord);
    expect(size).toBeLessThanOrEqual(24);
    expect(word.textContent!.length * SERIF_ADVANCE * size).toBeLessThanOrEqual(MAX_LINE);
  });

  it.each(VERDICTS)("keeps the %s subline inside the circle", (verdict) => {
    const { sub } = renderStamp(verdict);
    const size = Number.parseFloat(sub.style.fontSize);
    const longestChunk = sub
      .textContent!.split(" ")
      .reduce((a, b) => (b.length > a.length ? b : a), "");

    expect(size).toBeLessThanOrEqual(8);
    expect(longestChunk.length * MONO_ADVANCE * size).toBeLessThanOrEqual(MAX_LINE);
  });

  it.each(["trace", "partial"] as Verdict[])(
    "prints the %s stamp in the readable amber, not the fill amber",
    (verdict) => {
      const P = palette("mustard");
      const { ring } = renderStamp(verdict);

      expect(ring.style.color).toBe(hexToRgb(P.AMBER_TEXT));
      expect(ring.style.color).not.toBe(hexToRgb(P.AMBER));
    },
  );

  it("still lets a caller override the color (strict mode)", () => {
    const P = palette("mustard");
    const { ring } = renderStamp("trace", P.RED);

    expect(ring.style.color).toBe(hexToRgb(P.RED));
  });
});
