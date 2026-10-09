import type { CasesWeekResponse } from "@/types/cases";

export function clampScenario(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Pollution amplification vs low reference (~WHO interim target scale). Sandbox only. */
export function scenarioSandboxAirFactor(pm25Ug: number): number {
  const p = Math.max(5, Number(pm25Ug) || 5);
  const stress = clampScenario((p - 12) / 125, 0, 1) * 1.4;
  return 1 + 0.5 * stress;
}

/** Heat amplification vs mild reference (°C). Sandbox only. */
export function scenarioSandboxHeatFactor(effC: number): number {
  const c = Number(effC);
  if (!(c >= c)) return 1;
  const stress = clampScenario((c - 26) / 14, 0, 1) * 1.25;
  return 1 + 0.55 * stress;
}

export interface ScenarioBaseline {
  avgDaily: number | null;
  weekTotal: number | null;
}

/** Mirrors web `syncScenarioBaselineFromCases()`. */
export function syncScenarioBaselineFromCases(
  casesJson: CasesWeekResponse | undefined,
): ScenarioBaseline {
  if (!casesJson) {
    return { avgDaily: null, weekTotal: null };
  }

  const days = Array.isArray(casesJson.days) ? casesJson.days : [];
  let avg: number | null = null;
  if (days.length > 0) {
    let sum = 0;
    for (const d of days) {
      sum += typeof d === "number" && !Number.isNaN(d) ? d : 0;
    }
    avg = sum / days.length;
  } else if (
    typeof casesJson.total === "number" &&
    !Number.isNaN(casesJson.total)
  ) {
    avg = casesJson.total / 7;
  }

  const weekTotal =
    typeof casesJson.total === "number" && !Number.isNaN(casesJson.total)
      ? Math.round(casesJson.total)
      : avg != null
        ? Math.round(avg * 7)
        : null;

  return { avgDaily: avg, weekTotal };
}

export function clampLivePm25(pmRaw: number | null | undefined): number {
  const pm = typeof pmRaw === "number" && !Number.isNaN(pmRaw) ? pmRaw : 72;
  return Math.min(320, Math.max(5, Math.round(pm)));
}

/** Prefer live PM2.5; fall back to station AQI so the sandbox starts near today's reading. */
export function clampLiveAirSeed(input: {
  pm25?: number | null;
  aqi?: number | null;
}): number {
  if (typeof input.pm25 === "number" && !Number.isNaN(input.pm25)) {
    return clampLivePm25(input.pm25);
  }
  if (typeof input.aqi === "number" && Number.isFinite(input.aqi)) {
    return clampLivePm25(input.aqi);
  }
  return clampLivePm25(null);
}

export function clampLiveHeat(htRaw: number | null | undefined): number {
  const ht = typeof htRaw === "number" && !Number.isNaN(htRaw) ? htRaw : 30;
  return Math.round(clampScenario(ht, 22, 46) * 2) / 2;
}

export interface ScenarioSandboxResult {
  airMul: number;
  heatMul: number;
  combinedMul: number;
  loadIndex: number;
  baselineAvgDaily: number | null;
  baselineWeekTotal: number | null;
  simDaily: number | null;
  simWeek: number | null;
  deltaLabel: string;
}

/** Mirrors web `updateScenarioSandbox()` outcome math. */
export function computeScenarioSandbox(options: {
  pm25: number;
  heatC: number;
  baseline: ScenarioBaseline;
}): ScenarioSandboxResult {
  const { pm25, heatC, baseline } = options;
  const base =
    typeof baseline.avgDaily === "number" &&
    baseline.avgDaily >= 0 &&
    !Number.isNaN(baseline.avgDaily)
      ? baseline.avgDaily
      : null;

  const airF = scenarioSandboxAirFactor(pm25);
  const heatF = scenarioSandboxHeatFactor(heatC);
  const combined = airF * heatF;
  const airStressDisp = clampScenario((pm25 - 12) / 125, 0, 1);
  const heatStressDisp = clampScenario((heatC - 26) / 14, 0, 1);
  const loadIndex = Math.min(
    100,
    Math.round(52 * airStressDisp + 48 * heatStressDisp),
  );

  if (base == null) {
    return {
      airMul: airF,
      heatMul: heatF,
      combinedMul: combined,
      loadIndex,
      baselineAvgDaily: null,
      baselineWeekTotal: baseline.weekTotal,
      simDaily: null,
      simWeek: null,
      deltaLabel: "Load city cases first.",
    };
  }

  const simDaily = Math.max(0, Math.round(base * combined));
  const simWeek = Math.max(0, Math.round(simDaily * 7));
  const baseWeek = baseline.weekTotal;

  let deltaLabel: string;
  if (typeof baseWeek === "number" && !Number.isNaN(baseWeek)) {
    const delta = simWeek - baseWeek;
    deltaLabel = `${delta >= 0 ? "+" : ""}${delta} vs synth week total (${baseWeek})`;
  } else {
    deltaLabel = `${simDaily * 7} linear week (baseline week total unavailable)`;
  }

  return {
    airMul: airF,
    heatMul: heatF,
    combinedMul: combined,
    loadIndex,
    baselineAvgDaily: base,
    baselineWeekTotal: baseWeek,
    simDaily,
    simWeek,
    deltaLabel,
  };
}
