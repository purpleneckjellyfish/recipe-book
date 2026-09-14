export type AiSuggestion = {
  tags: string[];
  categoryGuess: string | null;
  vegPortions: number | null;
  title?: string;
  description?: string | null;
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  ingredients?: string[];
  steps?: string[];
};

/** Controlled vocabulary — keeps household filters consistent. */
export const CANONICAL_TAGS = [
  "vegetarian",
  "vegan",
  "fish",
  "chicken",
  "meat",
  "batch cooking",
  "speedy",
  "packups",
  "freezer friendly",
  "entertaining",
  "one pot",
  "slow cooker",
  "pasta",
  "curry",
  "salad",
  "soup",
  "baking",
  "comfort food",
  "healthy",
  "kid friendly",
] as const;

const SYSTEM = `You organise recipes for a UK household app called Recipe Book.
Return ONLY valid JSON. No markdown.

TAGS — use ONLY labels from this list (lowercase). Pick 2–6 that clearly fit; skip weak guesses:
${CANONICAL_TAGS.join(", ")}.
Do not invent new tags. Prefer dietary + cooking-style tags that help meal planning.
"speedy" ONLY when prepMinutes + cookMinutes is under 20 combined. Never tag speedy if times are missing or total is 20+.

VEG PORTIONS (vegPortions) — integer 0–5 for ONE typical adult serving toward UK 5-a-day:
- Count vegetables and fruit only.
- EXCLUDE potatoes, sweet potatoes, yams, chips, fries, mash from potato, and crisps.
- Beans/pulses and salad leaves count; herbs in tiny amounts do not.
- Estimate portions the eater gets in one serving (not the whole pan).

categoryGuess one of: Main, Breakfast, Soup, Side, Dessert, Cakes & bakes, Preserves, Sauces & condiments, Drinks, Snack, or null.`;

function apiConfig() {
  const key = process.env.IMPORT_API_KEY;
  const base = (process.env.IMPORT_API_BASE || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  return { key, base };
}

async function chatCompletions(body: Record<string, unknown>, timeoutMs: number) {
  const { key, base } = apiConfig();
  if (!key) return null;

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("AI chat failed", res.status, text);
    throw new Error(`AI API error (${res.status})`);
  }

  return res.json();
}

const CANONICAL_LOOKUP = new Map(
  CANONICAL_TAGS.map((t) => [t.toLowerCase(), t as string]),
);

/** Map free-text AI tags onto the household vocabulary. */
export function normalizeSuggestedTags(raw: string[]): string[] {
  const aliases: Record<string, string> = {
    veggie: "vegetarian",
    veg: "vegetarian",
    "plant based": "vegan",
    seafood: "fish",
    salmon: "fish",
    quick: "speedy",
    fast: "speedy",
    lunchbox: "packups",
    "lunch box": "packups",
    "meal prep": "batch cooking",
    batch: "batch cooking",
    freeze: "freezer friendly",
    "freezable": "freezer friendly",
    guests: "entertaining",
    party: "entertaining",
    "one-pot": "one pot",
    onepot: "one pot",
    "slow-cooker": "slow cooker",
    crockpot: "slow cooker",
    kids: "kid friendly",
    children: "kid friendly",
    "comfort": "comfort food",
  };

  const out = new Set<string>();
  for (const item of raw) {
    const key = item.trim().toLowerCase().replace(/\s+/g, " ");
    if (!key) continue;
    const mapped = aliases[key] || CANONICAL_LOOKUP.get(key);
    if (mapped) out.add(mapped);
  }
  return [...out];
}

/** Speedy = prep + cook under 20 minutes; drop it otherwise (or if times unknown). */
export function applySpeedyTagRule(
  tags: string[],
  prepMinutes?: number | null,
  cookMinutes?: number | null,
): string[] {
  const hasPrep = prepMinutes != null && Number.isFinite(prepMinutes);
  const hasCook = cookMinutes != null && Number.isFinite(cookMinutes);
  if (!hasPrep && !hasCook) {
    return tags.filter((t) => t !== "speedy");
  }
  const total = (hasPrep ? Number(prepMinutes) : 0) + (hasCook ? Number(cookMinutes) : 0);
  if (total >= 20) {
    return tags.filter((t) => t !== "speedy");
  }
  return tags;
}

function parseMeta(
  parsed: Record<string, unknown>,
  times?: { prepMinutes?: number | null; cookMinutes?: number | null },
): AiSuggestion {
  const rawTags = Array.isArray(parsed.tags) ? parsed.tags.map(String) : [];
  const prep =
    times?.prepMinutes ??
    (typeof parsed.prepMinutes === "number" ? parsed.prepMinutes : null);
  const cook =
    times?.cookMinutes ??
    (typeof parsed.cookMinutes === "number" ? parsed.cookMinutes : null);
  return {
    tags: applySpeedyTagRule(normalizeSuggestedTags(rawTags), prep, cook),
    categoryGuess: parsed.categoryGuess ? String(parsed.categoryGuess) : null,
    vegPortions:
      typeof parsed.vegPortions === "number"
        ? Math.min(5, Math.max(0, Math.round(parsed.vegPortions)))
        : null,
  };
}

export function isImportAiConfigured() {
  return !!process.env.IMPORT_API_KEY;
}

export async function suggestRecipeMeta(input: {
  title: string;
  ingredients: string[];
  steps: string[];
  description?: string | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
}): Promise<AiSuggestion | null> {
  if (!apiConfig().key) return null;

  try {
    const json = await chatCompletions(
      {
        model: process.env.IMPORT_MODEL || "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: JSON.stringify({
              task: "suggest_tags_and_veg",
              recipe: input,
              allowedTags: CANONICAL_TAGS,
              rules: {
                vegPortions:
                  "0-5 per serving; exclude all potatoes/sweet potatoes",
                speedy:
                  "only if prepMinutes + cookMinutes is under 20 combined",
              },
              schema: {
                tags: ["string — only from allowedTags"],
                categoryGuess: "string|null",
                vegPortions: "number|null",
              },
            }),
          },
        ],
      },
      45000,
    );
    if (!json) return null;
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseMeta(JSON.parse(content), {
      prepMinutes: input.prepMinutes,
      cookMinutes: input.cookMinutes,
    });
  } catch (err) {
    console.error("AI suggest failed", err);
    return null;
  }
}

export async function extractRecipeFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<AiSuggestion | null> {
  if (!apiConfig().key) {
    throw new Error(
      "IMPORT_API_KEY is not set. Add it to .env to enable photo import.",
    );
  }

  const json = await chatCompletions(
    {
      model: process.env.IMPORT_VISION_MODEL || process.env.IMPORT_MODEL || "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract this recipe photo into JSON with keys:
title, description, servings, prepMinutes, cookMinutes, ingredients (string array), steps (string array), tags (only from: ${CANONICAL_TAGS.join(", ")}), categoryGuess, vegPortions (exclude potatoes).`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    },
    90000,
  );

  if (!json) return null;
  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;
  const parsed = JSON.parse(content);
  const prepMinutes =
    typeof parsed.prepMinutes === "number" ? parsed.prepMinutes : null;
  const cookMinutes =
    typeof parsed.cookMinutes === "number" ? parsed.cookMinutes : null;
  return {
    ...parseMeta(parsed, { prepMinutes, cookMinutes }),
    title: parsed.title ? String(parsed.title) : "Imported recipe",
    description: parsed.description ? String(parsed.description) : null,
    servings: typeof parsed.servings === "number" ? parsed.servings : null,
    prepMinutes,
    cookMinutes,
    ingredients: Array.isArray(parsed.ingredients)
      ? parsed.ingredients.map(String)
      : [],
    steps: Array.isArray(parsed.steps) ? parsed.steps.map(String) : [],
  };
}
