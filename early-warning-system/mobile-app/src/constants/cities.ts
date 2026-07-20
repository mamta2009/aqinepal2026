/**
 * Mirrors `early-warning-system/backend/cities_config.py` (CITIES_CONFIG).
 * Kept in sync manually — this is a small, rarely-changing demo city list;
 * `GET /api/cities` remains the source of truth for population/hospitals.
 */
export const CITY_NAMES = [
  "Kathmandu",
  "Lalitpur",
  "Bhaktapur",
  "Banepa",
  "Dhulikhel",
  "Hetauda",
  "Bharatpur",
  "Narayanghad",
] as const;

export type CityName = (typeof CITY_NAMES)[number];

export const DEFAULT_CITY: CityName = "Kathmandu";

export function isCityName(
  value: string | null | undefined,
): value is CityName {
  return !!value && (CITY_NAMES as readonly string[]).includes(value);
}
