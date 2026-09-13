import { normalizeIngredientName } from "./dates";
import { singularizeShopName } from "./shopping-aggregate";

export type ShopAisleId =
  | "produce"
  | "meat"
  | "fish"
  | "dairy"
  | "bakery"
  | "frozen"
  | "pantry"
  | "household";

export type ShopAisle = {
  id: ShopAisleId;
  label: string;
};

/** Display order — roughly a supermarket walk. */
export const SHOP_AISLES: ShopAisle[] = [
  { id: "produce", label: "Fruit & veg" },
  { id: "meat", label: "Meat" },
  { id: "fish", label: "Fish" },
  { id: "dairy", label: "Dairy" },
  { id: "bakery", label: "Bakery" },
  { id: "frozen", label: "Frozen" },
  { id: "pantry", label: "Pantry" },
  { id: "household", label: "Household & other" },
];

type Rule = { aisle: ShopAisleId; pattern: RegExp };

/** Build `\b(foo|foos|bar|bars)\b` from base words (handles simple +es plurals). */
function words(...bases: string[]): RegExp {
  const parts = bases.flatMap((w) => {
    if (w.includes(" ")) {
      // "spring onion" → spring onion(s)
      const [first, ...rest] = w.split(" ");
      const last = rest[rest.length - 1] ?? "";
      const head = [first, ...rest.slice(0, -1)].join(" ");
      if (/[^s]$/i.test(last) && !/(ss|us|is|oes)$/i.test(last)) {
        return [`${head} ${last}`, `${head} ${last}s`].filter(Boolean);
      }
      return [w];
    }
    if (/(?:potato|tomato|hero)$/i.test(w)) return [w, `${w}es`];
    if (/(?:leaf)$/i.test(w)) return [w, "leaves"];
    if (/(?:berry)$/i.test(w)) return [w, w.replace(/y$/i, "ies")];
    if (/s$/i.test(w)) return [w];
    return [w, `${w}s`];
  });
  const unique = [...new Set(parts.map((p) => p.toLowerCase()))];
  return new RegExp(`\\b(${unique.join("|")})\\b`, "i");
}

/**
 * First match wins. Patterns are against the normalised ingredient name.
 * Household before pantry so bin liners etc. don't look like food.
 */
const AISLE_RULES: Rule[] = [
  // Non-food first
  {
    aisle: "household",
    pattern:
      /\b(bin liners?|bin bags?|refuse sacks?|rubbish bags?|garbage bags?|cling ?film|kitchen roll|kitchen towel|paper towel|tin foil|aluminum foil|aluminium foil|foil|washing(?:-|\s)?up liquid|dishwasher|laundry|soap|sponge|sponges|batter(?:y|ies)|candle|candles|match(?:es)?|wine|beer|cider|napp(?:y|ies)|toilet roll|loo roll)\b/i,
  },

  // Frozen (overrides produce words like peas)
  { aisle: "frozen", pattern: /\bfrozen\b|\bice cream\b|\bice-cream\b/i },

  {
    aisle: "meat",
    pattern: words(
      "chicken",
      "turkey",
      "duck",
      "beef",
      "steak",
      "mince",
      "lamb",
      "pork",
      "bacon",
      "sausage",
      "ham",
      "gammon",
      "chorizo",
      "pancetta",
      "salami",
      "prosciutto",
      "meatball",
      "liver",
      "thigh",
      "breast",
      "drumstick",
      "joint",
      "rib",
      "poultry",
      "roasting chicken",
    ),
  },

  {
    aisle: "fish",
    pattern: words(
      "salmon",
      "cod",
      "haddock",
      "tuna",
      "prawn",
      "shrimp",
      "mussel",
      "crab",
      "fish",
      "seafood",
      "trout",
      "mackerel",
      "sardine",
      "squid",
      "scallop",
      "anchovy",
      "sea bass",
      "seabass",
    ),
  },

  {
    aisle: "dairy",
    pattern:
      /\b(milk|butter|cream|creme fraiche|crème fraîche|yogurt|yoghurt|yogurts|yoghurts|cheese|cheddar|parmesan|mozzarella|mascarpone|ricotta|feta|halloumi|eggs?|fromage|sour cream|double cream|single cream|clotted)\b/i,
  },

  {
    aisle: "bakery",
    pattern: words(
      "bread",
      "loaf",
      "baguette",
      "roll",
      "bap",
      "brioche",
      "croissant",
      "tortilla",
      "wrap",
      "pitta",
      "pita",
      "naan",
      "ciabatta",
      "bagel",
      "bun",
    ),
  },

  {
    aisle: "produce",
    pattern: words(
      // alliums & roots
      "onion",
      "spring onion",
      "red onion",
      "white onion",
      "brown onion",
      "shallot",
      "garlic",
      "ginger",
      "potato",
      "sweet potato",
      "new potato",
      "carrot",
      "parsnip",
      "swede",
      "turnip",
      "beetroot",
      "radish",
      "celeriac",
      "Jerusalem artichoke",
      // veg
      "tomato",
      "cherry tomato",
      "celery",
      "leek",
      "pepper",
      "bell pepper",
      "sweet pepper",
      "chilli",
      "chili",
      "courgette",
      "zucchini",
      "aubergine",
      "eggplant",
      "spinach",
      "lettuce",
      "salad",
      "cucumber",
      "mushroom",
      "broccoli",
      "cauliflower",
      "cabbage",
      "savoy cabbage",
      "kale",
      "bean",
      "green bean",
      "runner bean",
      "broad bean",
      "pea",
      "peas",
      "mangetout",
      "sugar snap",
      "sweetcorn",
      "corn",
      "asparagus",
      "squash",
      "butternut squash",
      "pumpkin",
      "avocado",
      "fennel",
      "pak choi",
      "bok choy",
      "choi sum",
      "tenderstem",
      "tenderstem broccoli",
      "romanescu",
      "artichoke",
      "okra",
      "plantain",
      "yam",
      "cassava",
      "edamame",
      "watercress",
      "rocket",
      "arugula",
      "chicory",
      "endive",
      "radicchio",
      "celery stick",
      "corn on the cob",
      // fruit
      "apple",
      "banana",
      "lemon",
      "lime",
      "orange",
      "blood orange",
      "clementine",
      "satsuma",
      "tangerine",
      "grapefruit",
      "berry",
      "strawberry",
      "raspberry",
      "blueberry",
      "blackberry",
      "grape",
      "mango",
      "peach",
      "nectarine",
      "plum",
      "pear",
      "fig",
      "date",
      "kiwi",
      "kiwifruit",
      "pineapple",
      "melon",
      "watermelon",
      "pomegranate",
      "passion fruit",
      "coconut",
      "rhubarb",
      "fruit",
      // herbs
      "herb",
      "parsley",
      "coriander",
      "cilantro",
      "basil",
      "mint",
      "rosemary",
      "thyme",
      "dill",
      "chive",
      "sage",
      "oregano",
      "tarragon",
      "bay leaf",
      "lemongrass",
      "kaffir lime leaf",
    ),
  },

  {
    aisle: "pantry",
    pattern:
      /\b(flour|sugar|oils?|olive|vinegar|stocks?|broths?|pasta|spaghetti|penne|rice|noodles?|couscous|quinoa|lentils?|chickpeas?|beans?|tins?|tinned|cans?|canned|passata|tomato puree|purée|sauce|soy|worcester|mustard|ketchup|mayo|mayonnaise|honey|syrup|jam|marmalade|peanut butter|nut butter|coconut milk|spice|cumin|paprika|turmeric|cinnamon|nutmeg|oregano|mixed herb|bay leaf|peppercorn|salt|pepper|baking powder|bicarbonate|yeast|cocoa|chocolate|raisins?|sultanas?|almonds?|walnuts?|cashews?|seeds?|sesame|breadcrumbs?|cornflour|cornstarch|polenta|oats?|cereal|crackers?|biscuit|tortilla chips?)\b/i,
  },
];

/** Always hide qty for these (even if aisle would normally show). */
const HIDE_QTY = [
  /\bflour\b/,
  /\bsugar\b/,
  /\boil\b/,
  /\bvinegar\b/,
  /\bstock\b/,
  /\bbroth\b/,
  /\bspice\b/,
  /\bcumin\b/,
  /\bpaprika\b/,
  /\bturmeric\b/,
  /\bcinnamon\b/,
  /\bnutmeg\b/,
  /\boregano\b/,
  /\bbay\b/,
  /\bsalt\b/,
  /\bblack pepper\b/,
  /\bwhite pepper\b/,
  /\bground pepper\b/,
  /\bpeppercorns?\b/,
  /\bbaking powder\b/,
  /\bbicarbonate\b/,
  /\byeast\b/,
  /\bherb\b/,
  /\bdried\b/,
  /\bsoy sauce\b/,
  /\bworcester\b/,
  /\bmustard\b/,
  /\bketchup\b/,
  /\bmayonnaise\b/,
  /\bmayo\b/,
  /\bpassata\b/,
  /\bpuree\b/,
  /\bpurée\b/,
  /\bcocoa\b/,
  /\bcornflour\b/,
  /\bcornstarch\b/,
  /\bbreadcrumb\b/,
  /\bsesame\b/,
  /\bseed\b/,
];

/** Aisles where quantities are usually useful in store. */
const SHOW_QTY_AISLES = new Set<ShopAisleId>([
  "produce",
  "meat",
  "fish",
  "dairy",
  "bakery",
  "frozen",
  "household",
]);

export function classifyShopAisle(name: string): ShopAisleId {
  const raw = normalizeIngredientName(name);
  if (!raw) return "household";
  // Match both as-written and singularised ("lemons" / "lemon") so plurals
  // never need a one-off aisle rule.
  const candidates = [
    raw,
    normalizeIngredientName(singularizeShopName(name)),
  ].filter((v, i, arr) => v && arr.indexOf(v) === i);

  for (const candidate of candidates) {
    for (const rule of AISLE_RULES) {
      if (rule.pattern.test(candidate)) return rule.aisle;
    }
  }
  return "pantry";
}

/**
 * Show quantity for fresh / buy-by-weight aisles; hide for dry pantry staples
 * like flour where shoppers buy “a bag” not 200g.
 */
export function shouldShowShopQuantity(
  name: string,
  aisle?: ShopAisleId,
): boolean {
  const n = normalizeIngredientName(name);
  if (!n) return false;
  if (HIDE_QTY.some((re) => re.test(n))) return false;
  const a = aisle ?? classifyShopAisle(name);
  return SHOW_QTY_AISLES.has(a);
}

export function groupItemsByAisle<T extends { name: string }>(
  items: T[],
): { aisle: ShopAisle; items: T[] }[] {
  const buckets = new Map<ShopAisleId, T[]>();
  for (const aisle of SHOP_AISLES) buckets.set(aisle.id, []);

  for (const item of items) {
    const id = classifyShopAisle(item.name);
    buckets.get(id)!.push(item);
  }

  return SHOP_AISLES.map((aisle) => ({
    aisle,
    items: buckets.get(aisle.id) || [],
  })).filter((g) => g.items.length > 0);
}
