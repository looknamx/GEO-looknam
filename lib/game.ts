import { z } from "zod";
export const nameSchema = z
  .string()
  .trim()
  .min(1, "กรุณากรอกชื่อผู้เล่น")
  .max(20, "ชื่อยาวได้ไม่เกิน 20 ตัวอักษร")
  .regex(/^[\p{L}\p{M}\p{N} _.-]+$/u, "ใช้ตัวอักษร ตัวเลข เว้นวรรค หรือ _ . -");
export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z]{4}-[2-9]{4}$/, "รหัสห้องต้องอยู่ในรูปแบบ ABCD-2345");
export const settingsSchema = z.object({
  capacity: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
  format: z.enum(["solo", "teams"]).default("solo"),
  victory: z.enum(["points", "hp"]).default("points"),
  movement: z.enum(["walk", "no-move", "fixed"]).default("walk"),
  mode: z.enum(["demo", "google"]).default("demo"),
  rounds: z.union([z.literal(3), z.literal(5), z.literal(10)]),
  seconds: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  difficulty: z.enum(["easy", "normal", "hard"]),
  category: z.enum(["world", "thailand", "city", "nature", "landmark"]),
});
export const pointSchema = z.object({
  lat: z.number().finite().min(-85).max(85),
  lng: z.number().finite().min(-180).max(180),
});
export const DEFAULT_SETTINGS: z.infer<typeof settingsSchema> = {
  capacity: 4, format: "solo", victory: "points", movement: "walk",
  mode: "demo",
  rounds: 5,
  seconds: 60,
  difficulty: "normal",
  category: "world",
};
export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (n: number) => (n * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function scoreDistance(km: number): number {
  if (!Number.isFinite(km) || km < 0) return 0;
  return Math.max(0, Math.min(5000, Math.round(5000 * Math.exp(-km / 2000))));
}
