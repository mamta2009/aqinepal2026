export type AirQualityBand =
  | "good"
  | "moderate"
  | "sensitive"
  | "unhealthy"
  | "no-data";

export type HeatBand = "comfortable" | "warm" | "high" | "severe" | "no-data";

export type Audience = "everyone" | "school" | "parent" | "student";

export interface GuidanceInput {
  aqi?: number | null;
  pm25?: number | null;
  effectiveTemperatureC?: number | null;
}

export interface Recommendation {
  title: string;
  action: string;
}

export interface ClimateGuidance {
  airBand: AirQualityBand;
  heatBand: HeatBand;
  label: string;
  outdoorAnswer: string;
  summary: string;
  recommendations: Recommendation[];
  audienceAdvice: Record<Exclude<Audience, "everyone">, string>;
  operatorAlertNote: string;
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function airQualityBand({
  aqi,
  pm25,
}: Pick<GuidanceInput, "aqi" | "pm25">): AirQualityBand {
  if (finite(aqi)) {
    if (aqi <= 50) return "good";
    if (aqi <= 100) return "moderate";
    if (aqi <= 150) return "sensitive";
    return "unhealthy";
  }
  if (finite(pm25)) {
    if (pm25 <= 12) return "good";
    if (pm25 <= 35.4) return "moderate";
    if (pm25 <= 55.4) return "sensitive";
    return "unhealthy";
  }
  return "no-data";
}

export function heatBand(value?: number | null): HeatBand {
  if (!finite(value)) return "no-data";
  if (value < 27) return "comfortable";
  if (value < 32) return "warm";
  if (value < 40) return "high";
  return "severe";
}

const AIR_LABELS: Record<AirQualityBand, string> = {
  good: "Good",
  moderate: "Moderate",
  sensitive: "Unhealthy for sensitive groups",
  unhealthy: "Unhealthy",
  "no-data": "Air quality unavailable",
};

const AIR_OUTDOOR: Record<AirQualityBand, string> = {
  good: "Yes — outdoor activity is a good choice for most people.",
  moderate:
    "Usually yes — people who are unusually sensitive should reduce prolonged heavy exertion.",
  sensitive:
    "Use caution — children and people with asthma, heart, or lung conditions should shorten strenuous activity.",
  unhealthy:
    "Move strenuous activity indoors or postpone it; keep outdoor time light and brief.",
  "no-data":
    "We cannot answer reliably right now. Check local conditions before prolonged outdoor activity.",
};

export function getClimateGuidance(input: GuidanceInput): ClimateGuidance {
  const air = airQualityBand(input);
  const heat = heatBand(input.effectiveTemperatureC);
  const heatConcern = heat === "high" || heat === "severe";
  const warm = heat === "warm";
  const noAir = air === "no-data";

  let answer = AIR_OUTDOOR[air];
  if (heatConcern) {
    answer =
      air === "good" || air === "moderate"
        ? "Only with heat precautions — choose cooler hours, reduce intensity, and take frequent water breaks."
        : `${answer} Heat adds extra strain, so use a cool indoor space when possible.`;
  } else if (warm) {
    answer += " Choose cooler hours and bring water.";
  }

  const recommendations: Recommendation[] = [
    {
      title: "Outdoor plans",
      action: noAir
        ? "Keep plans flexible until a reliable reading returns."
        : air === "good"
          ? "Normal activity is appropriate; use usual sun and traffic safety."
          : air === "moderate"
            ? "Take breaks if symptoms appear, especially during hard exercise."
            : "Reduce duration and intensity; prefer indoor activity.",
    },
    {
      title: "Sensitive people",
      action:
        air === "good"
          ? "Follow normal care plans and keep rescue medicine available."
          : "Children, older adults, pregnant people, and those with heart or lung conditions should take extra care.",
    },
    {
      title: "Heat and hydration",
      action: heatConcern
        ? "Drink water often, use shade or cooling, and watch for dizziness, confusion, or nausea."
        : "Carry water and take regular breaks; heat conditions can change quickly.",
    },
    {
      title: "Indoor air",
      action:
        air === "sensitive" || air === "unhealthy"
          ? "Close smoky-air entry points and use a clean-air room or filtered space if available."
          : "Ventilate when outdoor air is clean; avoid smoke and strong indoor pollutants.",
    },
    {
      title: "Watch for symptoms",
      action:
        "Stop activity for breathing trouble, chest pain, faintness, or confusion and seek urgent medical help when severe.",
    },
  ];

  const combined =
    heatConcern && (air === "sensitive" || air === "unhealthy")
      ? "Air pollution and heat are both adding strain today."
      : heatConcern
        ? "Heat is the main reason for extra caution today."
        : noAir
          ? "Current air data are missing, so this advice is precautionary."
          : `Air quality is ${AIR_LABELS[air].toLowerCase()} today.`;

  return {
    airBand: air,
    heatBand: heat,
    label: AIR_LABELS[air],
    outdoorAnswer: answer,
    summary: combined,
    recommendations,
    audienceAdvice: {
      school:
        air === "good" && !heatConcern
          ? "Continue normal outdoor schedules and keep water accessible."
          : "Use shorter, lower-intensity outdoor sessions; offer an indoor option and check people who are sensitive.",
      parent:
        air === "good" && !heatConcern
          ? "Normal outdoor time is reasonable; keep usual medicines and water available."
          : "Plan shorter outdoor time, watch for cough or unusual tiredness, and follow any personal care plan.",
      student:
        air === "good" && !heatConcern
          ? "Outdoor activity is generally fine. Stay hydrated and seek care if symptoms appear."
          : "Reduce exertion, use breaks, and seek care for breathing difficulty, dizziness, or chest pain.",
    },
    operatorAlertNote:
      "This public health guidance uses AQI and heat risk bands. It does not indicate whether an operator-configured broadcast alert threshold has been crossed.",
  };
}
