"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

export interface TrendChartProps {
  labels: string[];
  cases: number[];
  forecast?: Array<number | null>;
}

export default function DashboardTrendChart({
  labels,
  cases,
  forecast = [],
}: TrendChartProps) {
  const forecastLabels = forecast.map((_, index) => `+${index + 1}d`);
  const historyPadding = Array(Math.max(0, cases.length - 1)).fill(null);
  const forecastLine =
    forecast.length > 0
      ? [...historyPadding, cases.at(-1) ?? null, ...forecast]
      : [];

  return (
    <div className="relative h-72 w-full" aria-label="Respiratory case trend chart">
      <Line
        data={{
          labels: [...labels, ...forecastLabels],
          datasets: [
            {
              label: "Synthetic respiratory cases",
              data: [...cases, ...forecast.map(() => null)],
              borderColor: "#1f794b",
              backgroundColor: "rgba(84,178,96,.16)",
              pointBackgroundColor: "#155936",
              fill: true,
              tension: 0.28,
            },
            {
              label: "Illustrative forecast",
              data: forecastLine,
              borderColor: "#176b8c",
              borderDash: [6, 5],
              pointBackgroundColor: "#176b8c",
              tension: 0.28,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: "index" },
          scales: {
            y: { beginAtZero: true, title: { display: true, text: "Cases" } },
          },
          plugins: {
            legend: { position: "bottom" },
          },
        }}
      />
    </div>
  );
}
