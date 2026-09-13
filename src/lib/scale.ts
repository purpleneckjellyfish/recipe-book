import { formatPrettyQuantity } from "@/lib/ingredients";

/**
 * Scale a quantity by servings ratio.
 * Keeps sensible rounding for cook-friendly numbers.
 */
export function scaleQuantity(
  quantity: number | null | undefined,
  fromServings: number,
  toServings: number,
): number | null {
  if (quantity == null || !Number.isFinite(quantity)) return null;
  if (!fromServings || fromServings <= 0) return quantity;
  const raw = (quantity * toServings) / fromServings;
  if (raw >= 100) return Math.round(raw);
  if (raw >= 10) return Math.round(raw * 10) / 10;
  if (raw >= 1) return Math.round(raw * 100) / 100;
  return Math.round(raw * 1000) / 1000;
}

export function formatQuantity(quantity: number | null | undefined, unit?: string | null) {
  if (quantity == null) return unit?.trim() || "";
  const q = formatPrettyQuantity(quantity);
  return unit?.trim() ? `${q} ${unit.trim()}` : q;
}
