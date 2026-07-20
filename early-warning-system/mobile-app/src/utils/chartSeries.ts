/**
 * Ported verbatim from `generate24hFromReading()` / `seedUnit01()` in
 * `frontend/index.html` — deterministic intra-day variation around the
 * latest PM2.5 reading (NOT real hourly observations; the backend only
 * exposes a current snapshot, same caveat as the web dashboard's chart note).
 */
function seedUnit01(seedStr: string, idx: number): number {
  let h = 2166136261 >>> 0;
  const s = `${seedStr}:${idx}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const t = ((h >>> 0) % 1000) / 1000 + idx * 0.17;
  return 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
}

export function generate24hFromReading(
  pm25: number | null | undefined,
  cityLabel: string,
): number[] {
  if (typeof pm25 !== "number" || Number.isNaN(pm25)) return [];
  const dayStamp = new Date().toISOString().slice(0, 10);
  const seed = `${cityLabel}|${dayStamp}`;
  return Array.from({ length: 24 }, (_, i) => {
    const wobble = seedUnit01(seed, i);
    const band = pm25 * 0.38;
    const v = pm25 + (wobble - 0.5) * 2 * band;
    return Math.max(5, Math.round(v));
  });
}
