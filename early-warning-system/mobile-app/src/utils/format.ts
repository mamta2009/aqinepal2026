export function formatNumber(
  value: number | null | undefined,
  fallback = "—",
): string {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return String(Math.round(value));
}

export function formatRelativeTimestamp(
  iso: string | null | undefined,
): string {
  if (!iso) return "Unknown time";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Unknown time";

  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}
