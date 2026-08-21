import type { CSSProperties, ReactNode } from "react";
import type { Palette } from "@/lib/theme";
import { VERDICT, verdictColor, type Verdict } from "@/lib/verdict";
import { History, ScanLine, User } from "lucide-react";

const SERIF = "'Fraunces', serif";
const MONO = "'JetBrains Mono', monospace";

export function Logo({ P, size = 28 }: { P: Palette; size?: number }) {
  const base: CSSProperties = {
    fontFamily: SERIF,
    fontWeight: 800,
    fontSize: size,
    letterSpacing: -1,
  };
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 1, lineHeight: 1, color: P.INK }}>
      <span style={base}>pea</span>
      <span style={{ ...base, fontStyle: "italic", color: P.ACCENT }}>NOT</span>
      <span style={base}>.</span>
    </div>
  );
}

export function Mono({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: ".14em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function SectionTitle({
  children,
  italic = true,
}: {
  children: ReactNode;
  italic?: boolean;
}) {
  return (
    <h2
      style={{
        fontFamily: SERIF,
        fontWeight: 800,
        fontStyle: italic ? "italic" : "normal",
        fontSize: 26,
        letterSpacing: -0.4,
        margin: "0 0 10px",
      }}
    >
      {children}
    </h2>
  );
}

const STAMP_SIZE = 88;
// Usable width inside the circle: the ring is 3px double on both sides and the
// text still has to clear the curve, so we keep a margin off the diameter.
const STAMP_INNER = 62;

/**
 * The stamp is a fixed-diameter circle but the words are not fixed length:
 * "vorbehalt" is more than twice as wide as "safe" at the same size. Without
 * this the long ones bleed out of the ring and collide with the verdict text
 * beside them (worst on narrow phones). So the word shrinks to fit its own
 * length, and the subline wraps instead of running past the edge.
 *
 * The divisors are the rough average glyph advance per font: ~0.52em for
 * Fraunces 800 italic, ~0.74em for the mono subline (0.6em advance plus its
 * .14em tracking).
 */
function stampWordSize(word: string): number {
  return Math.min(24, Math.floor((STAMP_INNER / (word.length * 0.52)) * 10) / 10);
}

function stampSubSize(sub: string): number {
  const longestChunk = sub.split(" ").reduce((a, b) => (b.length > a.length ? b : a), "");
  return Math.min(8, Math.floor((STAMP_INNER / (longestChunk.length * 0.74)) * 10) / 10);
}

export function Stamp({
  verdict,
  P,
  animate = true,
  colorOverride,
}: {
  verdict: Verdict;
  P: Palette;
  animate?: boolean;
  /** Recolor the stamp without changing its word/category — used when strict
   * mode treats a trace like a hit but "spuren" must stay legible. */
  colorOverride?: string;
}) {
  const fg = colorOverride ?? verdictColor(verdict, P);
  const { stampWord, stampSub } = VERDICT[verdict];
  return (
    <div
      className={animate ? "stamp-in" : undefined}
      style={{
        width: STAMP_SIZE,
        height: STAMP_SIZE,
        borderRadius: 99,
        color: fg,
        border: `3px double ${fg}`,
        display: "grid",
        placeItems: "center",
        transform: "rotate(-8deg)",
        animation: animate ? "stampIn .55s cubic-bezier(.2,1.3,.4,1) both" : "none",
        textAlign: "center",
        lineHeight: 1,
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ width: STAMP_INNER }}>
        <div
          data-stamp="word"
          style={{
            fontFamily: SERIF,
            fontWeight: 800,
            fontSize: stampWordSize(stampWord),
            fontStyle: "italic",
          }}
        >
          {stampWord}
        </div>
        <Mono
          style={{
            display: "block",
            fontSize: stampSubSize(stampSub),
            opacity: 0.85,
            lineHeight: 1.3,
            marginTop: 2,
            // letter-spacing also trails the last glyph, which pushes the line
            // off-centre inside the circle; pull it back.
            marginRight: "-.14em",
          }}
        >
          {stampSub}
        </Mono>
      </div>
    </div>
  );
}

export type ChipTone = "ok" | "bad" | "warn" | "info" | "neutral";

export function Chip({
  children,
  tone = "neutral",
  P,
}: {
  children: ReactNode;
  tone?: ChipTone;
  P: Palette;
}) {
  const c =
    tone === "ok"
      ? { fg: P.GREEN, bg: `${P.GREEN}10`, bd: P.GREEN }
      : tone === "bad"
        ? { fg: P.RED, bg: `${P.RED}10`, bd: P.RED }
        : tone === "warn"
          ? { fg: P.AMBER, bg: `${P.AMBER}12`, bd: P.AMBER }
          : tone === "info"
            ? { fg: P.INK, bg: `${P.INK}06`, bd: `${P.INK}33` }
            : { fg: P.INK, bg: "transparent", bd: `${P.INK}33` };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11.5,
        padding: "5px 9px",
        borderRadius: 99,
        border: `1px solid ${c.bd}`,
        color: c.fg,
        background: c.bg,
        fontWeight: 600,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export type Tab = "scan" | "verlauf" | "profil";

export function TabBar({
  P,
  tab,
  onTab,
}: {
  P: Palette;
  tab: Tab;
  onTab: (t: Tab) => void;
}) {
  const items: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "scan", label: "Scan", icon: <ScanLine size={16} aria-hidden="true" /> },
    { id: "verlauf", label: "Verlauf", icon: <History size={16} aria-hidden="true" /> },
    { id: "profil", label: "Profil", icon: <User size={16} aria-hidden="true" /> },
  ];
  return (
    <nav
      aria-label="Hauptnavigation"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "10px 18px calc(10px + env(safe-area-inset-bottom))",
        background: `${P.BG}f0`,
        backdropFilter: "blur(10px)",
        borderTop: `1px solid ${P.INK}1a`,
        display: "flex",
        gap: 8,
      }}
    >
      {items.map((it) => {
        const active = it.id === tab;
        return (
          <button
            key={it.id}
            type="button"
            className="tap"
            onClick={() => onTab(it.id)}
            aria-current={active ? "page" : undefined}
            style={{
              flex: 1,
              background: active ? P.INK : "transparent",
              color: active ? P.BG : P.INK,
              border: 0,
              borderRadius: 99,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 13.5,
              fontWeight: 600,
              fontFamily: "inherit",
              transition: "background .18s ease",
            }}
          >
            <span style={{ display: "flex", opacity: active ? 1 : 0.6 }}>{it.icon}</span>
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, P }: { children: ReactNode; P: Palette }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: P.BG,
        color: P.INK,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {children}
    </div>
  );
}

export function TopBar({ P, right = null }: { P: Palette; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "calc(8px + env(safe-area-inset-top)) 22px 8px",
      }}
    >
      <Logo P={P} />
      <div>{right}</div>
    </div>
  );
}
