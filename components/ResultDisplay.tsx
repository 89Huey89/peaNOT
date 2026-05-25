import type { PeanutStatus, ProductResult } from "@/lib/types";

interface StatusMeta {
  label: string;
  sub: string;
  className: string;
}

export const STATUS_META: Record<PeanutStatus, StatusMeta> = {
  JA: {
    label: "ERDNUSS: JA",
    sub: "Dieses Produkt enthält Erdnuss bzw. einen Erdnuss-Hinweis.",
    className: "status status--ja",
  },
  SPUREN: {
    label: "KANN SPUREN ENTHALTEN",
    sub: "Spuren von Erdnuss sind laut Hersteller möglich.",
    className: "status status--spuren",
  },
  NEIN: {
    label: "ERDNUSS: NEIN",
    sub: "Kein Erdnuss-Hinweis in den vorhandenen Daten gefunden.",
    className: "status status--nein",
  },
  KEINE_DATEN: {
    label: "KEINE DATEN",
    sub: "Erdnuss kann NICHT ausgeschlossen werden.",
    className: "status status--keine-daten",
  },
};

export default function ResultDisplay({ result }: { result: ProductResult }) {
  const meta = STATUS_META[result.status];

  return (
    <section className={meta.className} role="status" aria-live="polite">
      <p className="product-name">{result.productName ?? "Unbekanntes Produkt"}</p>
      {result.brand ? <p className="brand">{result.brand}</p> : null}
      <p className="status-label">{meta.label}</p>
      <p className="status-sub">{result.message ?? meta.sub}</p>
    </section>
  );
}
