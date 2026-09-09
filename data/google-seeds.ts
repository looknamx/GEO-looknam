import type { Location } from "../types/game";
// Authored candidates. Resolve a current outdoor panorama before using a seed.
type Seed = Pick<
  Location,
  "id" | "name" | "country" | "category" | "difficulty" | "lat" | "lng"
> & { heading: number };
const cities: [string, string, number, number][] = [
  ["Bangkok", "Thailand", 13.7563, 100.5018],
  ["Chiang Mai", "Thailand", 18.7883, 98.9853],
  ["Phuket", "Thailand", 7.884, 98.389],
  ["Ayutthaya", "Thailand", 14.352, 100.567],
  ["Tokyo", "Japan", 35.659, 139.7],
  ["Osaka", "Japan", 34.668, 135.501],
  ["Paris", "France", 48.858, 2.295],
  ["London", "United Kingdom", 51.5007, -0.1246],
  ["New York", "United States", 40.758, -73.9855],
  ["San Francisco", "United States", 37.808, -122.417],
  ["Sydney", "Australia", -33.86, 151.21],
  ["Melbourne", "Australia", -37.817, 144.967],
  ["Rome", "Italy", 41.89, 12.492],
  ["Barcelona", "Spain", 41.403, 2.174],
  ["Lisbon", "Portugal", 38.708, -9.137],
  ["Amsterdam", "Netherlands", 52.373, 4.892],
  ["Singapore", "Singapore", 1.286, 103.854],
  ["Seoul", "South Korea", 37.571, 126.977],
  ["Toronto", "Canada", 43.642, -79.388],
  ["Auckland", "New Zealand", -36.848, 174.763],
  ["Cape Town", "South Africa", -33.925, 18.424],
  ["Stockholm", "Sweden", 59.329, 18.068],
  ["Prague", "Czechia", 50.087, 14.42],
  ["Vienna", "Austria", 48.208, 16.373],
];
const nature: [string, string, number, number][] = [
  ["Karon Beach", "Thailand", 7.846, 98.293],
  ["Ao Nang", "Thailand", 8.033, 98.823],
  ["Doi Suthep", "Thailand", 18.803, 98.919],
  ["Khao Yai", "Thailand", 14.438, 101.372],
  ["Lake Kawaguchi", "Japan", 35.522, 138.761],
  ["Lake Tekapo", "New Zealand", -44.004, 170.483],
  ["Lake Louise", "Canada", 51.416, -116.214],
  ["Grand Canyon", "United States", 36.058, -112.109],
  ["Bondi Beach", "Australia", -33.891, 151.277],
  ["Table Mountain", "South Africa", -33.946, 18.403],
  ["Lake Bled", "Slovenia", 46.363, 14.095],
  ["Lofoten", "Norway", 67.934, 13.089],
];
export const googleSeeds: Seed[] = [
  ...cities.flatMap(([name, country, lat, lng], index) =>
    (["easy", "normal", "hard"] as const).map((difficulty, level) => ({
      id: `city-${index}-${level}`,
      name,
      country,
      lat: lat + level * 0.002,
      lng: lng + level * 0.002,
      difficulty,
      category: (index % 2 === 0 ? "landmark" : "city") as Seed["category"],
      heading: (index * 37) % 360,
    })),
  ),
  ...nature.flatMap(([name, country, lat, lng], index) =>
    (["easy", "normal", "hard"] as const).map((difficulty, level) => ({
      id: `nature-${index}-${level}`,
      name,
      country,
      lat: lat + level * 0.002,
      lng,
      difficulty,
      category: "nature" as const,
      heading: (index * 53) % 360,
    })),
  ),
];
