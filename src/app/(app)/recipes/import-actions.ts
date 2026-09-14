"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { extractRecipeFromImage, suggestRecipeMeta } from "@/lib/ai-import";
import { parseIngredientsText } from "@/lib/ingredients";
import { prisma } from "@/lib/prisma";
import { scrapeRecipeFromUrl } from "@/lib/scrape-recipe";
import { requireHousehold } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { storeRemoteImage } from "@/lib/uploads";

export type ImportDraft = {
  title: string;
  description: string;
  servings: number;
  prepMinutes: string;
  cookMinutes: string;
  ingredients: string;
  steps: string;
  tags: string;
  vegPortions: string;
  categoryId: string;
  sourceUrl: string;
  imageUrl: string;
  suggestedTags: string[];
};

export async function importFromUrl(url: string): Promise<ImportDraft> {
  await requireHousehold();
  const scraped = await scrapeRecipeFromUrl(url.trim());
  const suggestion = await suggestRecipeMeta({
    title: scraped.title,
    ingredients: scraped.ingredients,
    steps: scraped.steps,
    description: scraped.description,
    prepMinutes: scraped.prepMinutes,
    cookMinutes: scraped.cookMinutes,
  });

  const { household } = await requireHousehold();
  let categoryId = "";
  if (suggestion?.categoryGuess) {
    const cat = await prisma.category.findFirst({
      where: {
        householdId: household.id,
        OR: [
          { name: { equals: suggestion.categoryGuess, mode: "insensitive" } },
          { slug: slugify(suggestion.categoryGuess) },
        ],
      },
    });
    categoryId = cat?.id || "";
  }

  const tags = suggestion?.tags || [];
  return {
    title: scraped.title,
    description: scraped.description || "",
    servings: scraped.servings || 4,
    prepMinutes: scraped.prepMinutes?.toString() || "",
    cookMinutes: scraped.cookMinutes?.toString() || "",
    ingredients: scraped.ingredients.join("\n"),
    steps: scraped.steps.join("\n"),
    tags: tags.join(", "),
    vegPortions: suggestion?.vegPortions?.toString() || "",
    categoryId,
    sourceUrl: scraped.sourceUrl,
    imageUrl: scraped.imageUrl || "",
    suggestedTags: tags,
  };
}

export async function importFromPhoto(formData: FormData): Promise<ImportDraft> {
  await requireHousehold();
  const file = formData.get("photo");
  if (!(file instanceof File)) throw new Error("No photo uploaded");

  const buffer = Buffer.from(await file.arrayBuffer());
  const extracted = await extractRecipeFromImage(
    buffer.toString("base64"),
    file.type || "image/jpeg",
  );
  if (!extracted) throw new Error("Could not read recipe from photo");

  const { household } = await requireHousehold();
  let categoryId = "";
  if (extracted.categoryGuess) {
    const cat = await prisma.category.findFirst({
      where: {
        householdId: household.id,
        OR: [
          { name: { equals: extracted.categoryGuess, mode: "insensitive" } },
          { slug: slugify(extracted.categoryGuess) },
        ],
      },
    });
    categoryId = cat?.id || "";
  }

  const tags = extracted.tags || [];
  return {
    title: extracted.title || "Imported recipe",
    description: extracted.description || "",
    servings: extracted.servings || 4,
    prepMinutes: extracted.prepMinutes?.toString() || "",
    cookMinutes: extracted.cookMinutes?.toString() || "",
    ingredients: (extracted.ingredients || []).join("\n"),
    steps: (extracted.steps || []).join("\n"),
    tags: tags.join(", "),
    vegPortions: extracted.vegPortions?.toString() || "",
    categoryId,
    sourceUrl: "",
    imageUrl: "",
    suggestedTags: tags,
  };
}

export async function saveImportDraft(formData: FormData) {
  const { session, household } = await requireHousehold();
  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Title required");

  const tagNames = [
    ...new Set(
      formData
        .getAll("tags")
        .map((t) => String(t).trim())
        .filter(Boolean),
    ),
  ];
  if (tagNames.length === 0) {
    const legacy = String(formData.get("tags") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    tagNames.push(...legacy);
  }

  const tagConnect = [];
  for (const name of tagNames) {
    const slug = slugify(name);
    const tag = await prisma.tag.upsert({
      where: { householdId_slug: { householdId: household.id, slug } },
      create: { householdId: household.id, name, slug },
      update: {},
    });
    tagConnect.push({ tagId: tag.id });
  }

  const ingredients = parseIngredientsText(String(formData.get("ingredients") || ""));
  const steps = String(formData.get("steps") || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((body, sortOrder) => ({ body, sortOrder }));

  const recipe = await prisma.recipe.create({
    data: {
      householdId: household.id,
      createdById: session.user.id,
      title,
      description: String(formData.get("description") || "").trim() || null,
      servings: Number(formData.get("servings") || 4) || 4,
      prepMinutes: Number(formData.get("prepMinutes") || 0) || null,
      cookMinutes: Number(formData.get("cookMinutes") || 0) || null,
      categoryId: String(formData.get("categoryId") || "") || null,
      vegPortions: Number(formData.get("vegPortions") || 0) || null,
      sourceUrl: String(formData.get("sourceUrl") || "").trim() || null,
      ingredients: { create: ingredients },
      steps: { create: steps },
      tags: { create: tagConnect },
    },
  });

  const imageUrl = String(formData.get("imageUrl") || "").trim();
  if (imageUrl) {
    const stored = await storeRemoteImage(recipe.id, imageUrl);
    if (stored) {
      await prisma.recipeImage.create({
        data: { recipeId: recipe.id, path: stored, sortOrder: 0 },
      });
    }
  }

  revalidatePath("/library");
  redirect(`/recipes/${recipe.id}`);
}

export async function suggestTagsForRecipe(recipeId: string) {
  const { household } = await requireHousehold();
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, householdId: household.id },
    include: {
      ingredients: true,
      steps: true,
    },
  });
  if (!recipe) throw new Error("Not found");

  const suggestion = await suggestRecipeMeta({
    title: recipe.title,
    description: recipe.description,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    ingredients: recipe.ingredients.map((i) =>
      [i.quantity?.toString(), i.unit, i.name].filter(Boolean).join(" "),
    ),
    steps: recipe.steps.map((s) => s.body),
  });

  return suggestion;
}
