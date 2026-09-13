import { promises as fs } from "fs";
import path from "path";
import { formatDateOnly, startOfWeek } from "@/lib/dates";
import { scrapeRecipeFromUrl, type ScrapedRecipe } from "@/lib/scrape-recipe";

type Protein =
  | "beef"
  | "pork"
  | "lamb"
  | "chicken"
  | "fish"
  | "veg"
  | "pasta";

type Style =
  | "curry"
  | "pasta"
  | "bake"
  | "stew"
  | "pie"
  | "stirfry"
  | "tray"
  | "salad"
  | "risotto";

type PoolEntry = {
  url: string;
  protein: Protein;
  style: Style;
};

/**
 * Good Food pool — deliberately mixed proteins & styles (not curry-heavy).
 */
export const GOOD_FOOD_POOL: PoolEntry[] = [
  {
    url: "https://www.bbcgoodfood.com/recipes/best-spaghetti-bolognese-recipe",
    protein: "beef",
    style: "pasta",
  },
  {
    url: "https://www.bbcgoodfood.com/recipes/chilli-con-carne-recipe",
    protein: "beef",
    style: "stew",
  },
  {
    url: "https://www.bbcgoodfood.com/recipes/salmon-broccoli-pasta",
    protein: "fish",
    style: "pasta",
  },
  {
    url: "https://www.bbcgoodfood.com/recipes/creamy-leek-potato-cheddar-chive-fish-pie",
    protein: "fish",
    style: "pie",
  },
  {
    url: "https://www.bbcgoodfood.com/recipes/sausage-pasta-bake",
    protein: "pork",
    style: "bake",
  },
  {
    url: "https://www.bbcgoodfood.com/recipes/sausage-casserole",
    protein: "pork",
    style: "stew",
  },
  {
    url: "https://www.bbcgoodfood.com/recipes/veggie-shepherd-pie-sweet-potato-mash",
    protein: "veg",
    style: "pie",
  },
  {
    url: "https://www.bbcgoodfood.com/recipes/next-level-lasagne",
    protein: "beef",
    style: "bake",
  },
  {
    url: "https://www.bbcgoodfood.com/recipes/easy-chicken-curry",
    protein: "chicken",
    style: "curry",
  },
  {
    url: "https://www.bbcgoodfood.com/recipes/speedy-chorizo-ragu-lasagne",
    protein: "pork",
    style: "bake",
  },
];

/**
 * BBC Food pool — mixed authors & dishes (not a Hairy Bikers double-bill).
 */
export const BBC_FOOD_POOL: PoolEntry[] = [
  {
    url: "https://www.bbc.co.uk/food/recipes/great_sausage_casserole_73010",
    protein: "pork",
    style: "stew",
  },
  {
    url: "https://www.bbc.co.uk/food/recipes/crispy_chilli_beef_and_46469",
    protein: "beef",
    style: "tray",
  },
  {
    url: "https://www.bbc.co.uk/food/recipes/thai-style_chilli_beef_95038",
    protein: "beef",
    style: "stirfry",
  },
  {
    url: "https://www.bbc.co.uk/food/recipes/chilli_bean_stir-fry_19412",
    protein: "veg",
    style: "stirfry",
  },
  {
    url: "https://www.bbc.co.uk/food/recipes/pearl_barley_butternut_61137",
    protein: "veg",
    style: "risotto",
  },
  {
    url: "https://www.bbc.co.uk/food/recipes/healthy_sausage_16132",
    protein: "pork",
    style: "stew",
  },
  {
    url: "https://www.bbc.co.uk/food/recipes/vegan_spicy_sausage_78735",
    protein: "veg",
    style: "stew",
  },
  {
    url: "https://www.bbc.co.uk/food/recipes/simple_chicken_curry_95336",
    protein: "chicken",
    style: "curry",
  },
];

/** @deprecated use GOOD_FOOD_POOL */
export const GOOD_FOOD_URLS = GOOD_FOOD_POOL.map((e) => e.url);
/** @deprecated use BBC_FOOD_POOL */
export const BBC_FOOD_URLS = BBC_FOOD_POOL.map((e) => e.url);

export type FeaturedCard = {
  sourceUrl: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  sourceLabel: "Good Food" | "BBC Food";
};

export type FeaturedBySource = {
  version: number;
  weekKey: string;
  goodFood: FeaturedCard[];
  bbcFood: FeaturedCard[];
};

/** Bump when selection rules change so this week's cache rebuilds. */
const CACHE_VERSION = 3;
const CACHE_PATH = path.join(process.cwd(), "data", "featured-week.json");

/** Filler adjectives / grammar — not dish identity. */
const TITLE_STOP = new Set([
  "a",
  "an",
  "and",
  "the",
  "with",
  "without",
  "of",
  "for",
  "to",
  "in",
  "on",
  "from",
  "recipe",
  "recipes",
  "easy",
  "best",
  "quick",
  "simple",
  "classic",
  "homemade",
  "ultimate",
  "next",
  "level",
  "speedy",
  "healthy",
  "great",
  "how",
  "make",
  "style",
  "everyday",
]);

/**
 * Known chef / brand phrases — sharing one of these counts as a clash
 * (this is what let two Hairy Bikers through when "hairy"/"bikers" were stop-words).
 */
const AUTHOR_PHRASES: { match: RegExp; id: string }[] = [
  { match: /\bhairy\s+bikers?\b/i, id: "author:hairy-bikers" },
  { match: /\bnigel\s+slater\b/i, id: "author:nigel-slater" },
  { match: /\bken\s+hom\b/i, id: "author:ken-hom" },
  { match: /\bdr\.?\s*rupy\b/i, id: "author:dr-rupy" },
  { match: /\bjamie\s+oliver\b/i, id: "author:jamie-oliver" },
  { match: /\bmary\s+berry\b/i, id: "author:mary-berry" },
  { match: /\brick\s+stein\b/i, id: "author:rick-stein" },
];

/** Short dish words that still identify a recipe family. */
const SHORT_DISH = new Set([
  "pie",
  "stew",
  "soup",
  "rice",
  "beef",
  "pork",
  "lamb",
  "fish",
  "bake",
  "tart",
  "cake",
  "roll",
  "wrap",
  "taco",
  "dhal",
  "dal",
]);

type TitleSignals = {
  words: Set<string>;
  authors: Set<string>;
};

/** Monday of the current week (household default) — featured set locks to this. */
export function featuredWeekKey(now = new Date()): string {
  return formatDateOnly(startOfWeek(now, 1));
}

function weekIndex(now = new Date()): number {
  const monday = startOfWeek(now, 1).getTime();
  return Math.floor(monday / (7 * 24 * 60 * 60 * 1000));
}

function rotatePool<T>(pool: T[], offset: number, week: number): T[] {
  if (pool.length === 0) return [];
  const start = ((week + offset) % pool.length + pool.length) % pool.length;
  return [...pool.slice(start), ...pool.slice(0, start)];
}

function fingerprint(entry: PoolEntry): string {
  return `${entry.protein}:${entry.style}`;
}

export function titleSignals(text: string): TitleSignals {
  const authors = new Set<string>();
  for (const { match, id } of AUTHOR_PHRASES) {
    if (match.test(text)) authors.add(id);
  }

  const raw = text
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[-_/]+/g, " ");
  const tokens = raw.split(/\s+/).filter(Boolean);
  const words = new Set<string>();
  for (const w of tokens) {
    if (TITLE_STOP.has(w)) continue;
    if (/^\d+$/.test(w)) continue;
    if (w.length >= 4 || SHORT_DISH.has(w)) words.add(w);
  }
  return { words, authors };
}

function clashes(a: TitleSignals, b: TitleSignals): boolean {
  for (const id of a.authors) {
    if (b.authors.has(id)) return true;
  }
  for (const w of a.words) {
    if (b.words.has(w)) return true;
  }
  return false;
}

function urlHintSignals(url: string): TitleSignals {
  try {
    const slug = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
    return titleSignals(slug.replace(/_\d+$/, "").replace(/-/g, " "));
  } catch {
    return { words: new Set(), authors: new Set() };
  }
}

function allowsMeta(
  entry: PoolEntry,
  usedFingerprints: Set<string>,
): boolean {
  const key = fingerprint(entry);
  if (usedFingerprints.has(key)) return false;
  if (
    entry.style === "curry" &&
    [...usedFingerprints].some((k) => k.endsWith(":curry"))
  ) {
    return false;
  }
  if (
    entry.protein === "chicken" &&
    [...usedFingerprints].some((k) => k.startsWith("chicken:"))
  ) {
    return false;
  }
  return true;
}

async function scrapeOne(
  url: string,
  sourceLabel: FeaturedCard["sourceLabel"],
): Promise<FeaturedCard | null> {
  try {
    const scraped: ScrapedRecipe = await scrapeRecipeFromUrl(url);
    return {
      sourceUrl: scraped.sourceUrl,
      title: scraped.title,
      description: scraped.description,
      imageUrl: scraped.imageUrl,
      servings: scraped.servings,
      prepMinutes: scraped.prepMinutes,
      cookMinutes: scraped.cookMinutes,
      sourceLabel,
    };
  } catch (err) {
    console.error("Featured scrape failed", sourceLabel, url, err);
    return null;
  }
}

/**
 * Walk the rotated pool: skip meta clashes and title/author clashes with
 * already-accepted cards; on clash after scrape, try the next candidate.
 */
async function pickCards(
  pool: PoolEntry[],
  count: number,
  sourceLabel: FeaturedCard["sourceLabel"],
  week: number,
  rotateBy: number,
  accepted: TitleSignals[],
  usedFingerprints: Set<string>,
): Promise<FeaturedCard[]> {
  const ordered = rotatePool(pool, rotateBy, week);
  const cards: FeaturedCard[] = [];
  const tried = new Set<string>();

  for (const entry of ordered) {
    if (cards.length >= count) break;
    if (tried.has(entry.url)) continue;
    tried.add(entry.url);

    if (!allowsMeta(entry, usedFingerprints)) continue;

    const urlSignals = urlHintSignals(entry.url);
    if (accepted.some((t) => clashes(urlSignals, t))) continue;

    const card = await scrapeOne(entry.url, sourceLabel);
    if (!card) continue;

    const signals = titleSignals(card.title);
    if (accepted.some((t) => clashes(signals, t))) continue;

    cards.push(card);
    accepted.push(signals);
    usedFingerprints.add(fingerprint(entry));
  }

  return cards;
}

async function readWeekCache(
  weekKey: string,
): Promise<FeaturedBySource | null> {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as FeaturedBySource;
    if (
      parsed?.version === CACHE_VERSION &&
      parsed?.weekKey === weekKey &&
      Array.isArray(parsed.goodFood) &&
      Array.isArray(parsed.bbcFood) &&
      (parsed.goodFood.length > 0 || parsed.bbcFood.length > 0)
    ) {
      return parsed;
    }
  } catch {
    // missing or invalid — rebuild
  }
  return null;
}

async function writeWeekCache(data: FeaturedBySource): Promise<void> {
  try {
    await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await fs.writeFile(CACHE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Could not persist featured week cache", err);
  }
}

async function buildFeaturedForWeek(weekKey: string): Promise<FeaturedBySource> {
  const week = weekIndex();
  const accepted: TitleSignals[] = [];
  const usedFingerprints = new Set<string>();

  const goodFood = await pickCards(
    GOOD_FOOD_POOL,
    2,
    "Good Food",
    week,
    0,
    accepted,
    usedFingerprints,
  );
  const bbcFood = await pickCards(
    BBC_FOOD_POOL,
    2,
    "BBC Food",
    week,
    2,
    accepted,
    usedFingerprints,
  );

  return {
    version: CACHE_VERSION,
    weekKey,
    goodFood,
    bbcFood,
  };
}

/**
 * Featured suggestions for Home — locked for the calendar week (Mon–Sun).
 * Persisted to disk so logins / refreshes reuse the same set until next Monday.
 */
export async function getFeaturedBySource(): Promise<FeaturedBySource> {
  const weekKey = featuredWeekKey();
  const cached = await readWeekCache(weekKey);
  if (cached) return cached;

  const fresh = await buildFeaturedForWeek(weekKey);
  await writeWeekCache(fresh);
  return fresh;
}

/** @deprecated use getFeaturedBySource */
export async function getFeaturedExternalRecipes(): Promise<FeaturedCard[]> {
  const { goodFood, bbcFood } = await getFeaturedBySource();
  return [...goodFood, ...bbcFood];
}
