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

export function Stamp({
  verdict,
  P,
  animate = true,
}: {
  verdict: Verdict;
  P: Palette;
  animate?: boolean;
}) {
  const fg = verdictColor(verdict, P);
  const { stampWord, stampSub } = VERDICT[verdict];
  return (
    <div
      className={animate ? "stamp-in" : undefined}
      style={{
        width: 88,
        height: 88,
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
      }}
    >
      <div>
        <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 24, fontStyle: "italic" }}>
          {stampWord}
        </div>
        <Mono style={{ fontSize: 8, opacity: 0.85 }}>{stampSub}</Mono>
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
