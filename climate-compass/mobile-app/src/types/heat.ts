import type { ProvenanceInfo } from "./provenance";

/** Loosely-typed heat snapshot blob (`external_integrations.heat_current_preferred`). */
export interface HeatBlob {
  effective_temp_c?: number;
  temp_c?: number;
  feelslike_c?: number;
  advisory_basis?: string;
  [key: string]: unknown;
}

export type HeatLevel = "LOW" | "MODERATE" | "HIGH" | "SEVERE";

/** `GET /api/heat/current` response (`main.py`). */
export interface HeatCurrentResponse {
  location_label: string | null;
  lat: number;
  lon: number;
  source: string;
  provenance: ProvenanceInfo;
  heat: HeatBlob;
  heat_temperature_display: number;
  heat_level: HeatLevel;
  thresholds_c: {
    moderate_at_or_above: number;
    high_at_or_above: number;
    severe_at_or_above?: number;
  };
}
