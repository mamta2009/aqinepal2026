"use client";

import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import {
  compareBarColor,
  compareBarColorFromAqi,
} from "@/lib/compare-cities";

// Chart.js tree-shaking requires controllers as well as elements.
ChartJS.register(
  BarController,
  LineController,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
);

export type CompareChartKind = "pm25" | "aqi" | "mixed";

export type ComparePm25ChartProps = {
  labels: string[];
  values: Array<number | null>;
  kinds: Array<"pm25" | "aqi" | "none">;
  threshold: number;
  currentCity?: string;
};

export default function ComparePm25Chart({
  labels,
  values,
  kinds,
  threshold,
  currentCity,
}: ComparePm25ChartProps) {
  const aqiOnly =
    kinds.length > 0 && kinds.every((kind) => kind === "aqi" || kind === "none");
  const colors = labels.map((label, index) => {
    const kind = kinds[index];
    const value = values[index];
    if (kind === "aqi") {
      return compareBarColorFromAqi(value, label === currentCity);
    }
    return compareBarColor(value, threshold, label === currentCity);
  });

  const yTitle = aqiOnly ? "Air score (AQI)" : "PM2.5 µg/m³ or AQI";
  const barLabel = aqiOnly ? "Station AQI" : "Live air reading";
  const showPm25Threshold = kinds.some((kind) => kind === "pm25");

  return (
    <div
      className="relative h-64 w-full"
      aria-label="Air quality comparison across selected cities"
    >
      <Chart
        type="bar"
        data={{
          labels,
          datasets: [
            {
              type: "bar",
              label: barLabel,
              data: values.map((value) => value ?? 0),
              backgroundColor: colors,
              borderRadius: 8,
              maxBarThickness: 48,
            },
            ...(showPm25Threshold
              ? [
                {
                  type: "line" as const,
                  label: `PM2.5 threshold (${threshold})`,
                  data: labels.map(() => threshold),
                  borderColor: "#176b8c",
                  borderDash: [6, 5],
                  borderWidth: 2,
                  pointRadius: 0,
                  tension: 0,
                },
              ]
              : []),
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: yTitle },
            },
          },
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label(context) {
                  if (context.dataset.type === "line") {
                    return `PM2.5 threshold ${threshold} µg/m³`;
                  }
                  const raw = values[context.dataIndex];
                  const kind = kinds[context.dataIndex];
                  if (raw == null || kind === "none") return "No reading";
                  if (kind === "aqi") return `AQI ${raw}`;
                  return `PM2.5 ${raw} µg/m³`;
                },
              },
            },
          },
        }}
      />
    </div>
  );
}
