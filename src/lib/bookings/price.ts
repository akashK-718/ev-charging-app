const NOMINAL_KW: Record<string, number> = {
  'AC_3.3kW': 3.3,
  'AC_7kW': 7,
  'AC_22kW': 22,
  'DC_fast': 50,
};

export function getBookingPrice(chargerType: string, pricePerKwh: number, minutes: number) {
  const centiKwh = Math.round((NOMINAL_KW[chargerType] ?? 7) * (minutes / 60) * 100);
  return { kwh: centiKwh / 100, amount: Math.round(pricePerKwh * (centiKwh / 100) * 100) };
}

export function getBudgetDuration(chargerType: string, pricePerKwh: number, budgetRupees: number) {
  // A whole number of centi-kWh keeps the quote within the selected budget.
  const centiKwh = Math.floor((budgetRupees * 100) / pricePerKwh);
  return (centiKwh / 100 / (NOMINAL_KW[chargerType] ?? 7)) * 60;
}
