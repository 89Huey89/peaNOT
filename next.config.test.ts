import { describe, expect, it } from "vitest";
import nextConfig from "./next.config.mjs";

describe("next.config headers()", () => {
  it("sets the camera-only permissions policy plus frame/content-type hardening on every route", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    const rule = rules[0]!;
    expect(rule.source).toBe("/:path*");

    const byKey = Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
    expect(byKey["Permissions-Policy"]).toBe(
      "camera=(self), microphone=(), geolocation=()",
    );
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
  });
});
