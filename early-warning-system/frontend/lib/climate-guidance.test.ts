import { describe, expect, it } from "vitest";
import {
  airQualityBand,
  getClimateGuidance,
  heatBand,
} from "./climate-guidance";

describe("climate guidance", () => {
  it.each([
    [25, "good"],
    [75, "moderate"],
    [125, "sensitive"],
    [175, "unhealthy"],
  ] as const)("classifies AQI %s as %s", (aqi, expected) => {
    expect(airQualityBand({ aqi })).toBe(expected);
  });

  it("uses PM2.5 when AQI is absent and handles no data", () => {
    expect(airQualityBand({ pm25: 36 })).toBe("sensitive");
    expect(airQualityBand({})).toBe("no-data");
  });

  it("maps WeatherAPI US EPA 1-6 index only when AQI and PM2.5 are missing", () => {
    expect(airQualityBand({ usEpaIndex: 1 })).toBe("good");
    expect(airQualityBand({ usEpaIndex: 2 })).toBe("moderate");
    expect(airQualityBand({ usEpaIndex: 3 })).toBe("sensitive");
    expect(airQualityBand({ usEpaIndex: 4 })).toBe("unhealthy");
    // Continuous AQI still wins over EPA bucket.
    expect(airQualityBand({ aqi: 160, usEpaIndex: 1 })).toBe("unhealthy");
  });

  it("classifies heat independently from operator thresholds", () => {
    expect(heatBand(26)).toBe("comfortable");
    expect(heatBand(34)).toBe("high");
    expect(heatBand(null)).toBe("no-data");
  });

  it("strengthens advice when unhealthy air and high heat combine", () => {
    const guidance = getClimateGuidance({
      aqi: 170,
      effectiveTemperatureC: 36,
    });
    expect(guidance.outdoorAnswer).toContain("Heat adds extra strain");
    expect(guidance.summary).toContain("both adding strain");
    expect(guidance.operatorAlertNote).toContain("does not indicate");
  });

  it("is explicit when air data are unavailable", () => {
    const guidance = getClimateGuidance({ effectiveTemperatureC: 28 });
    expect(guidance.label).toBe("Air quality unavailable");
    expect(guidance.outdoorAnswer).toContain("cannot answer reliably");
  });
});
