import { randomInt } from "node:crypto";
import data from "../data/locations.json";
import type { Location, Point, Settings } from "../types/game";
export type GameLocation = Location & {
  mode: "demo" | "google";
  key: string;
  panoId?: string;
  heading?: number;
};
export type LocationSelectionOptions = {
  recentCountries?: readonly string[];
  settings: Settings;
  usedLocationKeys: ReadonlySet<string>;
  usedPositions: readonly Point[];
  recentKeys: ReadonlySet<string>;
  remainingRounds: number;
  signal?: AbortSignal;
};
export interface LocationProvider {
  getNextLocation(options: LocationSelectionOptions): Promise<GameLocation>;
}
export class PoolExhaustedError extends Error {
  constructor(
    public readonly kind: "history" | "pool",
    message: string,
  ) {
    super(message);
  }
}
export class ProviderUnavailableError extends Error {
  constructor() {
    super("Google Maps ใช้งานไม่ได้ในขณะนี้ กรุณาใช้ Demo Mode");
  }
}
export const demoLocations = data as Location[];
export function matchesFilters(
  location: Pick<Location, "category" | "country" | "difficulty">,
  settings: Settings,
) {
  return (
    location.difficulty === settings.difficulty &&
    (settings.category === "world" ||
      (settings.category === "thailand"
        ? location.country === "Thailand"
        : location.category === settings.category))
  );
}
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export class DemoLocationProvider implements LocationProvider {
  constructor(private locations: readonly Location[] = demoLocations) {}
  async getNextLocation(
    options: LocationSelectionOptions,
  ): Promise<GameLocation> {
    const pool = this.locations.filter(
      (location) =>
        matchesFilters(location, options.settings) &&
        !options.usedLocationKeys.has(`demo:${location.id}`),
    );
    if (pool.length < options.remainingRounds)
      throw new PoolExhaustedError(
        "pool",
        `ชุดเดโมตามตัวกรองเหลือ ${pool.length} สถานที่ แต่ต้องใช้อีก ${options.remainingRounds} รอบ กรุณาลดจำนวนรอบหรือเปลี่ยนตัวกรอง จะไม่มีการใช้ภาพซ้ำในเกมเดียวกัน`,
      );
    const fresh = pool.filter(
      (location) => !options.recentKeys.has(`demo:${location.id}`),
    );
    if (fresh.length < options.remainingRounds)
      throw new PoolExhaustedError(
        "history",
        `สถานที่ที่ไม่อยู่ในเกมล่าสุดเหลือ ${fresh.length} แห่ง ทั้งสองคนต้องยืนยันก่อนอนุญาตให้นำสถานที่จากเกมก่อนกลับมาใช้ หรือเปลี่ยนตัวกรอง`,
      );
    const diverse = fresh.filter(location => !options.recentCountries?.includes(location.country));
    const choices = diverse.length ? diverse : fresh;
    const location = choices[randomInt(choices.length)];
    return { ...location, mode: "demo", key: `demo:${location.id}` };
  }
}
export class FallbackLocationProvider implements LocationProvider {
  constructor(
    private google: LocationProvider,
    private demo: LocationProvider,
    readonly googleAvailable: boolean,
  ) {}
  async getNextLocation(options: LocationSelectionOptions) {
    if (options.settings.mode === "google" && this.googleAvailable) {
      try {
        return await this.google.getNextLocation(options);
      } catch (error) {
        if (error instanceof PoolExhaustedError || options.signal?.aborted)
          throw error;
      }
    }
    return this.demo.getNextLocation(options);
  }
}
