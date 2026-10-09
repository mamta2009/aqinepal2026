"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { AirReadingMetric } from "@/lib/chart-series";

ChartJS.register(
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

export default function AirQuality24hChart({
  labels,
  values,
  metric = "pm25",
}: {
  labels: string[];
  values: number[];
  metric?: AirReadingMetric;
}) {
  const datasetLabel = metric === "aqi" ? "Air score (AQI)" : "PM2.5 (µg/m³)";
  const yTitle = metric === "aqi" ? "AQI" : "µg/m³";

  return (
    <div className="relative h-72 w-full" aria-label="Air quality 24 hour chart">
      <Line
        data={{
          labels,
          datasets: [
            {
              label: datasetLabel,
              data: values,
              borderColor: "#1f794b",
              backgroundColor: "rgba(84,178,96,.18)",
              pointBackgroundColor: "#155936",
              pointRadius: 0,
              pointHoverRadius: 4,
              fill: true,
              tension: 0.35,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: "index" },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: yTitle },
            },
            x: {
              ticks: {
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 8,
              },
            },
          },
          plugins: {
            legend: { display: false },
          },
        }}
      />
    </div>
  );
}
