export const NOMINAL_KW: Record<string, number> = {
  'AC_3.3kW': 3.3,
  'AC_7kW': 7,
  'AC_22kW': 22,
  'DC_fast': 50,
};

/**
 * Estimates energy and cost for an in-progress charging session.
 *
 * All returned values are estimates derived from elapsed wall-clock time and
 * nominal charger power — not measured from hardware telemetry. Always display
 * them with a "~" prefix so the user understands they are approximations.
 */
export function computeSessionEstimate(
  chargerType: string,
  pricePerKwh: number,
  elapsedMs: number,
): { estimatedKwh: number; estimatedCostRupees: number } {
  const nominalKw = NOMINAL_KW[chargerType] ?? 7;
  const estimatedKwh = Math.round(nominalKw * (elapsedMs / 3_600_000) * 100) / 100;
  const estimatedCostRupees = Math.round(pricePerKwh * estimatedKwh);
  return { estimatedKwh, estimatedCostRupees };
}
