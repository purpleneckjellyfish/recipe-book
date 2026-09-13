"use server";

import { revalidatePath } from "next/cache";
import { MealSlotStatus } from "@prisma/client";
import {
  addDays,
  formatDateOnly,
  parseDateOnly,
  startOfWeek,
} from "@/lib/dates";
import { parseIngredientsText } from "@/lib/ingredients";
import { prisma } from "@/lib/prisma";
import { scrapeRecipeFromUrl } from "@/lib/scrape-recipe";
import { requireHousehold } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { storeRemoteImage } from "@/lib/uploads";

async function importUrlToArchive(sourceUrl: string) {
  const { session, household } = await requireHousehold();

  const existing = await prisma.recipe.findFirst({
    where: { householdId: household.id, sourceUrl },
  });
  if (existing) return existing;

  const scraped = await scrapeRecipeFromUrl(sourceUrl);
  const ingredients = parseIngredientsText(scraped.ingredients.join("\n"));
  const steps = scraped.steps.map((body, sortOrder) => ({ body, sortOrder }));

  const recipe = await prisma.recipe.create({
    data: {
      householdId: household.id,
      createdById: session.user.id,
      title: scraped.title,
      description: scraped.description,
      servings: scraped.servings || 4,
      prepMinutes: scraped.prepMinutes,
      cookMinutes: scraped.cookMinutes,
      sourceUrl: scraped.sourceUrl,
      ingredients: { create: ingredients },
      steps: { create: steps },
    },
  });

  if (scraped.imageUrl) {
    const path = await storeRemoteImage(recipe.id, scraped.imageUrl);
    if (path) {
      await prisma.recipeImage.create({
        data: { recipeId: recipe.id, path, sortOrder: 0 },
      });
    }
  }

  return recipe;
}

export async function addFeaturedToArchive(sourceUrl: string) {
  const recipe = await importUrlToArchive(sourceUrl);
  revalidatePath("/library");
  revalidatePath("/home");
  return recipe.id;
}

export async function pinFeaturedToNextWeek(sourceUrl: string, dateIso: string) {
  const { household } = await requireHousehold();
  const recipe = await importUrlToArchive(sourceUrl);

  const date = parseDateOnly(dateIso);
  const weekStart = startOfWeek(date, household.weekStart);

  let plan = await prisma.mealPlan.findUnique({
    where: { householdId_weekStart: { householdId: household.id, weekStart } },
    include: { slots: true },
  });

  const mealType = await prisma.mealType.findFirst({
    where: { householdId: household.id, enabled: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!mealType) throw new Error("No meal type configured");

  if (!plan) {
    const { weekDates } = await import("@/lib/dates");
    plan = await prisma.mealPlan.create({
      data: {
        householdId: household.id,
        weekStart,
        slots: {
          create: weekDates(weekStart).map((d) => ({
            date: d,
            mealTypeId: mealType.id,
            status: MealSlotStatus.RECIPE,
          })),
        },
      },
      include: { slots: true },
    });
  }

  const slot = plan.slots.find(
    (s) =>
      formatDateOnly(s.date) === formatDateOnly(date) &&
      s.mealTypeId === mealType.id,
  );
  if (!slot) throw new Error("No slot for that day");

  await prisma.mealPlanSlot.update({
    where: { id: slot.id },
    data: {
      recipeId: recipe.id,
      status: MealSlotStatus.RECIPE,
      pinned: true,
      cookSlotId: null,
    },
  });

  revalidatePath("/library");
  revalidatePath("/home");
  revalidatePath("/plan");
  return { recipeId: recipe.id, weekStart: formatDateOnly(weekStart) };
}

export async function pinArchiveRecipeToDate(recipeId: string, dateIso: string) {
  const { household } = await requireHousehold();
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, householdId: household.id },
  });
  if (!recipe) throw new Error("Recipe not found");

  const date = parseDateOnly(dateIso);
  const weekStart = startOfWeek(date, household.weekStart);

  const mealType = await prisma.mealType.findFirst({
    where: { householdId: household.id, enabled: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!mealType) throw new Error("No meal type configured");

  let plan = await prisma.mealPlan.findUnique({
    where: { householdId_weekStart: { householdId: household.id, weekStart } },
    include: { slots: true },
  });

  if (!plan) {
    const { weekDates } = await import("@/lib/dates");
    plan = await prisma.mealPlan.create({
      data: {
        householdId: household.id,
        weekStart,
        slots: {
          create: weekDates(weekStart).map((d) => ({
            date: d,
            mealTypeId: mealType.id,
            status: MealSlotStatus.RECIPE,
          })),
        },
      },
      include: { slots: true },
    });
  }

  const slot = plan.slots.find(
    (s) =>
      formatDateOnly(s.date) === formatDateOnly(date) &&
      s.mealTypeId === mealType.id,
  );
  if (!slot) throw new Error("No slot for that day");

  await prisma.mealPlanSlot.update({
    where: { id: slot.id },
    data: {
      recipeId: recipe.id,
      status: MealSlotStatus.RECIPE,
      pinned: true,
      cookSlotId: null,
    },
  });

  revalidatePath("/home");
  revalidatePath("/plan");
  return { weekStart: formatDateOnly(weekStart) };
}

export async function addRecipeToTry(recipeId: string) {
  const { household } = await requireHousehold();
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, householdId: household.id },
  });
  if (!recipe) throw new Error("Recipe not found");

  await prisma.toTryItem.upsert({
    where: {
      householdId_recipeId: { householdId: household.id, recipeId },
    },
    create: { householdId: household.id, recipeId },
    update: {},
  });

  revalidatePath("/home");
  return { ok: true as const };
}

export async function addFeaturedToTry(sourceUrl: string) {
  const recipe = await importUrlToArchive(sourceUrl);
  await addRecipeToTry(recipe.id);
  revalidatePath("/library");
  revalidatePath("/home");
  return recipe.id;
}

export async function removeFromTry(recipeId: string) {
  const { household } = await requireHousehold();
  await prisma.toTryItem.deleteMany({
    where: { householdId: household.id, recipeId },
  });
  revalidatePath("/home");
}
