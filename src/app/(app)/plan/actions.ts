"use server";

import { revalidatePath } from "next/cache";
import { MealSlotStatus } from "@prisma/client";
import {
  addDays,
  formatDateOnly,
  parseDateOnly,
  startOfWeek,
  toDateOnly,
  weekDates,
} from "@/lib/dates";
import { autoFillRecipes, type FillConstraints } from "@/lib/meal-fill";
import { PLANNING_CATEGORY_SLUGS } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/session";

async function getOrCreatePlan(householdId: string, weekStart: Date) {
  const mealTypes = await prisma.mealType.findMany({
    where: { householdId, enabled: true },
    orderBy: { sortOrder: "asc" },
  });

  let plan = await prisma.mealPlan.findUnique({
    where: {
      householdId_weekStart: { householdId, weekStart },
    },
    include: {
      slots: {
        include: {
          recipe: { include: { tags: { include: { tag: true } }, category: true } },
          mealType: true,
        },
      },
    },
  });

  if (!plan) {
    plan = await prisma.mealPlan.create({
      data: {
        householdId,
        weekStart,
        slots: {
          create: weekDates(weekStart).flatMap((date) =>
            mealTypes.map((mt) => ({
              date,
              mealTypeId: mt.id,
              status: MealSlotStatus.RECIPE,
            })),
          ),
        },
      },
      include: {
        slots: {
          include: {
            recipe: { include: { tags: { include: { tag: true } }, category: true } },
            mealType: true,
          },
        },
      },
    });
  } else {
    // Ensure slots exist for newly enabled meal types
    for (const date of weekDates(weekStart)) {
      for (const mt of mealTypes) {
        const exists = plan.slots.some(
          (s) =>
            formatDateOnly(s.date) === formatDateOnly(date) &&
            s.mealTypeId === mt.id,
        );
        if (!exists) {
          await prisma.mealPlanSlot.create({
            data: {
              mealPlanId: plan.id,
              date,
              mealTypeId: mt.id,
              status: MealSlotStatus.RECIPE,
            },
          });
        }
      }
    }
    plan = await prisma.mealPlan.findUniqueOrThrow({
      where: { id: plan.id },
      include: {
        slots: {
          include: {
            recipe: { include: { tags: { include: { tag: true } }, category: true } },
            mealType: true,
          },
        },
      },
    });
  }

  return { plan, mealTypes };
}

export async function loadWeekPlan(weekStartIso?: string) {
  const { household } = await requireHousehold();
  const weekStart = weekStartIso
    ? startOfWeek(parseDateOnly(weekStartIso), household.weekStart)
    : startOfWeek(toDateOnly(new Date()), household.weekStart);

  const { plan, mealTypes } = await getOrCreatePlan(household.id, weekStart);
  const recipes = await prisma.recipe.findMany({
    where: {
      householdId: household.id,
      category: { slug: { in: [...PLANNING_CATEGORY_SLUGS] } },
    },
    include: {
      category: true,
      tags: { include: { tag: true } },
      ratings: true,
    },
    orderBy: { title: "asc" },
  });

  return {
    weekStart: formatDateOnly(weekStart),
    plan,
    mealTypes,
    recipes,
    householdWeekStart: household.weekStart,
  };
}

export async function setSlotRecipe(opts: {
  slotId: string;
  recipeId: string | null;
  pinned?: boolean;
  servings?: number | null;
}) {
  const { household } = await requireHousehold();
  const slot = await prisma.mealPlanSlot.findFirst({
    where: { id: opts.slotId, mealPlan: { householdId: household.id } },
  });
  if (!slot) throw new Error("Slot not found");

  await prisma.mealPlanSlot.update({
    where: { id: slot.id },
    data: {
      recipeId: opts.recipeId,
      notes: opts.recipeId ? null : slot.notes,
      status: opts.recipeId
        ? MealSlotStatus.RECIPE
        : slot.status === MealSlotStatus.SKIP
          ? MealSlotStatus.SKIP
          : MealSlotStatus.RECIPE,
      pinned: opts.pinned ?? slot.pinned,
      servings: opts.servings ?? slot.servings,
      cookSlotId: null,
    },
  });

  // Clear leftover children pointing at this slot if recipe cleared
  if (!opts.recipeId) {
    await prisma.mealPlanSlot.updateMany({
      where: { cookSlotId: slot.id },
      data: {
        recipeId: null,
        status: MealSlotStatus.RECIPE,
        cookSlotId: null,
        notes: null,
      },
    });
  }

  revalidatePath("/plan");
  revalidatePath("/shop");
}

/** Free-text meal on the plan (e.g. pasta, jacket potatoes) — not a library recipe. */
export async function setSlotNote(opts: { slotId: string; note: string }) {
  const { household } = await requireHousehold();
  const slot = await prisma.mealPlanSlot.findFirst({
    where: { id: opts.slotId, mealPlan: { householdId: household.id } },
  });
  if (!slot) throw new Error("Slot not found");

  const note = opts.note.trim().replace(/\s+/g, " ");
  if (!note) {
    await prisma.mealPlanSlot.update({
      where: { id: slot.id },
      data: {
        notes: null,
        recipeId: null,
        cookSlotId: null,
        status: MealSlotStatus.RECIPE,
        pinned: false,
      },
    });
  } else {
    await prisma.mealPlanSlot.update({
      where: { id: slot.id },
      data: {
        notes: note,
        recipeId: null,
        cookSlotId: null,
        status: MealSlotStatus.RECIPE,
        pinned: true,
        servings: null,
      },
    });
    await prisma.mealPlanSlot.updateMany({
      where: { cookSlotId: slot.id },
      data: {
        recipeId: null,
        status: MealSlotStatus.RECIPE,
        cookSlotId: null,
        notes: null,
      },
    });
  }

  revalidatePath("/plan");
  revalidatePath("/home");
}

export async function setSlotStatus(opts: {
  slotId: string;
  status: "RECIPE" | "SKIP" | "LEFTOVER";
}) {
  const { household } = await requireHousehold();
  const slot = await prisma.mealPlanSlot.findFirst({
    where: { id: opts.slotId, mealPlan: { householdId: household.id } },
  });
  if (!slot) throw new Error("Slot not found");

  await prisma.mealPlanSlot.update({
    where: { id: slot.id },
    data: {
      status: opts.status,
      recipeId: opts.status === "SKIP" ? null : slot.recipeId,
      cookSlotId: opts.status === "LEFTOVER" ? slot.cookSlotId : null,
      pinned: opts.status === "SKIP" ? true : slot.pinned,
    },
  });

  revalidatePath("/plan");
  revalidatePath("/shop");
}

export async function togglePin(slotId: string) {
  const { household } = await requireHousehold();
  const slot = await prisma.mealPlanSlot.findFirst({
    where: { id: slotId, mealPlan: { householdId: household.id } },
  });
  if (!slot) throw new Error("Slot not found");
  await prisma.mealPlanSlot.update({
    where: { id: slot.id },
    data: { pinned: !slot.pinned },
  });
  revalidatePath("/plan");
}

export async function markBatchCovers(opts: {
  cookSlotId: string;
  leftoverSlotIds: string[];
}) {
  const { household } = await requireHousehold();
  const cook = await prisma.mealPlanSlot.findFirst({
    where: { id: opts.cookSlotId, mealPlan: { householdId: household.id } },
    include: { recipe: true },
  });
  if (!cook?.recipeId) throw new Error("Cook slot needs a recipe");

  for (const id of opts.leftoverSlotIds) {
    await prisma.mealPlanSlot.updateMany({
      where: { id, mealPlan: { householdId: household.id } },
      data: {
        status: MealSlotStatus.LEFTOVER,
        recipeId: cook.recipeId,
        cookSlotId: cook.id,
        pinned: true,
      },
    });
  }

  await prisma.mealPlanSlot.update({
    where: { id: cook.id },
    data: { pinned: true, status: MealSlotStatus.RECIPE },
  });

  revalidatePath("/plan");
  revalidatePath("/shop");
}

export async function autoFillWeek(opts: {
  weekStartIso: string;
  vegetarian?: number;
  fish?: number;
  preferVeg?: boolean;
  avoidLastWeeks?: number;
}) {
  const { household } = await requireHousehold();
  const weekStart = startOfWeek(parseDateOnly(opts.weekStartIso), household.weekStart);
  const { plan } = await getOrCreatePlan(household.id, weekStart);

  const avoidLastWeeks = Math.max(0, Math.min(8, opts.avoidLastWeeks ?? 1));
  const usedRecently = new Set<string>();
  for (let w = 1; w <= avoidLastWeeks; w++) {
    const pastStart = addDays(weekStart, -7 * w);
    const pastPlan = await prisma.mealPlan.findUnique({
      where: {
        householdId_weekStart: {
          householdId: household.id,
          weekStart: pastStart,
        },
      },
      include: { slots: true },
    });
    for (const s of pastPlan?.slots || []) {
      if (s.recipeId && s.status !== MealSlotStatus.SKIP) {
        usedRecently.add(s.recipeId);
      }
    }
  }

  const fillable = plan.slots.filter(
    (s) =>
      !s.pinned &&
      s.status !== MealSlotStatus.SKIP &&
      s.status !== MealSlotStatus.LEFTOVER &&
      !s.recipeId &&
      !s.notes?.trim(),
  );

  const alreadyPicked = new Set(
    plan.slots.filter((s) => s.recipeId).map((s) => s.recipeId as string),
  );

  const recipes = await prisma.recipe.findMany({
    where: {
      householdId: household.id,
      category: { slug: { in: [...PLANNING_CATEGORY_SLUGS] } },
    },
    include: {
      ratings: true,
      tags: { include: { tag: true } },
      category: true,
    },
  });

  const constraints: FillConstraints = {
    vegetarian: opts.vegetarian || 0,
    fish: opts.fish || 0,
    preferVeg: !!opts.preferVeg,
    avoidLastWeeks,
  };

  let ids = autoFillRecipes({
    recipes,
    usedRecentlyIds: usedRecently,
    alreadyPickedIds: alreadyPicked,
    slotsToFill: fillable.length,
    constraints,
  });

  // Small libraries: if “avoid last weeks” leaves too few Main/Soup options,
  // fill the rest from that same pool (still never cakes/desserts).
  if (ids.length < fillable.length) {
    const already = new Set([...alreadyPicked, ...ids]);
    const more = autoFillRecipes({
      recipes,
      usedRecentlyIds: new Set(),
      alreadyPickedIds: already,
      slotsToFill: fillable.length - ids.length,
      constraints: { ...constraints, avoidLastWeeks: 0 },
    });
    ids = [...ids, ...more];
  }

  if (fillable.length > 0 && ids.length === 0) {
    throw new Error(
      "No Main or Soup recipes to fill with — tag dinners as Main (or Soup) in the library first.",
    );
  }

  for (let i = 0; i < fillable.length; i++) {
    const recipeId = ids[i];
    if (!recipeId) break;
    await prisma.mealPlanSlot.update({
      where: { id: fillable[i].id },
      data: { recipeId, status: MealSlotStatus.RECIPE },
    });
  }

  revalidatePath("/plan");
  revalidatePath("/shop");
}

export async function clearUnpinned(weekStartIso: string) {
  const { household } = await requireHousehold();
  const weekStart = startOfWeek(parseDateOnly(weekStartIso), household.weekStart);
  const plan = await prisma.mealPlan.findUnique({
    where: { householdId_weekStart: { householdId: household.id, weekStart } },
    include: { slots: true },
  });
  if (!plan) return;

  await prisma.mealPlanSlot.updateMany({
    where: {
      mealPlanId: plan.id,
      pinned: false,
      status: { not: MealSlotStatus.SKIP },
    },
    data: {
      recipeId: null,
      cookSlotId: null,
      notes: null,
      status: MealSlotStatus.RECIPE,
    },
  });

  revalidatePath("/plan");
  revalidatePath("/shop");
}

/** Swap a day's recipe for another from the library (unpinned / non-leftover). */
export async function refreshSlotRecipe(slotId: string) {
  const { household } = await requireHousehold();
  const slot = await prisma.mealPlanSlot.findFirst({
    where: { id: slotId, mealPlan: { householdId: household.id } },
    include: { mealPlan: { include: { slots: true } } },
  });
  if (!slot) throw new Error("Slot not found");
  if (slot.pinned) throw new Error("Unpin this day before refreshing");
  if (slot.status === MealSlotStatus.SKIP || slot.status === MealSlotStatus.LEFTOVER) {
    throw new Error("Can't refresh a skip or leftover day");
  }

  const weekStart = slot.mealPlan.weekStart;
  const avoidLastWeeks = 1;
  const usedRecently = new Set<string>();
  for (let w = 1; w <= avoidLastWeeks; w++) {
    const pastStart = addDays(weekStart, -7 * w);
    const pastPlan = await prisma.mealPlan.findUnique({
      where: {
        householdId_weekStart: {
          householdId: household.id,
          weekStart: pastStart,
        },
      },
      include: { slots: true },
    });
    for (const s of pastPlan?.slots || []) {
      if (s.recipeId && s.status !== MealSlotStatus.SKIP) {
        usedRecently.add(s.recipeId);
      }
    }
  }

  const alreadyPicked = new Set(
    slot.mealPlan.slots
      .filter((s) => s.recipeId && s.id !== slot.id)
      .map((s) => s.recipeId as string),
  );
  if (slot.recipeId) alreadyPicked.add(slot.recipeId);

  const recipes = await prisma.recipe.findMany({
    where: {
      householdId: household.id,
      category: { slug: { in: [...PLANNING_CATEGORY_SLUGS] } },
    },
    include: {
      ratings: true,
      tags: { include: { tag: true } },
      category: true,
    },
  });

  let ids = autoFillRecipes({
    recipes,
    usedRecentlyIds: usedRecently,
    alreadyPickedIds: alreadyPicked,
    slotsToFill: 1,
    constraints: { avoidLastWeeks },
  });

  // If nothing left under avoid rules, allow recent recipes (still not this week's others).
  if (!ids[0]) {
    ids = autoFillRecipes({
      recipes,
      usedRecentlyIds: new Set(),
      alreadyPickedIds: new Set(
        slot.mealPlan.slots
          .filter((s) => s.recipeId && s.id !== slot.id)
          .map((s) => s.recipeId as string),
      ),
      slotsToFill: 1,
      constraints: { avoidLastWeeks: 0 },
    });
  }

  const nextId = ids[0];
  if (!nextId) {
    throw new Error(
      "No other Main/Soup recipes to cycle to — check library types.",
    );
  }

  await prisma.mealPlanSlot.update({
    where: { id: slot.id },
    data: {
      recipeId: nextId,
      status: MealSlotStatus.RECIPE,
      cookSlotId: null,
    },
  });

  revalidatePath("/plan");
  revalidatePath("/shop");
}

/** Pin a recipe onto a specific date in a week (defaults to next week from “today”). */
export async function pinRecipeToDate(opts: {
  recipeId: string;
  dateIso: string;
}) {
  const { household } = await requireHousehold();

  const recipe = await prisma.recipe.findFirst({
    where: { id: opts.recipeId, householdId: household.id },
  });
  if (!recipe) throw new Error("Recipe not found");

  const date = parseDateOnly(opts.dateIso);
  const weekStart = startOfWeek(date, household.weekStart);
  const { plan, mealTypes } = await getOrCreatePlan(household.id, weekStart);
  const mealType = mealTypes[0];
  if (!mealType) throw new Error("No meal types configured");

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

  revalidatePath("/plan");
  revalidatePath("/shop");
  revalidatePath(`/recipes/${opts.recipeId}`);
  return { weekStart: formatDateOnly(weekStart), date: formatDateOnly(date) };
}
