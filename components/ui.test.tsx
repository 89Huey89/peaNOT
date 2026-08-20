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

function renderStamp(verdict: Verdict) {
  const { container } = render(<Stamp verdict={verdict} P={palette("mustard")} animate={false} />);
  const word = container.querySelector("[data-stamp='word']") as HTMLElement;
  const sub = container.querySelector("span") as HTMLElement;
  return { word, sub };
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
});
