/**
 * Expand free-text plan meals (“jackets”, “pasta night”) into shop lines.
 * Intentional “out / takeaway” phrases add nothing.
 */

export type QuickShopLine = {
  name: string;
  quantity: number | null;
  unit: string | null;
};

type Rule = {
  /** Match against normalised note text */
  pattern: RegExp;
  /** Empty = eating out / bought elsewhere */
  items: QuickShopLine[];
};

function line(
  name: string,
  quantity: number | null = null,
  unit: string | null = null,
): QuickShopLine {
  return { name, quantity, unit };
}

/** Common UK kitchen shortcuts — order matters (first match wins). */
const RULES: Rule[] = [
  {
    pattern: /\b(takeaway|take-away|take away|eating out|eat out|out for dinner|pub|restaurant|chippy|fish and chips night)\b/i,
    items: [],
  },
  {
    pattern: /\b(jacket|jackets|jacket potato|jacket potatoes|baked potato|baked potatoes)\b/i,
    items: [
      line("baking potatoes", 4, null),
      line("butter"),
      line("cheddar"),
      line("baked beans", 1, "tin"),
    ],
  },
  {
    pattern: /\b(beans on toast|beans on toast)\b/i,
    items: [line("baked beans", 1, "tin"), line("bread")],
  },
  {
    pattern: /\b(cheese on toast|toastie|toasties)\b/i,
    items: [line("bread"), line("cheddar")],
  },
  {
    pattern: /\b(omelette|omelet|scrambled eggs|eggs on toast|fried egg)\b/i,
    items: [line("eggs", 6, null), line("butter")],
  },
  {
    pattern: /\b(pasta\s*(night|bake)?|spag\s*bol|spaghetti|penne|lasagne night|mac and cheese|macaroni cheese)\b/i,
    items: [
      line("pasta", 500, "g"),
      line("passata", 1, "carton"),
      line("cheddar"),
    ],
  },
  {
    pattern: /\b(pizza|pizzas)\b/i,
    items: [line("pizza", 2, null)],
  },
  {
    pattern: /\b(stir[\s-]?fry|stirfry)\b/i,
    items: [
      line("stir-fry vegetables", 1, "pack"),
      line("noodles", 1, "pack"),
      line("soy sauce"),
    ],
  },
  {
    pattern: /\b(curry night|curry|tikka|korma|jalfrezi)\b/i,
    items: [
      line("rice", 500, "g"),
      line("curry sauce", 1, "jar"),
      line("naan", 2, null),
    ],
  },
  {
    pattern: /\b(nachos|fajitas|tacos)\b/i,
    items: [
      line("tortilla wraps", 1, "pack"),
      line("cheddar"),
      line("salsa"),
      line("sour cream"),
    ],
  },
  {
    pattern: /\b(burger|burgers)\b/i,
    items: [
      line("beef burgers", 4, null),
      line("burger buns", 4, null),
      line("lettuce"),
      line("tomatoes"),
    ],
  },
  {
    pattern: /\b(sausage|sausages|bangers)\b/i,
    items: [
      line("sausages", 1, "pack"),
      line("potatoes", 1, "kg"),
      line("baked beans", 1, "tin"),
    ],
  },
  {
    pattern: /\b(fish (?:finger|fingers)|fishfinger)\b/i,
    items: [
      line("fish fingers", 1, "pack"),
      line("oven chips", 1, "bag"),
      line("peas", 1, "bag"),
    ],
  },
  {
    pattern: /\b(soup)\b/i,
    items: [line("soup", 2, "tin"), line("bread")],
  },
  {
    pattern: /\b(salad night|big salad)\b/i,
    items: [
      line("mixed salad", 1, "bag"),
      line("cucumber"),
      line("tomatoes"),
      line("feta"),
    ],
  },
  {
    pattern: /\b(risotto)\b/i,
    items: [line("risotto rice", 300, "g"), line("stock cubes", 1, "pack")],
  },
  {
    pattern: /\b(chilli|chili con carne)\b/i,
    items: [
      line("mince", 500, "g"),
      line("kidney beans", 1, "tin"),
      line("chopped tomatoes", 1, "tin"),
      line("rice", 500, "g"),
    ],
  },
  {
    pattern: /\b(roast dinner|sunday roast)\b/i,
    items: [
      line("roasting joint or chicken"),
      line("potatoes", 1.5, "kg"),
      line("carrots"),
      line("broccoli"),
      line("gravy granules"),
    ],
  },
];

/**
 * If the note includes an explicit list after : or | or —, use that instead.
 * e.g. "jackets: potatoes, cheese, beans"
 */
function parseExplicitShopList(note: string): QuickShopLine[] | null {
  const split = note.match(/^[^:|–—]+[:|–—]\s*(.+)$/);
  if (!split?.[1]) return null;
  const parts = split[1]
    .split(/,|;&|\band\b/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);
  if (parts.length < 1) return null;
  return parts.map((name) => line(name));
}

export type QuickMealExpandResult = {
  items: QuickShopLine[];
  /** How we resolved the note */
  mode: "explicit" | "preset" | "out" | "unmatched";
};

export function expandQuickMealNote(note: string): QuickMealExpandResult {
  const trimmed = note.trim();
  if (!trimmed) return { items: [], mode: "unmatched" };

  const explicit = parseExplicitShopList(trimmed);
  if (explicit) return { items: explicit, mode: "explicit" };

  for (const rule of RULES) {
    if (rule.pattern.test(trimmed)) {
      return {
        items: rule.items,
        mode: rule.items.length === 0 ? "out" : "preset",
      };
    }
  }

  return { items: [], mode: "unmatched" };
}

/** Ask the AI for a short UK supermarket list when the note is unknown. */
export async function suggestShopLinesForQuickMeal(
  note: string,
): Promise<QuickShopLine[]> {
  const key = process.env.IMPORT_API_KEY;
  if (!key) return [];

  const base = (process.env.IMPORT_API_BASE || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.IMPORT_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You turn a vague UK household meal note into a short supermarket shopping list.
Return JSON: { "items": [ { "name": string, "quantity": number|null, "unit": string|null } ] }.
3–8 items max. Metric UK names. No pantry staples (salt, pepper, oil). No cooked takeaway.
If it's clearly eating out, return { "items": [] }.`,
          },
          {
            role: "user",
            content: JSON.stringify({ mealNote: note }),
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items
      .map((i: { name?: string; quantity?: number | null; unit?: string | null }) => ({
        name: String(i.name || "").trim(),
        quantity: typeof i.quantity === "number" ? i.quantity : null,
        unit: i.unit ? String(i.unit) : null,
      }))
      .filter((i: QuickShopLine) => i.name.length > 1)
      .slice(0, 8);
  } catch (err) {
    console.error("Quick meal AI shop suggest failed", err);
    return [];
  }
}
