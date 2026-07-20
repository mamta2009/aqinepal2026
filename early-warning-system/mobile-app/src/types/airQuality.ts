import type { ProvenanceInfo } from "./provenance";

/** Mirrors the `air_quality` payload built by `external_integrations.py` resolvers. */
export interface AirQualityPayload {
  aqi: number | null;
  aqi_scale: string | null;
  pm25_ug_m3: number | null;
  pm10_ug_m3?: number | null;
  dominant_pollutant?: string | null;
  station_name: string | null;
  observed_at: string | null;
  us_epa_index?: number | null;
  co_micro_g_m3?: number | null;
  no2_micro_g_m3?: number | null;
}

/** `GET /api/air-quality/current` response (`main.py`). */
export interface AirQualityResponse {
  location_label: string | null;
  lat: number;
  lon: number;
  source: string;
  provenance: ProvenanceInfo;
  air_quality: AirQualityPayload;
}
