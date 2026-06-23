/**
 * Format a price (integer BDT) as a Bangladeshi Taka string.
 * All money in the database is stored as integers (whole taka).
 */
export function formatBDT(amount: number | null | undefined): string {
  if (amount == null) return "৳ 0";
  return `৳ ${Math.round(amount).toLocaleString("en-BD")}`;
}

export function hasSale(regular: number, sale: number | null | undefined): sale is number {
  return typeof sale === "number" && sale > 0 && sale < regular;
}

export function effectivePrice(regular: number, sale: number | null | undefined): number {
  return hasSale(regular, sale) ? sale : regular;
}
