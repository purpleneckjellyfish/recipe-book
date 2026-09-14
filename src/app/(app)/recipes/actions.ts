"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseIngredientsText } from "@/lib/ingredients";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/session";
import { slugify } from "@/lib/slug";

function parseSteps(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((body, sortOrder) => ({ body, sortOrder }));
}

function parseTags(formData: FormData) {
  const fromChecks = formData
    .getAll("tags")
    .map((t) => String(t).trim())
    .filter(Boolean);
  if (fromChecks.length) return [...new Set(fromChecks)];
  // backwards compatible with comma string
  return String(formData.get("tags") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function createRecipe(formData: FormData) {
  const { session, household } = await requireHousehold();

  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Title is required");

  const description = String(formData.get("description") || "").trim() || null;
  const servings = Number(formData.get("servings") || 4);
  const prepMinutes = Number(formData.get("prepMinutes") || 0) || null;
  const cookMinutes = Number(formData.get("cookMinutes") || 0) || null;
  const categoryId = String(formData.get("categoryId") || "") || null;
  const vegPortions = Number(formData.get("vegPortions") || 0) || null;
  const allowWeeklyRepeat = formData.get("allowWeeklyRepeat") === "on";
  const ingredients = parseIngredientsText(String(formData.get("ingredients") || ""));
  const steps = parseSteps(String(formData.get("steps") || ""));
  const tagNames = parseTags(formData);

  // Auto-fill type / tags / veg from AI when those fields were left blank
  let resolvedCategoryId = categoryId;
  let resolvedVeg = vegPortions;
  let resolvedTags = tagNames;
  if (
    process.env.IMPORT_API_KEY &&
    (!resolvedCategoryId || resolvedTags.length === 0 || resolvedVeg == null)
  ) {
    const { suggestRecipeMeta } = await import("@/lib/ai-import");
    const suggestion = await suggestRecipeMeta({
      title,
      description,
      prepMinutes,
      cookMinutes,
      ingredients: ingredients.map((i) => {
        const qty = i.quantity != null ? String(i.quantity) : "";
        const unit = i.unit || "";
        return [qty, unit, i.name].filter(Boolean).join(" ").trim();
      }),
      steps: steps.map((s) => s.body),
    });
    if (suggestion) {
      if (!resolvedCategoryId && suggestion.categoryGuess) {
        const cat = await prisma.category.findFirst({
          where: {
            householdId: household.id,
            OR: [
              {
                name: {
                  equals: suggestion.categoryGuess,
                  mode: "insensitive",
                },
              },
              { slug: slugify(suggestion.categoryGuess) },
            ],
          },
        });
        if (cat) resolvedCategoryId = cat.id;
      }
      if (resolvedTags.length === 0 && suggestion.tags.length) {
        resolvedTags = suggestion.tags;
      }
      if (resolvedVeg == null && suggestion.vegPortions != null) {
        resolvedVeg = suggestion.vegPortions;
      }
    }
  }

  const tagConnect = [];
  for (const name of resolvedTags) {
    const slug = slugify(name);
    const tag = await prisma.tag.upsert({
      where: {
        householdId_slug: { householdId: household.id, slug },
      },
      create: { householdId: household.id, name, slug },
      update: {},
    });
    tagConnect.push({ tagId: tag.id });
  }

  const recipe = await prisma.recipe.create({
    data: {
      householdId: household.id,
      createdById: session.user.id,
      title,
      description,
      servings: servings > 0 ? servings : 4,
      prepMinutes,
      cookMinutes,
      categoryId: resolvedCategoryId,
      vegPortions: resolvedVeg,
      allowWeeklyRepeat,
      ingredients: { create: ingredients },
      steps: { create: steps },
      tags: { create: tagConnect },
    },
  });

  revalidatePath("/library");
  redirect(`/recipes/${recipe.id}`);
}

export async function updateRecipe(recipeId: string, formData: FormData) {
  const { session, household } = await requireHousehold();

  const existing = await prisma.recipe.findFirst({
    where: { id: recipeId, householdId: household.id },
  });
  if (!existing) throw new Error("Recipe not found");

  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Title is required");

  const description = String(formData.get("description") || "").trim() || null;
  const servings = Number(formData.get("servings") || 4);
  const prepMinutes = Number(formData.get("prepMinutes") || 0) || null;
  const cookMinutes = Number(formData.get("cookMinutes") || 0) || null;
  const categoryId = String(formData.get("categoryId") || "") || null;
  const vegPortions = Number(formData.get("vegPortions") || 0) || null;
  const allowWeeklyRepeat = formData.get("allowWeeklyRepeat") === "on";
  const ingredients = parseIngredientsText(String(formData.get("ingredients") || ""));
  const steps = parseSteps(String(formData.get("steps") || ""));
  const tagNames = parseTags(formData);

  await prisma.recipeIngredient.deleteMany({ where: { recipeId } });
  await prisma.recipeStep.deleteMany({ where: { recipeId } });
  await prisma.recipeTag.deleteMany({ where: { recipeId } });

  const tagConnect = [];
  for (const name of tagNames) {
    const slug = slugify(name);
    const tag = await prisma.tag.upsert({
      where: {
        householdId_slug: { householdId: household.id, slug },
      },
      create: { householdId: household.id, name, slug },
      update: {},
    });
    tagConnect.push({ tagId: tag.id });
  }

  await prisma.recipe.update({
    where: { id: recipeId },
    data: {
      title,
      description,
      servings: servings > 0 ? servings : 4,
      prepMinutes,
      cookMinutes,
      categoryId,
      vegPortions,
      allowWeeklyRepeat,
      createdById: existing.createdById ?? session.user.id,
      ingredients: { create: ingredients },
      steps: { create: steps },
      tags: { create: tagConnect },
    },
  });

  revalidatePath("/library");
  revalidatePath(`/recipes/${recipeId}`);
  redirect(`/recipes/${recipeId}`);
}

export async function deleteRecipe(recipeId: string) {
  const { household } = await requireHousehold();
  await prisma.recipe.deleteMany({
    where: { id: recipeId, householdId: household.id },
  });
  revalidatePath("/library");
  redirect("/library");
}

export async function rateRecipe(recipeId: string, score: number) {
  const { session, household } = await requireHousehold();
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, householdId: household.id },
  });
  if (!recipe) throw new Error("Not found");
  const clamped = Math.min(5, Math.max(1, Math.round(score)));

  await prisma.recipeRating.upsert({
    where: {
      recipeId_userId: { recipeId, userId: session.user.id },
    },
    create: { recipeId, userId: session.user.id, score: clamped },
    update: { score: clamped },
  });

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/library");
}

export async function updateRecipeTags(recipeId: string, formData: FormData) {
  const { household } = await requireHousehold();
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, householdId: household.id },
  });
  if (!recipe) throw new Error("Recipe not found");

  const categoryRaw = String(formData.get("categoryId") || "");
  const categoryId = categoryRaw || null;
  if (categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: categoryId, householdId: household.id },
    });
    if (!cat) throw new Error("Category not found");
  }

  const tagNames = parseTags(formData);

  await prisma.recipeTag.deleteMany({ where: { recipeId } });

  for (const name of tagNames) {
    const slug = slugify(name);
    const tag = await prisma.tag.upsert({
      where: {
        householdId_slug: { householdId: household.id, slug },
      },
      create: { householdId: household.id, name, slug },
      update: {},
    });
    await prisma.recipeTag.create({
      data: { recipeId, tagId: tag.id },
    });
  }

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { categoryId },
  });

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath(`/recipes/${recipeId}/edit`);
  revalidatePath("/library");
  revalidatePath("/home");
}

/** AI reads the recipe and applies type, tags, and veg portions (excl. potatoes). */
export async function autoOrganiseRecipe(recipeId: string) {
  const draft = await suggestRecipeOrganisation(recipeId);
  await applyRecipeOrganisation(recipeId, {
    tags: draft.tags,
    categoryId: draft.categoryId,
    vegPortions: draft.vegPortions,
  });
  return draft;
}

/** AI-suggested tags / type / veg — returns values for the UI to review. */
export async function suggestRecipeOrganisation(recipeId: string) {
  const { household } = await requireHousehold();
  if (!process.env.IMPORT_API_KEY) {
    throw new Error(
      "AI suggestions need IMPORT_API_KEY in .env (OpenAI or Mistral).",
    );
  }
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, householdId: household.id },
    include: {
      ingredients: { orderBy: { sortOrder: "asc" } },
      steps: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!recipe) throw new Error("Recipe not found");

  const { suggestRecipeMeta } = await import("@/lib/ai-import");
  const suggestion = await suggestRecipeMeta({
    title: recipe.title,
    description: recipe.description,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    ingredients: recipe.ingredients.map((i) => {
      const qty = i.quantity != null ? String(i.quantity) : "";
      const unit = i.unit || "";
      return [qty, unit, i.name].filter(Boolean).join(" ").trim();
    }),
    steps: recipe.steps.map((s) => s.body),
  });
  if (!suggestion) throw new Error("Could not get suggestions right now");

  let categoryId: string | null = null;
  if (suggestion.categoryGuess) {
    const cat = await prisma.category.findFirst({
      where: {
        householdId: household.id,
        OR: [
          {
            name: { equals: suggestion.categoryGuess, mode: "insensitive" },
          },
          { slug: slugify(suggestion.categoryGuess) },
        ],
      },
    });
    categoryId = cat?.id ?? null;
  }

  return {
    tags: suggestion.tags,
    categoryId,
    categoryGuess: suggestion.categoryGuess,
    vegPortions: suggestion.vegPortions,
  };
}

/** Apply AI suggestions (tags + optional type + veg) after user confirms. */
export async function applyRecipeOrganisation(
  recipeId: string,
  opts: {
    tags: string[];
    categoryId?: string | null;
    vegPortions?: number | null;
  },
) {
  const { household } = await requireHousehold();
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, householdId: household.id },
  });
  if (!recipe) throw new Error("Recipe not found");

  if (opts.categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: opts.categoryId, householdId: household.id },
    });
    if (!cat) throw new Error("Category not found");
  }

  await prisma.recipeTag.deleteMany({ where: { recipeId } });
  for (const name of opts.tags) {
    const slug = slugify(name);
    const tag = await prisma.tag.upsert({
      where: {
        householdId_slug: { householdId: household.id, slug },
      },
      create: { householdId: household.id, name, slug },
      update: {},
    });
    await prisma.recipeTag.create({
      data: { recipeId, tagId: tag.id },
    });
  }

  await prisma.recipe.update({
    where: { id: recipeId },
    data: {
      ...(opts.categoryId !== undefined ? { categoryId: opts.categoryId } : {}),
      ...(opts.vegPortions !== undefined
        ? { vegPortions: opts.vegPortions }
        : {}),
    },
  });

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath(`/recipes/${recipeId}/edit`);
  revalidatePath("/library");
}

/** Re-run quantity/unit parsing on existing ingredient lines (fixes old imports). */
export async function reparseRecipeIngredients(recipeId: string) {
  const { household } = await requireHousehold();
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, householdId: household.id },
    include: { ingredients: { orderBy: { sortOrder: "asc" } } },
  });
  if (!recipe) throw new Error("Recipe not found");

  const { formatQuantity } = await import("@/lib/scale");

  const lines = recipe.ingredients.map((ing) => {
    if (ing.quantity != null) {
      const left = formatQuantity(Number(ing.quantity.toString()), ing.unit);
      return left ? `${left} ${ing.name}` : ing.name;
    }
    return ing.name;
  });

  const parsed = parseIngredientsText(lines.join("\n"));
  await prisma.recipeIngredient.deleteMany({ where: { recipeId } });
  await prisma.recipeIngredient.createMany({
    data: parsed.map((p) => ({
      recipeId,
      sortOrder: p.sortOrder,
      quantity: p.quantity,
      unit: p.unit,
      name: p.name,
    })),
  });

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath(`/recipes/${recipeId}/edit`);
}
