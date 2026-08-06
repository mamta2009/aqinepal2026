import { CloudSun, Droplets, Wind } from "lucide-react";
import { Card, CardKicker } from "@/components/ui/card";

function readNumber(
  object: Record<string, unknown> | undefined,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const value = object?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function nested(
  value: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined {
  const child = value?.[key];
  return child && typeof child === "object"
    ? (child as Record<string, unknown>)
    : undefined;
}

export function WeatherContext({
  weather,
  source,
}: {
  weather?: Record<string, unknown>;
  source?: string;
}) {
  const current = nested(weather, "current") ?? weather;
  const temperature = readNumber(current, "temp_c", "temperature_c", "temperature");
  const feels = readNumber(current, "feelslike_c", "feels_like_c", "apparent_temperature");
  const humidity = readNumber(current, "humidity", "humidity_percent");
  const wind = readNumber(current, "wind_kph", "wind_speed_kph", "wind_speed");

  return (
    <Card>
      <CardKicker>Weather context</CardKicker>
      <h2 className="text-xl font-bold">Conditions around the reading</h2>
      {temperature === null && humidity === null && wind === null ? (
        <p className="mt-3 text-sm text-muted">
          Current weather details are unavailable. Air guidance remains based on
          the available air and heat readings.
        </p>
      ) : (
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-sky-soft p-3">
            <dt className="flex items-center gap-2 text-sm font-bold"><CloudSun size={18} /> Temperature</dt>
            <dd className="mt-1 text-xl font-extrabold">{temperature ?? "—"}°C</dd>
            {feels !== null && <dd className="text-xs text-muted">Feels like {feels}°C</dd>}
          </div>
          <div className="rounded-xl bg-sky-soft p-3">
            <dt className="flex items-center gap-2 text-sm font-bold"><Droplets size={18} /> Humidity</dt>
            <dd className="mt-1 text-xl font-extrabold">{humidity ?? "—"}%</dd>
          </div>
          <div className="col-span-2 rounded-xl bg-sky-soft p-3">
            <dt className="flex items-center gap-2 text-sm font-bold"><Wind size={18} /> Wind</dt>
            <dd className="mt-1 text-xl font-extrabold">{wind ?? "—"} km/h</dd>
          </div>
        </dl>
      )}
      <p className="mt-4 text-xs text-muted">Source: {source || "No live weather source reported"}</p>
    </Card>
  );
}
