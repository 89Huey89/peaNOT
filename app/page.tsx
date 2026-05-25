"use client";

import dynamic from "next/dynamic";
import ManualEntry from "@/components/ManualEntry";
import ResultDisplay from "@/components/ResultDisplay";
import { useProductLookup } from "@/components/useProductLookup";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), {
  ssr: false,
  loading: () => <p className="scanner__hint">Kamera wird geladen…</p>,
});

export default function Home() {
  const { loading, result, lookup } = useProductLookup();

  return (
    <main className="page">
      <header className="page__header">
        <h1 className="page__title">peaNOT</h1>
        <p className="page__subtitle">Erdnuss-Check per Barcode</p>
      </header>

      <BarcodeScanner onDetected={lookup} />

      <ManualEntry onSubmit={lookup} disabled={loading} />

      {loading ? <p className="page__loading">Prüfe Produkt…</p> : null}

      {result ? <ResultDisplay result={result} /> : null}

      <p className="page__disclaimer">
        Kein Erdnuss-Hinweis in der Datenbank gefunden bedeutet nicht garantiert
        erdnussfrei.
      </p>
    </main>
  );
}
