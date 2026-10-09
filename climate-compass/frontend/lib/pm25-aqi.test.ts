import { describe, expect, it } from "vitest";
import {
  briefAirMeasurement,
  explainAirMeasurement,
  formatPm25UgM3,
  pm25ToUsAqi,
} from "./pm25-aqi";

describe("pm25ToUsAqi", () => {
  it("maps good-range PM2.5 near the top of Good", () => {
    const result = pm25ToUsAqi(11.9);
    expect(result).not.toBeNull();
    expect(result!.category).toBe("Good");
    expect(result!.aqi).toBeGreaterThanOrEqual(45);
    expect(result!.aqi).toBeLessThanOrEqual(50);
  });

  it("maps moderate PM2.5", () => {
    const result = pm25ToUsAqi(20);
    expect(result?.category).toBe("Moderate");
    expect(result!.aqi).toBeGreaterThanOrEqual(51);
    expect(result!.aqi).toBeLessThanOrEqual(100);
  });
});

describe("air measurement copy", () => {
  it("keeps the dashboard line brief", () => {
    expect(briefAirMeasurement({ pm25: 11.9 })).toMatch(
      /^PM2\.5 11\.9 µg\/m³ · ~AQI \d+$/,
    );
  });

  it("puts the long explanation in help copy", () => {
    const text = explainAirMeasurement({ pm25: 11.9 });
    expect(text).toContain("PM2.5 is 11.9 µg/m³");
    expect(text).toContain("tiny dust-like particles");
    expect(text).toContain("AQI");
    expect(text).toContain("Good");
  });

  it("prefers reported AQI over converting PM2.5", () => {
    expect(briefAirMeasurement({ pm25: 42.3, aqiScore: 63 })).toBe(
      "Air score (AQI) 63",
    );
  });

  it("falls back to reported AQI when PM2.5 is missing", () => {
    expect(briefAirMeasurement({ aqiScore: 42 })).toBe("Air score (AQI) 42");
    expect(explainAirMeasurement({ aqiScore: 42 })).toContain(
      "air score shown is 42",
    );
  });

  it("formats PM2.5 values", () => {
    expect(formatPm25UgM3(12)).toBe("12");
    expect(formatPm25UgM3(11.9)).toBe("11.9");
  });
});
