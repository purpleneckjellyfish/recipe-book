/**
 * Curated UK supermarket catalogue for custom shopping-list suggestions.
 * Matching is prefix-based on whole words — "br" → bread, broccoli; not "broken".
 */

const RAW = [
  // Bakery
  "bread",
  "wholemeal bread",
  "white bread",
  "sliced bread",
  "baguette",
  "crusty loaf",
  "bread rolls",
  "burger buns",
  "brioche buns",
  "pitta bread",
  "naan bread",
  "tortillas",
  "wraps",
  "crumpets",
  "bagels",
  "croissants",
  "English muffins",
  "garlic bread",

  // Dairy & eggs
  "milk",
  "semi-skimmed milk",
  "whole milk",
  "skimmed milk",
  "oat milk",
  "almond milk",
  "butter",
  "spreadable butter",
  "margarine",
  "eggs",
  "free-range eggs",
  "cheddar",
  "mature cheddar",
  "parmesan",
  "mozzarella",
  "feta",
  "cream cheese",
  "cottage cheese",
  "yoghurt",
  "Greek yoghurt",
  "double cream",
  "single cream",
  "sour cream",
  "crème fraîche",
  "custard",

  // Meat
  "chicken breasts",
  "chicken thighs",
  "whole chicken",
  "minced beef",
  "beef mince",
  "steak",
  "beef stewing steak",
  "lamb mince",
  "lamb chops",
  "pork mince",
  "pork chops",
  "bacon",
  "smoked bacon",
  "sausages",
  "chipolatas",
  "ham",
  "gammon",
  "turkey mince",
  "chorizo",

  // Fish
  "salmon fillets",
  "cod fillets",
  "haddock",
  "smoked haddock",
  "tuna steaks",
  "prawns",
  "fish fingers",
  "fish pie mix",

  // Fruit & veg
  "bananas",
  "apples",
  "oranges",
  "lemons",
  "limes",
  "grapes",
  "strawberries",
  "blueberries",
  "raspberries",
  "avocado",
  "tomatoes",
  "cherry tomatoes",
  "cucumber",
  "lettuce",
  "salad bag",
  "spinach",
  "rocket",
  "broccoli",
  "cauliflower",
  "carrots",
  "potatoes",
  "new potatoes",
  "sweet potatoes",
  "onions",
  "red onions",
  "garlic",
  "ginger",
  "peppers",
  "red peppers",
  "mushrooms",
  "courgettes",
  "aubergine",
  "celery",
  "leeks",
  "spring onions",
  "cabbage",
  "kale",
  "green beans",
  "peas",
  "sweetcorn",
  "asparagus",
  "beetroot",
  "parsley",
  "coriander",
  "basil",
  "mint",
  "chillies",

  // Pantry staples (things people still top up)
  "plain flour",
  "self-raising flour",
  "bread flour",
  "sugar",
  "caster sugar",
  "brown sugar",
  "icing sugar",
  "olive oil",
  "vegetable oil",
  "sunflower oil",
  "rapeseed oil",
  "vinegar",
  "balsamic vinegar",
  "soy sauce",
  "Worcestershire sauce",
  "tomato ketchup",
  "mayonnaise",
  "mustard",
  "honey",
  "jam",
  "peanut butter",
  "marmite",
  "stock cubes",
  "chicken stock",
  "vegetable stock",
  "passata",
  "tinned tomatoes",
  "chopped tomatoes",
  "tinned tuna",
  "baked beans",
  "chickpeas",
  "kidney beans",
  "coconut milk",
  "pasta",
  "spaghetti",
  "penne",
  "rice",
  "basmati rice",
  "risotto rice",
  "noodles",
  "couscous",
  "lentils",
  "porridge oats",
  "cereal",
  "cornflakes",
  "Weetabix",
  "tea bags",
  "coffee",
  "instant coffee",
  "biscuits",
  "digestives",
  "crackers",
  "crisps",
  "nuts",
  "raisins",
  "chocolate",
  "dark chocolate",
  "baking powder",
  "bicarbonate of soda",
  "yeast",
  "cocoa powder",
  "vanilla extract",

  // Frozen
  "frozen peas",
  "frozen mixed vegetables",
  "frozen spinach",
  "ice cream",
  "frozen chips",
  "frozen pizza",
  "oven chips",

  // Drinks
  "orange juice",
  "apple juice",
  "squash",
  "sparkling water",
  "still water",
  "wine",
  "red wine",
  "white wine",
  "beer",
  "lager",

  // Household (supermarket aisle)
  "bin bags",
  "kitchen roll",
  "toilet roll",
  "washing up liquid",
  "dishwasher tablets",
  "laundry detergent",
  "fabric softener",
  "cling film",
  "tin foil",
  "baking paper",
  "sponges",
  "kitchen cleaner",
  "bleach",
  "hand soap",
  "toothpaste",
  "shampoo",
  "tissues",
  "nappies",
  "pet food",
  "cat food",
  "dog food",
];

/** De-dupe case-insensitively, keep first spelling. */
export const SUPERMARKET_SUGGESTIONS: string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of RAW) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.sort((a, b) => a.localeCompare(b, "en-GB"));
})();

function wordPrefixMatch(item: string, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return false;
  const words = item.toLowerCase().split(/[\s/-]+/).filter(Boolean);
  if (item.toLowerCase().startsWith(q)) return true;
  return words.some((w) => w.startsWith(q));
}

/**
 * Suggest supermarket items for a typed query.
 * Prefix match only (start of name or any word) — avoids "br" → broken/bring.
 */
export function suggestSupermarketItems(
  query: string,
  limit = 8,
  exclude: string[] = [],
): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const excluded = new Set(exclude.map((e) => e.toLowerCase()));

  const scored: { item: string; score: number }[] = [];
  for (const item of SUPERMARKET_SUGGESTIONS) {
    if (excluded.has(item.toLowerCase())) continue;
    if (!wordPrefixMatch(item, q)) continue;

    const lower = item.toLowerCase();
    let score = 0;
    if (lower === q) score = 0;
    else if (lower.startsWith(q)) score = 1;
    else if (lower.split(/[\s/-]+/)[0]?.startsWith(q)) score = 2;
    else score = 3;
    score += Math.min(item.length / 100, 1); // prefer shorter within band
    scored.push({ item, score });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.item.localeCompare(b.item, "en-GB"))
    .slice(0, limit)
    .map((s) => s.item);
}
