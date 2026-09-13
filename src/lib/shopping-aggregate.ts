import { normalizeIngredientName } from "./dates";

type UnitGroup = "mass" | "volume" | "count" | "other";

const UNIT_TO_BASE: Record<string, { group: UnitGroup; toBase: number; base: string }> = {
  g: { group: "mass", toBase: 1, base: "g" },
  gram: { group: "mass", toBase: 1, base: "g" },
  grams: { group: "mass", toBase: 1, base: "g" },
  kg: { group: "mass", toBase: 1000, base: "g" },
  kilogram: { group: "mass", toBase: 1000, base: "g" },
  kilograms: { group: "mass", toBase: 1000, base: "g" },
  ml: { group: "volume", toBase: 1, base: "ml" },
  millilitre: { group: "volume", toBase: 1, base: "ml" },
  millilitres: { group: "volume", toBase: 1, base: "ml" },
  milliliter: { group: "volume", toBase: 1, base: "ml" },
  milliliters: { group: "volume", toBase: 1, base: "ml" },
  l: { group: "volume", toBase: 1000, base: "ml" },
  litre: { group: "volume", toBase: 1000, base: "ml" },
  litres: { group: "volume", toBase: 1000, base: "ml" },
  liter: { group: "volume", toBase: 1000, base: "ml" },
  liters: { group: "volume", toBase: 1000, base: "ml" },
  tsp: { group: "volume", toBase: 5, base: "ml" },
  tbsp: { group: "volume", toBase: 15, base: "ml" },
  cup: { group: "volume", toBase: 240, base: "ml" },
  cups: { group: "volume", toBase: 240, base: "ml" },
};

/** Multi-word prep phrases first (longest match). */
const PREP_PHRASES = [
  "finely chopped",
  "roughly chopped",
  "freshly chopped",
  "thinly sliced",
  "thickly sliced",
  "finely sliced",
  "roughly sliced",
  "freshly grated",
  "freshly ground",
  "roughly torn",
  "cut into chunks",
  "cut into pieces",
  "cut into wedges",
  "cut into strips",
  "cut in half crosswise",
  "cut in half lengthways",
  "cut in half lengthwise",
  "cut in half",
  "cut crosswise",
  "cut lengthways",
  "cut lengthwise",
  "plus extra to serve",
  "to serve",
  "to taste",
  "zest and juice",
  "juice and zest",
  "zest only",
  "juice only",
  "room temperature",
];

const PREP_WORDS = [
  "chopped",
  "diced",
  "cubed",
  "julienned",
  "peeled",
  "seeded",
  "deseeded",
  "cored",
  "trimmed",
  "cleaned",
  "washed",
  "drained",
  "rinsed",
  "softened",
  "melted",
  "beaten",
  "whisked",
  "crumbled",
  "torn",
  "snipped",
  "halved",
  "quartered",
  "segmented",
  "zested",
  "juiced",
  "divided",
  "crosswise",
  "lengthways",
  "lengthwise",
  "finely",
  "roughly",
  "thinly",
  "thickly",
  "freshly",
  "lightly",
  "optional",
];

/** After a comma these start cooking instructions, not product form. */
const TRAILING_PREP_START =
  "chopped|diced|sliced|minced|peeled|grated|crushed|finely|roughly|thinly|thickly|freshly|cut|divided|halved|quartered|plus|to serve|to taste|optional|softened|melted|beaten|whisked|trimmed|seeded|deseeded|cored|juiced|zested|zest|juice|room temperature";

/** Mass nouns / products that stay plural on a shop list. */
const KEEP_PLURAL = new Set([
  "asparagus",
  "couscous",
  "molasses",
  "oats",
  "chips",
  "crisps",
  "noodles",
  "beans",
  "peas",
  "herbs",
  "greens",
  "sprouts",
]);

const IRREGULAR_SINGULAR: Record<string, string> = {
  potatoes: "potato",
  tomatoes: "tomato",
  leaves: "leaf",
  loaves: "loaf",
  berries: "berry",
  cherries: "cherry",
  strawberries: "strawberry",
  raspberries: "raspberry",
  blueberries: "blueberry",
  chives: "chive",
  babies: "baby",
};

const SIZE_WORDS = [
  "extra-large",
  "extra large",
  "large",
  "medium",
  "small",
  "baby",
];

/** Prep words that are sometimes the product itself — keep when paired. */
const KEEP_IF: { word: string; keepIf: RegExp }[] = [
  { word: "minced", keepIf: /\b(beef|pork|lamb|turkey|veal|chicken|meat)\b/ },
  { word: "ground", keepIf: /\b(beef|pork|lamb|turkey|veal|almond|almonds)\b/ },
  { word: "sliced", keepIf: /\b(bread|ham|bacon|salami|chorizo|loaf)\b/ },
  { word: "crushed", keepIf: /\b(tomato|tomatoes)\b/ },
  { word: "smoked", keepIf: /\b(bacon|ham|salmon|haddock|paprika|cheese)\b/ },
];

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleCaseName(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Lemons / onions → lemon / onion so list lines merge and aisles match. */
export function singularizeShopName(name: string): string {
  const lower = name.toLowerCase().trim();
  if (!lower || KEEP_PLURAL.has(lower)) return titleCaseName(lower);

  if (IRREGULAR_SINGULAR[lower]) {
    return titleCaseName(IRREGULAR_SINGULAR[lower]);
  }

  const parts = lower.split(/\s+/);
  const last = parts[parts.length - 1]!;
  const head = parts.slice(0, -1).join(" ");

  if (KEEP_PLURAL.has(last) || KEEP_PLURAL.has(lower)) {
    return titleCaseName(lower);
  }
  if (IRREGULAR_SINGULAR[last]) {
    const next = [head, IRREGULAR_SINGULAR[last]].filter(Boolean).join(" ");
    return titleCaseName(next);
  }
  // tomatoes / mangoes → tomato / mango
  if (last.length > 4 && /oes$/i.test(last)) {
    const next = [head, last.slice(0, -2)].filter(Boolean).join(" ");
    return titleCaseName(next);
  }
  // berries already handled; cherries → cherry
  if (last.length > 4 && /ies$/i.test(last)) {
    const next = [head, `${last.slice(0, -3)}y`].filter(Boolean).join(" ");
    return titleCaseName(next);
  }
  // chickens → chicken, lemons → lemon (not asparagus, couscous, …)
  if (
    last.length > 3 &&
    /s$/i.test(last) &&
    !/(ss|us|is|oes|asparagus|couscous)$/i.test(last)
  ) {
    const next = [head, last.slice(0, -1)].filter(Boolean).join(" ");
    return titleCaseName(next);
  }

  return titleCaseName(lower);
}

/**
 * Strip cooking prep ("chopped garlic" → "Garlic") for shopping lists.
 * Keeps product forms like "minced beef" / "sliced bread".
 */
export function simplifyShoppingName(raw: string): string {
  let s = raw.toLowerCase().trim();
  if (!s) return "";

  // Drop leading "x " left over from "2 x 4-pound …" if count was already parsed
  s = s.replace(/^x\s+/i, "");

  // Drop parenthetical notes: garlic (chopped)
  s = s.replace(/\([^)]*\)/g, " ");

  // Drop trailing ", cut in half…" / "; diced" / ", zest and juice"
  s = s.replace(new RegExp(`[,;]\\s*(${TRAILING_PREP_START}).*$`, "i"), " ");

  // Per-item weight left in the name: "4 pound roasting chickens"
  s = s.replace(
    /^\d+[.,]?\d*\s*-?\s*(pounds?|lbs?|lb|kilograms?|kg|grams?|g|ounces?|oz)\s+/i,
    "",
  );
  s = s.replace(
    /\b\d+[.,]?\d*\s*-?\s*(pounds?|lbs?|lb|kilograms?|kg|ounces?|oz)\b/gi,
    " ",
  );

  // "3 cloves of garlic" / "a bunch of coriander" → garlic / coriander
  s = s.replace(
    /^(a |an |the )?(handful|bunch|sprig|sprigs|pinch|knob|head|heads|stick|sticks|clove|cloves|bulb|bulbs|piece|pieces|pack|packet|tin|can|jar|slice|slices) of\s+/i,
    "",
  );
  s = s.replace(/\b(cloves?|bulbs?|heads?) of\s+/gi, "");
  // "bulb garlic" / "garlic bulb" / "bunch coriander"
  s = s.replace(
    /^(a |an |the )?(bulbs?|heads?|bunches?|bunch|handfuls?|handful|sprigs?|packs?|pack)\s+/i,
    "",
  );
  s = s.replace(/\s+(bulbs?|heads?)$/i, "");

  for (const phrase of PREP_PHRASES) {
    s = s.replace(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "gi"), " ");
  }

  for (const { word, keepIf } of KEEP_IF) {
    if (keepIf.test(s) && new RegExp(`\\b${word}\\b`, "i").test(s)) {
      continue;
    }
    s = s.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi"), " ");
  }

  // Always strip grated/shredded for shop (buy the cheese / veg name)
  s = s.replace(/\b(grated|shredded)\b/gi, " ");
  s = s.replace(/\b(zest|juice|juiced|zested)\b/gi, " ");

  for (const word of PREP_WORDS) {
    s = s.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi"), " ");
  }

  for (const word of SIZE_WORDS) {
    s = s.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi"), " ");
  }

  s = s.replace(/\bfresh\b/gi, " ");

  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^(and|or|with)\s+/i, "").replace(/\s+(and|or)$/i, "");
  s = s.replace(/\s+/g, " ").trim();

  if (!s) {
    return raw.trim().replace(/\s+/g, " ");
  }

  // Keep human list wording (carrots, not carrot) — aisle matching
  // handles plurals separately.
  return titleCaseName(s);
}

export type AggregatedLine = {
  name: string;
  quantity: number | null;
  unit: string | null;
  note?: string;
};

/**
 * Map recipe units into what you actually buy (e.g. whole garlic → bulb;
 * clove counts are too fiddly for a shop list).
 */
export function toShoppingLine(line: {
  name: string;
  quantity: number | null;
  unit: string | null;
}): AggregatedLine {
  const name = simplifyShoppingName(line.name);
  let quantity = line.quantity;
  let unit = line.unit ? unitKey(line.unit) : null;

  if (/^garlics?$/i.test(name)) {
    if (unit === "clove") {
      // Need garlic on the list; clove counts aren't shop units
      quantity = null;
      unit = "bulb";
    } else if (!unit || unit === "bulb" || unit === "head") {
      unit = "bulb";
      if (quantity == null) quantity = 1;
    }
  }

  return { name, quantity, unit };
}

/** Prefer plural wording on the list when merging carrot + carrots. */
function preferDisplayName(current: string, incoming: string): string {
  const a = current.toLowerCase();
  const b = incoming.toLowerCase();
  if (b.endsWith("s") && !a.endsWith("s")) return incoming;
  return current;
}

function unitKey(unit: string | null | undefined) {
  return (unit || "").trim().toLowerCase();
}

function toCanonical(quantity: number | null, unit: string | null) {
  if (quantity == null)
    return {
      quantity: null as number | null,
      unit: unitKey(unit) || null,
      group: "other" as UnitGroup,
    };
  const key = unitKey(unit);
  const meta = UNIT_TO_BASE[key];
  if (!meta) return { quantity, unit: key || null, group: "other" as UnitGroup };
  return {
    quantity: quantity * meta.toBase,
    unit: meta.base,
    group: meta.group,
  };
}

function fromCanonical(quantity: number, baseUnit: string) {
  if (baseUnit === "g" && quantity >= 1000) {
    return {
      quantity: Math.round((quantity / 1000) * 1000) / 1000,
      unit: "kg",
    };
  }
  if (baseUnit === "ml" && quantity >= 1000) {
    return {
      quantity: Math.round((quantity / 1000) * 1000) / 1000,
      unit: "l",
    };
  }
  return { quantity: Math.round(quantity * 1000) / 1000, unit: baseUnit };
}

export function aggregateIngredients(
  lines: { name: string; quantity: number | null; unit: string | null }[],
): AggregatedLine[] {
  type Bucket = {
    displayName: string;
    quantity: number | null;
    unit: string | null;
    group: UnitGroup;
    conflictNotes: string[];
  };

  const map = new Map<string, Bucket>();

  for (const line of lines) {
    const shop = toShoppingLine(line);
    const simple = shop.name;
    // Merge carrot/carrots; keep human plural on the label when we have one
    const norm = normalizeIngredientName(singularizeShopName(simple));
    if (!norm) continue;
    const canon = toCanonical(shop.quantity, shop.unit);
    const key = `${norm}::${canon.group}::${canon.unit || "none"}`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        displayName: simple,
        quantity: canon.quantity,
        unit: canon.unit,
        group: canon.group,
        conflictNotes: [],
      });
      continue;
    }

    existing.displayName = preferDisplayName(existing.displayName, simple);

    if (existing.quantity != null && canon.quantity != null) {
      existing.quantity += canon.quantity;
    } else if (existing.quantity == null && canon.quantity != null) {
      existing.quantity = canon.quantity;
      existing.unit = canon.unit;
    } else if (
      existing.quantity != null &&
      canon.quantity == null &&
      canon.unit &&
      existing.unit &&
      canon.unit !== existing.unit
    ) {
      existing.conflictNotes.push(simple);
    }
  }

  const result: AggregatedLine[] = [];
  for (const bucket of map.values()) {
    if (
      bucket.quantity != null &&
      (bucket.unit === "g" || bucket.unit === "ml")
    ) {
      const pretty = fromCanonical(bucket.quantity, bucket.unit);
      result.push({
        name: bucket.displayName,
        quantity: pretty.quantity,
        unit: pretty.unit,
        note: bucket.conflictNotes.length
          ? `Also: ${bucket.conflictNotes.join(", ")}`
          : undefined,
      });
    } else {
      result.push({
        name: bucket.displayName,
        quantity: bucket.quantity,
        unit: bucket.unit,
        note: bucket.conflictNotes.length
          ? `Also: ${bucket.conflictNotes.join(", ")}`
          : undefined,
      });
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export function isPantryMatch(name: string, staples: string[]): boolean {
  const n = normalizeIngredientName(simplifyShoppingName(name));
  if (!n) return false;
  return staples.some((s) => {
    const st = normalizeIngredientName(simplifyShoppingName(s));
    return !!st && n === st;
  });
}
