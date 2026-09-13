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

const SYSTEM = `You help organise home cooking recipes for a UK household app called Recipe Book.
Return ONLY valid JSON. No markdown.
For tags prefer short practical labels: batch cooking, speedy, packups, entertaining, vegetarian, fish, vegan, freezer friendly.
vegPortions is an integer 0-5 estimating vegetable/fruit portions toward UK 5-a-day for one typical serving.
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

function parseMeta(parsed: Record<string, unknown>): AiSuggestion {
  return {
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
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
}): Promise<AiSuggestion | null> {
  if (!apiConfig().key) return null;

  try {
    const json = await chatCompletions(
      {
        model: process.env.IMPORT_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: JSON.stringify({
              task: "suggest_tags_and_veg",
              recipe: input,
              schema: {
                tags: ["string"],
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
    return parseMeta(JSON.parse(content));
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
title, description, servings, prepMinutes, cookMinutes, ingredients (string array), steps (string array), tags (string array), categoryGuess, vegPortions.`,
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
  return {
    ...parseMeta(parsed),
    title: parsed.title ? String(parsed.title) : "Imported recipe",
    description: parsed.description ? String(parsed.description) : null,
    servings: typeof parsed.servings === "number" ? parsed.servings : null,
    prepMinutes: typeof parsed.prepMinutes === "number" ? parsed.prepMinutes : null,
    cookMinutes: typeof parsed.cookMinutes === "number" ? parsed.cookMinutes : null,
    ingredients: Array.isArray(parsed.ingredients)
      ? parsed.ingredients.map(String)
      : [],
    steps: Array.isArray(parsed.steps) ? parsed.steps.map(String) : [],
  };
}
