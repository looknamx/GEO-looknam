import { describe, expect, it } from "vitest";
import { capitalCandidates, randomPointAround } from "../services/capital-candidates";
import { GoogleLocationProvider } from "../services/google-locations";
import { DEFAULT_SETTINGS, haversine } from "../lib/game";

describe("capital sampling", () => {
  it("keeps points in the requested radius across the date line and high latitudes", () => {
    for (const center of [{ lat: 80, lng: 179.99 }, { lat: -41, lng: -179.99 }]) {
      for (let i = 0; i < 100; i++) {
        const point = randomPointAround(center, 25);
        expect(haversine(center, point)).toBeLessThanOrEqual(25.00001);
        expect(point.lng).toBeGreaterThanOrEqual(-180);
        expect(point.lng).toBeLessThan(180);
      }
    }
  });
  it("supports ten rounds in Thailand without requiring ten different capitals", () => {
    const candidates = capitalCandidates({ ...DEFAULT_SETTINGS, category: "thailand" }, 12);
    expect(candidates).toHaveLength(12);
    expect(candidates.every(c => c.name === "Bangkok")).toBe(true);
    expect(new Set(candidates.map(c => `${c.lat},${c.lng}`)).size).toBe(12);
  });
  it("resolves fresh random candidates and retries duplicate panoramas", async () => {
    let calls = 0;
    const provider = new GoogleLocationProvider({ serverKey: "test-placeholder", fetcher: async input => {
      const url = new URL(String(input));
      const [lat, lng] = url.searchParams.get("location")!.split(",").map(Number);
      expect(url.searchParams.get("source")).toBe("outdoor");
      return new Response(JSON.stringify({ status: "OK", pano_id: ++calls === 1 ? "old" : "fresh", location: { lat, lng } }));
    } });
    const result = await provider.getNextLocation({
      settings: { ...DEFAULT_SETTINGS, mode: "google", category: "thailand", rounds: 10 },
      remainingRounds: 10, usedLocationKeys: new Set(["google:old"]), usedPositions: [], recentKeys: new Set(),
    });
    expect(result.key).toBe("google:fresh");
    expect(result.country).toBe("Thailand");
    expect(calls).toBe(2);
  });
});
