// Normalize any user-typed Bangladeshi phone to canonical 01XXXXXXXXX (11 digits).
// Handles: +8801XXXXXXXXX, 008801XXXXXXXXX, 8801XXXXXXXXX, 1XXXXXXXXX,
// spaces/dashes/parens, and truncates to 11 digits.
export function normalizeBdPhone(input: string): string {
  if (!input) return "";
  let d = input.replace(/\D+/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("880")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("1")) d = "0" + d;
  return d.slice(0, 11);
}

export function isValidBdPhone(v: string): boolean {
  return /^01[3-9]\d{8}$/.test(v);
}
