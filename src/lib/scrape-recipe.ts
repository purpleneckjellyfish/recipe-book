import * as cheerio from "cheerio";

export type ScrapedRecipe = {
  title: string;
  description: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: string[];
  steps: string[];
  imageUrl: string | null;
  sourceUrl: string;
};

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function parseDuration(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  // ISO8601 PT#H#M or plain "30 mins"
  const isoMatch = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (isoMatch) {
    return Number(isoMatch[1] || 0) * 60 + Number(isoMatch[2] || 0);
  }
  const plain = iso.match(/(\d+)\s*(hour|hr|h|minute|min|m)/i);
  if (plain) {
    const n = Number(plain[1]);
    const unit = plain[2].toLowerCase();
    if (unit.startsWith("h")) return n * 60;
    return n;
  }
  return null;
}

function parseServings(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseInt(v.replace(/[^\d].*$/, ""), 10);
    return Number.isFinite(n) ? n : null;
  }
  if (Array.isArray(v) && v.length) return parseServings(v[0]);
  return null;
}

function normalizeIngredient(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object" && "name" in (v as object)) {
    const o = v as { name?: string; amount?: string };
    return [o.amount, o.name].filter(Boolean).join(" ").trim();
  }
  return String(v || "").trim();
}

function normalizeStep(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object") {
    const o = v as { text?: string; name?: string; itemListElement?: unknown };
    if (o.itemListElement) {
      return asArray(o.itemListElement).map(normalizeStep).filter(Boolean).join("\n");
    }
    return String(o.text || o.name || "").trim();
  }
  return String(v || "").trim();
}

function absoluteUrl(maybe: string | null | undefined, base: string): string | null {
  if (!maybe) return null;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return null;
  }
}

function pickBestImage(image: unknown, baseUrl: string): string | null {
  if (!image) return null;
  if (typeof image === "string") return absoluteUrl(image, baseUrl);

  if (Array.isArray(image)) {
    // Prefer last / largest-looking entries often used by BBC
    const urls = image
      .map((item) => pickBestImage(item, baseUrl))
      .filter((u): u is string => !!u);
    return urls.sort((a, b) => b.length - a.length)[0] || null;
  }

  if (typeof image === "object") {
    const o = image as {
      url?: string | string[];
      contentUrl?: string;
      thumbnailUrl?: string;
      "@id"?: string;
    };
    return (
      pickBestImage(o.url, baseUrl) ||
      absoluteUrl(o.contentUrl, baseUrl) ||
      absoluteUrl(o.thumbnailUrl, baseUrl) ||
      absoluteUrl(o["@id"], baseUrl)
    );
  }
  return null;
}

function isBbcHost(hostname: string) {
  const h = hostname.toLowerCase();
  return (
    h === "bbc.co.uk" ||
    h.endsWith(".bbc.co.uk") ||
    h === "bbc.com" ||
    h.endsWith(".bbc.com") ||
    h === "bbcgoodfood.com" ||
    h.endsWith(".bbcgoodfood.com")
  );
}

function extractJsonLdRecipes(html: string): Record<string, unknown>[] {
  const $ = cheerio.load(html);
  const found: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    if (!raw?.trim()) return;
    try {
      const json = JSON.parse(raw);
      walkJsonLd(json, found);
    } catch {
      // Some pages concatenate multiple JSON objects; try a soft split
      const chunks = raw
        .replace(/}\s*{/g, "}\n{")
        .split("\n")
        .map((c) => c.trim())
        .filter(Boolean);
      for (const chunk of chunks) {
        try {
          walkJsonLd(JSON.parse(chunk), found);
        } catch {
          // ignore
        }
      }
    }
  });

  return found;
}

function walkJsonLd(node: unknown, out: Record<string, unknown>[]) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, out);
    return;
  }
  if (typeof node !== "object") return;

  const obj = node as Record<string, unknown>;
  if (obj["@graph"]) walkJsonLd(obj["@graph"], out);

  const types = asArray(obj["@type"]).map(String);
  if (types.some((t) => t.toLowerCase() === "recipe")) {
    out.push(obj);
  }

  // Nested mainEntity / about sometimes used by BBC
  if (obj.mainEntity) walkJsonLd(obj.mainEntity, out);
  if (obj.about) walkJsonLd(obj.about, out);
}

function fromJsonLd(node: Record<string, unknown>, sourceUrl: string): ScrapedRecipe {
  const ingredients = asArray(node.recipeIngredient)
    .map(normalizeIngredient)
    .filter(Boolean);

  const instructions = asArray(node.recipeInstructions)
    .flatMap((ins) => {
      if (ins && typeof ins === "object" && "itemListElement" in (ins as object)) {
        return asArray((ins as { itemListElement: unknown }).itemListElement).map(
          normalizeStep,
        );
      }
      const step = normalizeStep(ins);
      return step.includes("\n") ? step.split("\n") : [step];
    })
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    title: String(node.name || "Imported recipe"),
    description: node.description ? String(node.description) : null,
    servings: parseServings(node.recipeYield ?? node.yield),
    prepMinutes: parseDuration(node.prepTime),
    cookMinutes: parseDuration(node.cookTime),
    ingredients,
    steps: instructions,
    imageUrl: pickBestImage(node.image, sourceUrl),
    sourceUrl,
  };
}

function scrapeBbcDom(html: string, sourceUrl: string): ScrapedRecipe | null {
  const $ = cheerio.load(html);

  const title =
    $('[data-testid="recipe-title"], h1.gel-trafalgar, h1').first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    "";

  const ingredients: string[] = [];
  $(
    '[class*="ingredient-list"] li, [data-testid*="ingredient"] li, .recipe-ingredients__list li, ul[class*="ingredients"] li, [itemprop="recipeIngredient"]',
  ).each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t && t.length < 220) ingredients.push(t);
  });

  const steps: string[] = [];
  $(
    '[class*="method-step"] , [data-testid*="method"] li, .recipe-method__list li, ol[class*="method"] li, [itemprop="recipeInstructions"] li, [itemprop="recipeInstructions"] p',
  ).each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t && t.length > 2) steps.push(t);
  });

  if (!ingredients.length && !steps.length) return null;

  const imageUrl =
    absoluteUrl($('meta[property="og:image"]').attr("content"), sourceUrl) ||
    absoluteUrl($('meta[name="twitter:image"]').attr("content"), sourceUrl) ||
    absoluteUrl(
      $("img[itemprop='image'], .recipe-media img, picture source").first().attr("src") ||
        $("img[itemprop='image'], .recipe-media img").first().attr("data-src") ||
        $("picture source").first().attr("srcset")?.split(/\s+/)[0],
      sourceUrl,
    );

  const servingsText =
    $('[class*="serves"], [data-testid*="serving"]').first().text() ||
    $('[itemprop="recipeYield"]').text();

  return {
    title: title || "Imported recipe",
    description:
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      null,
    servings: parseServings(servingsText),
    prepMinutes: parseDuration(
      $('[itemprop="prepTime"]').attr("content") ||
        $('[class*="prep-time"]').first().text(),
    ),
    cookMinutes: parseDuration(
      $('[itemprop="cookTime"]').attr("content") ||
        $('[class*="cook-time"]').first().text(),
    ),
    ingredients: [...new Set(ingredients)].slice(0, 100),
    steps: [...new Set(steps)].slice(0, 60),
    imageUrl,
    sourceUrl,
  };
}

function heuristicScrape(html: string, sourceUrl: string): ScrapedRecipe {
  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text() ||
    $("title").text() ||
    "Imported recipe";

  const ingredients: string[] = [];
  $('[class*="ingredient"], [itemprop="recipeIngredient"]').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t && t.length < 200) ingredients.push(t);
  });

  const steps: string[] = [];
  $(
    '[class*="method"] li, [class*="instruction"] li, [itemprop="recipeInstructions"]',
  ).each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t) steps.push(t);
  });

  const imageUrl =
    absoluteUrl($('meta[property="og:image"]').attr("content"), sourceUrl) ||
    absoluteUrl($('meta[name="twitter:image"]').attr("content"), sourceUrl) ||
    absoluteUrl($('img[itemprop="image"]').attr("src"), sourceUrl);

  return {
    title: title.trim(),
    description:
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      null,
    servings: null,
    prepMinutes: null,
    cookMinutes: null,
    ingredients: [...new Set(ingredients)].slice(0, 80),
    steps: steps.slice(0, 40),
    imageUrl,
    sourceUrl,
  };
}

function enrichImage(recipe: ScrapedRecipe, html: string): ScrapedRecipe {
  if (recipe.imageUrl) return recipe;
  const $ = cheerio.load(html);
  const fallback =
    absoluteUrl($('meta[property="og:image"]').attr("content"), recipe.sourceUrl) ||
    absoluteUrl($('meta[name="twitter:image"]').attr("content"), recipe.sourceUrl);
  return { ...recipe, imageUrl: fallback };
}

export async function scrapeRecipeFromUrl(url: string): Promise<ScrapedRecipe> {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("That doesn’t look like a valid URL");
  }

  const bbc = isBbcHost(parsed.hostname);

  const res = await fetch(parsed.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
      Referer: bbc ? "https://www.bbc.co.uk/" : parsed.origin + "/",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(25000),
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Could not fetch URL (${res.status}). BBC pages sometimes block bots — try again or paste another link.`);
  }

  const html = await res.text();
  const recipes = extractJsonLdRecipes(html);

  // Prefer the richest Recipe node (most ingredients)
  const preferred = [...recipes].sort((a, b) => {
    const ai = asArray(a.recipeIngredient).length;
    const bi = asArray(b.recipeIngredient).length;
    return bi - ai;
  })[0];

  if (
    preferred &&
    (asArray(preferred.recipeIngredient).length ||
      asArray(preferred.recipeInstructions).length)
  ) {
    return enrichImage(fromJsonLd(preferred, parsed.toString()), html);
  }

  if (bbc) {
    const bbcRecipe = scrapeBbcDom(html, parsed.toString());
    if (bbcRecipe && (bbcRecipe.ingredients.length || bbcRecipe.steps.length)) {
      return enrichImage(bbcRecipe, html);
    }
  }

  const fallback = enrichImage(heuristicScrape(html, parsed.toString()), html);
  if (!fallback.ingredients.length && !fallback.steps.length) {
    throw new Error(
      "Could not extract a recipe from that page. Try another URL or add it manually.",
    );
  }
  return fallback;
}
