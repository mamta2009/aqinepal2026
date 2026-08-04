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
import { compareBarColor } from "@/lib/compare-cities";

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

export type ComparePm25ChartProps = {
  labels: string[];
  values: Array<number | null>;
  threshold: number;
  currentCity?: string;
};

export default function ComparePm25Chart({
  labels,
  values,
  threshold,
  currentCity,
}: ComparePm25ChartProps) {
  const colors = labels.map((label, index) =>
    compareBarColor(values[index], threshold, label === currentCity),
  );

  return (
    <div
      className="relative h-64 w-full"
      aria-label="PM2.5 comparison across selected cities"
    >
      <Chart
        type="bar"
        data={{
          labels,
          datasets: [
            {
              type: "bar",
              label: "PM2.5 (µg/m³)",
              data: values.map((value) => value ?? 0),
              backgroundColor: colors,
              borderRadius: 8,
              maxBarThickness: 48,
            },
            {
              type: "line",
              label: `Threshold (${threshold})`,
              data: labels.map(() => threshold),
              borderColor: "#176b8c",
              borderDash: [6, 5],
              borderWidth: 2,
              pointRadius: 0,
              tension: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: "PM2.5 µg/m³" },
            },
          },
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label(context) {
                  if (context.dataset.type === "line") {
                    return `Threshold ${threshold} µg/m³`;
                  }
                  const raw = values[context.dataIndex];
                  return raw == null ? "No PM2.5" : `PM2.5 ${raw} µg/m³`;
                },
              },
            },
          },
        }}
      />
    </div>
  );
}
