import { browserApi } from "./browser";
import type {
  AirQualityResponse,
  AlertLatest,
  CitiesResponse,
  EnvironmentOverviewResponse,
  GuideResource,
  GuideResourceDocument,
  HeatResponse,
} from "./types";

export const api = {
  alerts: {
    latest: (city?: string) => {
      const trimmed = city?.trim();
      const path = trimmed
        ? `api/alerts/latest?city=${encodeURIComponent(trimmed)}`
        : "api/alerts/latest";
      return browserApi<AlertLatest>(path);
    },
  },
  cities: {
    list: () => browserApi<CitiesResponse>("api/cities"),
  },
  environment: {
    air: (city: string) =>
      browserApi<AirQualityResponse>(
        `api/air-quality/current?city=${encodeURIComponent(city)}`,
      ),
    heat: (city: string) =>
      browserApi<HeatResponse>(
        `api/heat/current?city=${encodeURIComponent(city)}`,
      ),
    overview: () =>
      browserApi<EnvironmentOverviewResponse>("api/environment/overview"),
  },
  guides: {
    list: async () => {
      const result = await browserApi<{
        guides?: GuideResource[];
        resources?: GuideResource[];
      }>("api/guides");
      return { resources: result.resources || result.guides || [] };
    },
    get: (path: string) =>
      browserApi<GuideResourceDocument>(
        `api/guides/${path.split("/").map(encodeURIComponent).join("/")}`,
      ),
  },
};
