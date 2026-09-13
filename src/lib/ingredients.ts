/** Shared ingredient line parser — handles grams, tsp/tbsp, unicode fractions, mixed numbers. */

const FRACTION_CHARS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const UNIT_PATTERN =
  "teaspoons?|tablespoons?|tsp\\.?|tbsp\\.?|tbs\\.?|grams?|kilograms?|millilitres?|milliliters?|litres?|liters?|cups?|ounces?|pounds?|cloves?|bulbs?|heads?|pinches?|handfuls?|slices?|cans?|tins?|packs?|bunches?|sprigs?|sticks?|ml|g|kg|l|oz|lb|fl\\.?\\s*oz";

const EACH_SIZE_UNIT =
  "pounds?|lbs?|lb|kilograms?|kg|grams?|g|ounces?|oz";

function parseFractionToken(token: string): number | null {
  const t = token.trim();
  if (!t) return null;

  // pure unicode fraction
  if (t.length === 1 && FRACTION_CHARS[t] != null) return FRACTION_CHARS[t];

  // mixed unicode e.g. 1½
  const mixedUnicode = t.match(/^(\d+)([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
  if (mixedUnicode) {
    return Number(mixedUnicode[1]) + FRACTION_CHARS[mixedUnicode[2]];
  }

  // ascii fraction 1/2 or mixed 1 1/2
  const mixedAscii = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedAscii) {
    return Number(mixedAscii[1]) + Number(mixedAscii[2]) / Number(mixedAscii[3]);
  }
  const ascii = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (ascii) {
    return Number(ascii[1]) / Number(ascii[2]);
  }

  // decimal / integer
  if (/^\d+[.,]\d+$/.test(t) || /^\d+$/.test(t)) {
    return Number(t.replace(",", "."));
  }

  return null;
}

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().replace(/\.$/, "").replace(/\s+/g, " ").trim();
  if (/^teaspoons?$|^tsp$/.test(u)) return "tsp";
  if (/^tablespoons?$|^tbsp$|^tbs$/.test(u)) return "tbsp";
  if (/^grams?$|^g$/.test(u)) return "g";
  if (/^kilograms?$|^kg$/.test(u)) return "kg";
  if (/^millilitres?$|^milliliters?$|^ml$/.test(u)) return "ml";
  if (/^litres?$|^liters?$|^l$/.test(u)) return "l";
  if (/^cups?$/.test(u)) return "cup";
  if (/^ounces?$|^oz$/.test(u)) return "oz";
  if (/^pounds?$|^lb$/.test(u)) return "lb";
  if (/^fl\.?\s*oz$/.test(u)) return "fl oz";
  if (/^cloves?$/.test(u)) return "clove";
  if (/^bulbs?$/.test(u)) return "bulb";
  if (/^heads?$/.test(u)) return "head";
  if (/^pinches?$/.test(u)) return "pinch";
  if (/^handfuls?$/.test(u)) return "handful";
  if (/^slices?$/.test(u)) return "slice";
  if (/^cans?$|^tins?$/.test(u)) return "can";
  if (/^sprigs?$/.test(u)) return "sprig";
  return u;
}

/**
 * "2 4 pound roasting chickens" / "2 x 4-pound roasting chickens"
 * → count 2 of the product; per-item weight is not the shop quantity.
 */
function parseCountWithEachSize(cleaned: string, sortOrder: number): ParsedIngredient | null {
  const withX = cleaned.match(
    new RegExp(
      `^(\\d+[.,]?\\d*)\\s*[x×]\\s*(\\d+[.,]?\\d*)\\s*-?\\s*(${EACH_SIZE_UNIT})\\b\\s*(.*)$`,
      "i",
    ),
  );
  if (withX) {
    const quantity = Number(withX[1].replace(",", "."));
    const name = (withX[4] || "").trim();
    if (Number.isFinite(quantity) && name) {
      return { sortOrder, quantity, unit: null, name };
    }
  }

  const spaced = cleaned.match(
    new RegExp(
      `^(\\d+)\\s+(\\d+[.,]?\\d*)\\s*-?\\s*(${EACH_SIZE_UNIT})\\b\\s*(.*)$`,
      "i",
    ),
  );
  if (spaced) {
    const quantity = Number(spaced[1]);
    const name = (spaced[4] || "").trim();
    if (Number.isFinite(quantity) && name) {
      return { sortOrder, quantity, unit: null, name };
    }
  }

  return null;
}

export type ParsedIngredient = {
  sortOrder: number;
  quantity: number | null;
  unit: string | null;
  name: string;
};

/**
 * Parse a single ingredient line into quantity / unit / name.
 * Examples:
 *  "200 g chicken breast"
 *  "½ tbsp sunflower oil"
 *  "1/2 tsp salt"
 *  "1½ cups flour"
 *  "salt"
 */
export function parseIngredientLine(line: string, sortOrder = 0): ParsedIngredient {
  const cleaned = line.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return { sortOrder, quantity: null, unit: null, name: "" };
  }

  const eachSized = parseCountWithEachSize(cleaned, sortOrder);
  if (eachSized) return eachSized;

  // Pattern: [qty][unicode fraction]? [unit] [of]? [name]
  // qty can be: 200 | 1/2 | 1 1/2 | 1½ | ½ | 1.5
  const re = new RegExp(
    `^` +
      // quantity group: integer/decimal, optional space + ascii fraction, OR unicode fraction, OR mixed unicode
      `(` +
      `\\d+[\\.,]\\d+` + // 1.5
      `|\\d+\\s+\\d+\\s*\\/\\s*\\d+` + // 1 1/2
      `|\\d+\\s*\\/\\s*\\d+` + // 1/2
      `|\\d+[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]` + // 1½
      `|\\d+` + // 2
      `|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]` + // ½
      `)` +
      `\\s*` +
      `(?:(` +
      UNIT_PATTERN +
      `)\\b)?` +
      `(?:\\s+of)?` +
      `\\s*(.*)$`,
    "i",
  );

  const match = cleaned.match(re);
  if (!match) {
    return { sortOrder, quantity: null, unit: null, name: cleaned };
  }

  const quantity = parseFractionToken(match[1]);
  const unit = match[2] ? normalizeUnit(match[2]) : null;
  let name = (match[3] || "").trim();

  // If we got a quantity but no unit and the "name" starts with a unit word, re-split
  if (quantity != null && !unit && name) {
    const unitAgain = name.match(
      new RegExp(`^(${UNIT_PATTERN})\\b(?:\\s+of)?\\s*(.*)$`, "i"),
    );
    if (unitAgain) {
      return {
        sortOrder,
        quantity,
        unit: normalizeUnit(unitAgain[1]),
        name: unitAgain[2].trim() || cleaned,
      };
    }
  }

  if (!name) {
    // e.g. "1 tbsp" with nothing after — keep as named line
    return {
      sortOrder,
      quantity,
      unit,
      name: unit ? `${unit}` : cleaned,
    };
  }

  return {
    sortOrder,
    quantity: quantity != null && Number.isFinite(quantity) ? quantity : null,
    unit,
    name,
  };
}

export function parseIngredientsText(raw: string): ParsedIngredient[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => parseIngredientLine(line, index));
}

/** Pretty-print quantities for display (½ instead of 0.5 when close). */
export function formatPrettyQuantity(quantity: number | null | undefined): string {
  if (quantity == null || !Number.isFinite(quantity)) return "";
  const abs = Math.abs(quantity);
  const sign = quantity < 0 ? "-" : "";

  const fractions: [number, string][] = [
    [0.125, "⅛"],
    [0.25, "¼"],
    [0.333, "⅓"],
    [0.375, "⅜"],
    [0.5, "½"],
    [0.625, "⅝"],
    [0.666, "⅔"],
    [0.75, "¾"],
    [0.875, "⅞"],
  ];

  const whole = Math.floor(abs);
  const frac = abs - whole;

  if (frac < 0.02) {
    return `${sign}${whole || "0"}`;
  }

  for (const [value, glyph] of fractions) {
    if (Math.abs(frac - value) < 0.04) {
      return whole > 0 ? `${sign}${whole}${glyph}` : `${sign}${glyph}`;
    }
  }

  if (abs >= 100) return `${sign}${Math.round(abs)}`;
  if (abs >= 10) return `${sign}${(Math.round(abs * 10) / 10).toString()}`;
  return `${sign}${(Math.round(abs * 100) / 100).toString()}`;
}
