import { createHmac } from "node:crypto";
import { z } from "zod";
import { googleSeeds } from "../data/google-seeds";
import { haversine } from "../lib/game";
import {
  matchesFilters,
  PoolExhaustedError,
  ProviderUnavailableError,
  shuffle,
  type GameLocation,
  type LocationProvider,
  type LocationSelectionOptions,
} from "./locations";
const metadataSchema = z.object({
  status: z.string(),
  pano_id: z.string().min(1).max(256).optional(),
  location: z
    .object({
      lat: z.number().min(-85).max(85),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  copyright: z.string().optional(),
});
type GoogleConfig = {
  serverKey?: string;
  signingSecret?: string;
  maxAttempts?: number;
  timeoutMs?: number;
  minDistanceKm?: number;
  fetcher?: typeof fetch;
  seeds?: typeof googleSeeds;
};
export function googleMetadataUrl(
  point: { lat: number; lng: number },
  key: string,
) {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/streetview/metadata",
  );
  url.search = new URLSearchParams({
    location: `${point.lat},${point.lng}`,
    radius: "500",
    source: "outdoor",
    key,
  }).toString();
  return url;
}
export function googleStaticUrl(
  location: GameLocation,
  key: string,
  signingSecret?: string,
) {
  if (location.mode !== "google" || !location.panoId)
    throw new ProviderUnavailableError();
  const url = new URL("https://maps.googleapis.com/maps/api/streetview");
  url.search = new URLSearchParams({
    pano: location.panoId,
    size: "640x480",
    heading: String(location.heading ?? 0),
    fov: "90",
    pitch: "0",
    return_error_code: "true",
    key,
  }).toString();
  if (signingSecret)
    url.searchParams.set(
      "signature",
      createHmac("sha1", Buffer.from(signingSecret, "base64url"))
        .update(url.pathname + url.search)
        .digest("base64url"),
    );
  return url;
}
export class GoogleLocationProvider implements LocationProvider {
  private fetcher: typeof fetch;
  constructor(private config: GoogleConfig) {
    this.fetcher = config.fetcher ?? fetch;
  }
  async getNextLocation(
    options: LocationSelectionOptions,
  ): Promise<GameLocation> {
    const key = this.config.serverKey;
    if (!key) throw new ProviderUnavailableError();
    const minimum = this.config.minDistanceKm ?? 1;
    const seeds = shuffle(
      (this.config.seeds ?? googleSeeds).filter(
        (seed) =>
          matchesFilters(seed, options.settings) &&
          !options.usedPositions.some(
            (point) => haversine(seed, point) < minimum,
          ),
      ),
    );
    if (seeds.length < options.remainingRounds)
      throw new PoolExhaustedError(
        "pool",
        "จุดสุ่ม Google ตามตัวกรองไม่พอสำหรับรอบที่เหลือ กรุณาลดรอบหรือเปลี่ยนตัวกรอง",
      );
    let historySkipped = false,
      duplicateSkipped = false;
    for (const seed of seeds.slice(0, this.config.maxAttempts ?? 8)) {
      let metadata: z.infer<typeof metadataSchema>;
      try {
        const response = await this.fetcher(googleMetadataUrl(seed, key), {
          signal: AbortSignal.any([
            AbortSignal.timeout(this.config.timeoutMs ?? 2500),
            ...(options.signal ? [options.signal] : []),
          ]),
          redirect: "error",
        });
        if (!response.ok) throw new ProviderUnavailableError();
        metadata = metadataSchema.parse(await response.json());
      } catch {
        throw new ProviderUnavailableError();
      }
      if (["ZERO_RESULTS", "NOT_FOUND"].includes(metadata.status)) continue;
      if (metadata.status !== "OK" || !metadata.location || !metadata.pano_id)
        throw new ProviderUnavailableError();
      const locationKey = `google:${metadata.pano_id}`;
      if (
        options.usedLocationKeys.has(locationKey) ||
        options.usedPositions.some(
          (point) => haversine(point, metadata.location!) < minimum,
        )
      ) {
        duplicateSkipped = true;
        continue;
      }
      if (options.recentKeys.has(locationKey)) {
        historySkipped = true;
        continue;
      }
      if (haversine(seed, metadata.location) > 0.6) continue;
      return {
        id: seed.id,
        key: locationKey,
        mode: "google",
        panoId: metadata.pano_id,
        heading: seed.heading,
        ...metadata.location,
        name: seed.name,
        country: seed.country,
        category: seed.category,
        difficulty: seed.difficulty,
        image: "",
        description: "พิกัด panorama ที่ตรวจสอบโดย Street View Metadata",
        source: "https://www.google.com/intl/th_US/help/terms_maps/",
        credit: "Google Maps",
      };
    }
    if (historySkipped)
      throw new PoolExhaustedError(
        "history",
        "panorama ที่ตรวจสอบอยู่ในเกมล่าสุด ต้องให้ทั้งสองคนยืนยันก่อนอนุญาตใช้ประวัติเก่า หรือเปลี่ยนตัวกรอง",
      );
    if (duplicateSkipped)
      throw new PoolExhaustedError(
        "pool",
        "ไม่พบ panorama ใหม่ที่ห่างจากจุดเดิมพอภายในจำนวนครั้งที่กำหนด ลองใหม่หรือเปลี่ยนตัวกรอง โดยจะไม่ใช้ panorama เดิมซ้ำ",
      );
    throw new ProviderUnavailableError();
  }
  async loadImage(
    location: GameLocation,
    signal?: AbortSignal,
  ): Promise<{ bytes: Buffer; contentType: string }> {
    if (!this.config.serverKey) throw new ProviderUnavailableError();
    try {
      const response = await this.fetcher(
        googleStaticUrl(
          location,
          this.config.serverKey,
          this.config.signingSecret,
        ),
        {
          signal: AbortSignal.any([
            AbortSignal.timeout(8000),
            ...(signal ? [signal] : []),
          ]),
          redirect: "error",
        },
      );
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/")
      )
        throw new ProviderUnavailableError();
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 5_000_000 || bytes.length < 10)
        throw new ProviderUnavailableError();
      // Preserve the complete Google image and attribution; no disk cache or transforms.
      return { bytes, contentType: response.headers.get("content-type")! };
    } catch {
      throw new ProviderUnavailableError();
    }
  }
}
