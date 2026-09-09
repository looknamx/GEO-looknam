import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../lib/game";
import {
  DemoLocationProvider,
  FallbackLocationProvider,
  PoolExhaustedError,
  type GameLocation,
  type LocationSelectionOptions,
} from "../services/locations";
import {
  GoogleLocationProvider,
  googleMetadataUrl,
  googleStaticUrl,
} from "../services/google-locations";
import { MemoryLocationHistory } from "../services/location-history";
import { allowedOrigins, isOriginAllowed } from "../server/origin-policy";
const options = (
  change: Partial<LocationSelectionOptions> = {},
): LocationSelectionOptions => ({
  settings: { ...DEFAULT_SETTINGS, mode: "google", rounds: 3 },
  usedLocationKeys: new Set(),
  usedPositions: [],
  recentKeys: new Set(),
  remainingRounds: 1,
  ...change,
});
const seed = {
  id: "seed",
  name: "Test city",
  country: "Thailand",
  category: "city" as const,
  difficulty: "normal" as const,
  lat: 13.7,
  lng: 100.5,
  heading: 20,
};
const metadata = (id = "test-panorama") =>
  new Response(
    JSON.stringify({
      status: "OK",
      pano_id: id,
      location: { lat: seed.lat, lng: seed.lng },
      copyright: "provider attribution",
    }),
    { headers: { "content-type": "application/json" } },
  );
describe("Google provider and server-only URLs", () => {
  it("falls back without keys and never calls Google", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = new FallbackLocationProvider(
      new GoogleLocationProvider({ fetcher }),
      new DemoLocationProvider(),
      false,
    );
    expect((await provider.getNextLocation(options())).mode).toBe("demo");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    "REQUEST_DENIED",
    "OVER_QUERY_LIMIT",
    "INVALID_REQUEST",
    "UNKNOWN_ERROR",
  ])("falls back for %s without leaking upstream errors", async (status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status, error_message: "DO_NOT_EXPOSE_SERVER_KEY" }),
        ),
      );
    const provider = new FallbackLocationProvider(
      new GoogleLocationProvider({
        serverKey: "DO_NOT_EXPOSE_SERVER_KEY",
        seeds: [seed],
        fetcher,
      }),
      new DemoLocationProvider(),
      true,
    );
    const result = await provider.getNextLocation(options());
    expect(result.mode).toBe("demo");
    expect(JSON.stringify(result)).not.toContain("DO_NOT_EXPOSE");
  });
  it("falls back for network failure and malformed responses", async () => {
    for (const fetcher of [
      vi.fn<typeof fetch>().mockRejectedValue(new Error("secret URL")),
      vi.fn<typeof fetch>().mockResolvedValue(new Response("not JSON")),
    ]) {
      const provider = new FallbackLocationProvider(
        new GoogleLocationProvider({
          serverKey: "private",
          seeds: [seed],
          fetcher,
        }),
        new DemoLocationProvider(),
        true,
      );
      expect((await provider.getNextLocation(options())).mode).toBe("demo");
    }
  });
  it("retries missing coverage only within the configured attempt budget", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify({ status: "ZERO_RESULTS" })),
      );
    const google = new GoogleLocationProvider({
      serverKey: "private",
      seeds: [seed, { ...seed, id: "2" }, { ...seed, id: "3" }],
      maxAttempts: 2,
      fetcher,
    });
    const provider = new FallbackLocationProvider(
      google,
      new DemoLocationProvider(),
      true,
    );
    expect((await provider.getNextLocation(options())).mode).toBe("demo");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("uses the resolved panorama position and rejects used pano IDs", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => metadata());
    const provider = new GoogleLocationProvider({
      serverKey: "private",
      seeds: [seed],
      fetcher,
    });
    const result = await provider.getNextLocation(options());
    expect(result.key).toBe("google:test-panorama");
    expect(result.lat).toBe(seed.lat);
    await expect(
      provider.getNextLocation(
        options({ usedLocationKeys: new Set([result.key]) }),
      ),
    ).rejects.toMatchObject({ kind: "pool" });
  });
  it("does not relax recent history or proximity when exhausted", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => metadata());
    const provider = new GoogleLocationProvider({
      serverKey: "private",
      seeds: [seed],
      fetcher,
    });
    await expect(
      provider.getNextLocation(
        options({ recentKeys: new Set(["google:test-panorama"]) }),
      ),
    ).rejects.toMatchObject({ kind: "history" });
    await expect(
      provider.getNextLocation(
        options({ usedPositions: [{ lat: seed.lat, lng: seed.lng }] }),
      ),
    ).rejects.toMatchObject({ kind: "pool" });
  });
  it("does not hide Google pool exhaustion by silently switching providers", async () => {
    const google = {
      getNextLocation: async () => {
        throw new PoolExhaustedError("history", "confirm first");
      },
    };
    await expect(
      new FallbackLocationProvider(
        google,
        new DemoLocationProvider(),
        true,
      ).getNextLocation(options()),
    ).rejects.toMatchObject({ kind: "history" });
  });
  it("constructs HTTPS upstream URLs with query encoding and optional signature", () => {
    const meta = googleMetadataUrl(seed, "server&key");
    expect(meta.searchParams.get("key")).toBe("server&key");
    expect(meta.protocol).toBe("https:");
    const location = {
      ...seed,
      key: "google:pano",
      mode: "google",
      panoId: "pano&secret",
      image: "",
      description: "",
      source: "",
      credit: "",
    } satisfies GameLocation;
    const url = googleStaticUrl(
      location,
      "server-key",
      Buffer.from("signing-secret").toString("base64url"),
    );
    expect(url.searchParams.get("pano")).toBe("pano&secret");
    expect(url.searchParams.get("signature")).toBeTruthy();
    expect(url.searchParams.get("return_error_code")).toBe("true");
    expect(url.searchParams.has("location")).toBe(false);
  });
  it("does not return upstream headers, URLs or error bodies on static-image failure", async () => {
    const provider = new GoogleLocationProvider({
      serverKey: "VERY_PRIVATE",
      fetcher: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("VERY_PRIVATE", { status: 403 })),
    });
    await expect(
      provider.loadImage({
        ...seed,
        mode: "google",
        key: "google:p",
        panoId: "p",
        image: "",
        source: "",
        description: "",
        credit: "",
      }),
    ).rejects.toThrow("Google Maps ใช้งานไม่ได้");
  });
});
describe("recent location history", () => {
  it("stores bounded identifiers and timestamps only and updates duplicate recency", async () => {
    const history = new MemoryLocationHistory(2);
    await history.record("demo:1");
    await history.record("google:pano");
    await history.record("demo:1");
    await history.record("demo:3");
    const rows = await history.list();
    expect(rows.map((r) => r.key)).toEqual(["demo:1", "demo:3"]);
    expect(Object.keys(rows[0]).sort()).toEqual(["key", "timestamp"]);
  });
  it("requires confirmation when recent IDs consume the remaining pool", async () => {
    const provider = new DemoLocationProvider();
    const first = await provider.getNextLocation(
      options({ settings: { ...DEFAULT_SETTINGS, category: "thailand" } }),
    );
    await expect(
      new DemoLocationProvider([first]).getNextLocation(
        options({ recentKeys: new Set([first.key]) }),
      ),
    ).rejects.toMatchObject({ kind: "history" });
  });
});
describe("Railway origin policy", () => {
  it("accepts only configured HTTPS origins in production", () => {
    const origins = allowedOrigins("https://game.example", true);
    expect(
      isOriginAllowed("https://game.example", "internal", origins, true),
    ).toBe(true);
    expect(
      isOriginAllowed("https://evil.example", "internal", origins, true),
    ).toBe(false);
    expect(
      isOriginAllowed("http://game.example", "game.example", [], true),
    ).toBe(false);
    expect(() => allowedOrigins("http://game.example", true)).toThrow();
  });
  it("supports same-origin LAN development and server health clients", () => {
    expect(
      isOriginAllowed("http://192.168.1.2:3000", "192.168.1.2:3000", [], false),
    ).toBe(true);
    expect(isOriginAllowed(undefined, "internal", [], true)).toBe(true);
    expect(isOriginAllowed("garbage", "internal", [], false)).toBe(false);
  });
});
