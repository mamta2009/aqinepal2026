export type ApiErrorPayload = {
  detail?: string | { msg?: string }[];
  message?: string;
};

export type City = {
  name: string;
  lat?: number;
  lon?: number;
  elevation?: number;
  province?: string;
  population?: number;
  hospitals?: number;
  status?: string;
};

export type CitiesResponse = {
  mode: string;
  cities: City[] | Record<string, City>;
  facility_presets_by_city?: Record<string, string[]>;
  total_population?: number;
  total_hospitals?: number;
};

export type AirQualityResponse = {
  location_label: string;
  lat: number;
  lon: number;
  source: string;
  provenance?: Record<string, unknown>;
  air_quality: {
    pm25_ug_m3?: number | null;
    pm25?: number | null;
    aqi?: number | null;
    us_epa_index?: number | null;
    [key: string]: unknown;
  };
};

export type HeatResponse = {
  location_label: string;
  source: string;
  heat_level?: string;
  heat_temperature_display?: number | string | null;
  heat?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
};

export type AlertDeliveryChannelResult = {
  sent?: number;
  failed?: number;
};

export type AlertLatest = {
  ok?: boolean;
  source?: "alert_broadcasts" | "none" | "empty" | string;
  message?: string;
  city?: string;
  level?: string;
  severity_level?: string;
  aqi_level?: string;
  hazard_type?: string;
  heat_headline_display?: string;
  timestamp?: string;
  total_recipients?: number;
  delivery_results?: Record<string, AlertDeliveryChannelResult>;
};

export type GuideResource = {
  path: string;
  slug: string;
  title: string;
  summary?: string;
  audience?: string;
};

export type GuideResourceDocument = GuideResource & {
  html: string;
  markdown?: string;
};

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
