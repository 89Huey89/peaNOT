import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFoodWarnings } from "@/lib/recalls/client";
import {
  LMW_API_URL,
  LMW_AUTH_HEADER,
  LMW_REVALIDATE_S,
  LMW_ROWS,
} from "@/lib/config";

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

const NOW = 1_763_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

describe("fetchFoodWarnings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts the documented food query and parses docs defensively", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        docs: [
          {
            _type: ".FoodWarning",
            title: "ültje Erdnüsse pikant gewürzt, 180 Gramm",
            link: "https://www.lebensmittelwarnung.de/x",
            publishedDate: 1_762_000_000_000,
            product: {
              designation: "Erdnüsse",
              brandName: "ültje",
              manufacturer: "ültje GmbH",
            },
            warning: "Nicht deklarierte Cashewkerne",
          },
          // Unusable docs are dropped, never fatal.
          { _type: ".FoodWarning" },
          "garbage",
          null,
        ],
        numFound: 2,
      }),
    );

    const outcome = await fetchFoodWarnings(NOW);

    expect(outcome).toEqual({
      kind: "ok",
      warnings: [
        {
          title: "ültje Erdnüsse pikant gewürzt, 180 Gramm",
          link: "https://www.lebensmittelwarnung.de/x",
          publishedDate: 1_762_000_000_000,
          extraText: "Erdnüsse ültje ültje GmbH Nicht deklarierte Cashewkerne",
        },
      ],
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe(LMW_API_URL);
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      LMW_AUTH_HEADER,
    );
    expect((init as { next?: { revalidate?: number } }).next?.revalidate).toBe(
      LMW_REVALIDATE_S,
    );

    const body = JSON.parse(init?.body as string) as {
      food: { rows: number; fq: string[] };
    };
    expect(body.food.rows).toBe(LMW_ROWS);
    // The cutoff is rounded to a full day so the POST body — part of the
    // cache key — stays stable across scans within a day.
    const cutoff = Number(body.food.fq[0]!.replace("publishedDate > ", ""));
    expect(cutoff % DAY_MS).toBe(0);
    expect(cutoff).toBeLessThan(NOW);
  });

  it("maps HTTP errors to an error outcome", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));
    expect(await fetchFoodWarnings(NOW)).toEqual({ kind: "error", cause: "http" });
  });

  it("maps invalid JSON to a parse error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad json");
      },
    } as unknown as Response);
    expect(await fetchFoodWarnings(NOW)).toEqual({ kind: "error", cause: "parse" });
  });

  it("maps a body without docs array to a parse error", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ numFound: 0 }));
    expect(await fetchFoodWarnings(NOW)).toEqual({ kind: "error", cause: "parse" });
  });

  it("maps an aborted request to a timeout error", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    vi.mocked(fetch).mockRejectedValue(abortError);
    expect(await fetchFoodWarnings(NOW)).toEqual({ kind: "error", cause: "timeout" });
  });

  it("maps network failures to a network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    expect(await fetchFoodWarnings(NOW)).toEqual({ kind: "error", cause: "network" });
  });
});
