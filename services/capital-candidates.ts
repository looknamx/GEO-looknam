import { capitals } from "../data/capitals";
import type { Settings, Point } from "../types/game";
import { shuffle } from "./locations";

// Uniform spherical-cap area sampling; also works across the date line.
export function randomPointAround(center: Point, radiusKm: number, random = Math.random): Point {
  const rad = Math.PI / 180;
  const distance = Math.acos(1 - random() * (1 - Math.cos(radiusKm / 6371.0088)));
  const bearing = random() * 2 * Math.PI;
  const latitude = center.lat * rad;
  const lat = Math.asin(Math.sin(latitude) * Math.cos(distance) +
    Math.cos(latitude) * Math.sin(distance) * Math.cos(bearing));
  const lng = center.lng * rad + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(latitude),
    Math.cos(distance) - Math.sin(latitude) * Math.sin(lat));
  return { lat: lat / rad, lng: ((lng / rad + 540) % 360) - 180 };
}

export function capitalCandidates(settings: Settings, count: number) {
  const pool = shuffle(capitals.filter((capital) => settings.category !== "thailand" || capital[1] === "Thailand"));
  const radiusKm = { easy: 5, normal: 12, hard: 25 }[settings.difficulty];
  return Array.from({ length: count }, (_, index) => {
    const [name, country, lat, lng] = pool[index % pool.length];
    const center = { lat, lng };
    return {
      id: `capital-${name}-${index}`, name, country, category: "city" as const,
      difficulty: settings.difficulty, ...randomPointAround(center, radiusKm),
      heading: Math.floor(Math.random() * 360), center, radiusKm,
    };
  });
}
