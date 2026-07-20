import { apiClient } from "./client";

import type { AirQualityResponse } from "@/types/airQuality";
import type { LatestAlertResponse } from "@/types/alerts";
import type { CasesWeekResponse } from "@/types/cases";
import type { HeatCurrentResponse } from "@/types/heat";
import type { CityName } from "@/constants/cities";

export async function getAirQualityCurrent(
  city: CityName,
): Promise<AirQualityResponse> {
  const { data } = await apiClient.get<AirQualityResponse>(
    "/api/air-quality/current",
    {
      params: { city },
    },
  );
  return data;
}

export async function getHeatCurrent(
  city: CityName,
): Promise<HeatCurrentResponse> {
  const { data } = await apiClient.get<HeatCurrentResponse>(
    "/api/heat/current",
    {
      params: { city },
    },
  );
  return data;
}

export async function getCasesWeek(city: CityName): Promise<CasesWeekResponse> {
  const { data } = await apiClient.get<CasesWeekResponse>(
    `/api/cases/week/${city}`,
  );
  return data;
}

export async function getLatestAlert(
  city?: CityName,
): Promise<LatestAlertResponse> {
  const { data } = await apiClient.get<LatestAlertResponse>(
    "/api/alerts/latest",
    {
      params: city ? { city } : undefined,
    },
  );
  return data;
}
