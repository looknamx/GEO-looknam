import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  haversine,
  nameSchema,
  pointSchema,
  roomCodeSchema,
  scoreDistance,
  settingsSchema,
} from "../lib/game";
import { DemoLocationProvider, demoLocations } from "../services/locations";
describe("Haversine distance in kilometres", () => {
  it("returns zero for identical positions", () =>
    expect(
      haversine({ lat: 13.7, lng: 100.5 }, { lat: 13.7, lng: 100.5 }),
    ).toBe(0));
  it("measures London to Paris within 2 km of 344 km", () =>
    expect(
      haversine({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 }),
    ).toBeCloseTo(343.557, 0));
  it("crosses the antimeridian by the shorter route", () =>
    expect(haversine({ lat: 0, lng: 179 }, { lat: 0, lng: -179 })).toBeCloseTo(
      222.39,
      1,
    ));
  it("handles opposite points without floating-point NaN", () =>
    expect(haversine({ lat: 90, lng: 0 }, { lat: -90, lng: 180 })).toBeCloseTo(
      20015.114,
      1,
    ));
});
describe("scoring", () => {
  it("awards exactly 5,000 for a perfect guess", () =>
    expect(scoreDistance(0)).toBe(5000));
  it("decreases with distance and stays in range", () => {
    let last = 5000;
    for (let km = 0; km <= 21000; km += 100) {
      const score = scoreDistance(km);
      expect(score).toBeLessThanOrEqual(last);
      expect(score).toBeGreaterThanOrEqual(0);
      last = score;
    }
  });
  it("rounds far-away guesses to zero and rejects invalid distances", () => {
    for (const km of [21000, -1, NaN, Infinity])
      expect(scoreDistance(km)).toBe(0);
  });
});
describe("validation", () => {
  it("normalizes valid room codes", () =>
    expect(roomCodeSchema.parse(" abcd-2345 ")).toBe("ABCD-2345"));
  it.each(["ABCD2345", "ABCD-1234", "IOOO-2345", "<script>", "", "ABCDE-2345"])(
    "rejects malformed room code %s",
    (code) => expect(roomCodeSchema.safeParse(code).success).toBe(false),
  );
  it("allows Thai names and trims whitespace", () =>
    expect(nameSchema.parse(" นักสำรวจ ก. ")).toBe("นักสำรวจ ก."));
  it.each(["   ", "<script>", "a".repeat(21)])(
    "rejects invalid name %s",
    (name) => expect(nameSchema.safeParse(name).success).toBe(false),
  );
  it("rejects out of range coordinates and settings", () => {
    expect(pointSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(false);
    expect(pointSchema.safeParse({ lat: 0, lng: Infinity }).success).toBe(
      false,
    );
    expect(
      settingsSchema.safeParse({ ...DEFAULT_SETTINGS, rounds: 999 }).success,
    ).toBe(false);
  });
});
describe("demo provider", () => {
  it("ships at least 20 credited locations", () => {
    expect(demoLocations.length).toBeGreaterThanOrEqual(20);
    for (const location of demoLocations) {
      expect(location.credit).toBeTruthy();
      expect(location.source).toMatch(/^https:\/\/commons.wikimedia.org/);
    }
  });
  it("strictly filters and never repeats; exhaustion needs an explicit change", async () => {
    const provider = new DemoLocationProvider();
    const used = new Set<string>();
    const options = {
      settings: {
        ...DEFAULT_SETTINGS,
        category: "thailand" as const,
        rounds: 3 as const,
      },
      usedLocationKeys: used,
      usedPositions: [],
      recentKeys: new Set<string>(),
      remainingRounds: 1,
    };
    const count = demoLocations.filter(
      (l) => l.country === "Thailand" && l.difficulty === "normal",
    ).length;
    for (let i = 0; i < count; i++) {
      const location = await provider.getNextLocation(options);
      expect(location.country).toBe("Thailand");
      expect(location.difficulty).toBe("normal");
      expect(used.has(location.key)).toBe(false);
      used.add(location.key);
    }
    await expect(provider.getNextLocation(options)).rejects.toMatchObject({
      kind: "pool",
    });
  });
});
