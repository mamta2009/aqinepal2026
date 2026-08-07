/** `GET /api/environment/overview` response types. */

export type EnvironmentOverviewItem = {
  city: string;
  lat: number;
  lon: number;
  province?: string;
  status: string;
  air_quality: {
    status: string;
    pm25_ug_m3?: number | null;
    aqi?: number | null;
    source?: string;
    observed_at?: string;
    provenance?: Record<string, unknown>;
    error?: string | null;
  };
  heat: {
    status: string;
    temp_c?: number | null;
    effective_temp_c?: number | null;
    level?: string;
    source?: string;
    observed_at?: string;
    provenance?: Record<string, unknown>;
    error?: string | null;
  };
};

export type EnvironmentOverviewResponse = {
  status: string;
  generated_at: string;
  count: number;
  cities: EnvironmentOverviewItem[];
};
