/**
 * lib/currency.ts
 * 
 * Helper for Indonesian Rupiah automatic formatting.
 * Formats numbers on-the-fly with dots (e.g. 1000000 -> "1.000.000").
 */

export function formatRupiahInput(value: string | number): string {
  if (value === undefined || value === null || value === "") return "";
  const clean = value.toString().replace(/[^0-9]/g, "");
  if (!clean) return "";
  const num = parseInt(clean, 10);
  if (isNaN(num)) return "";
  return num.toLocaleString("id-ID");
}

export function parseRupiahInput(formatted: string): number {
  if (!formatted) return 0;
  const clean = formatted.toString().replace(/[^0-9]/g, "");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}
