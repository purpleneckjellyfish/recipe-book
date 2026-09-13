"use server";

import { revalidatePath } from "next/cache";
import { MealSlotStatus } from "@prisma/client";
import {
  addDays,
  formatDateOnly,
  formatWeekRange,
  parseDateOnly,
  startOfWeek,
  toDateOnly,
} from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/session";
import { scaleQuantity } from "@/lib/scale";
import {
  aggregateIngredients,
  isPantryMatch,
} from "@/lib/shopping-aggregate";

/** Shop only supports last / this / next week — no free scrolling. */
function resolveShopWeek(householdWeekStart: number, weekStartIso?: string) {
  const thisWeek = startOfWeek(toDateOnly(new Date()), householdWeekStart);
  const lastWeek = addDays(thisWeek, -7);
  const nextWeek = addDays(thisWeek, 7);
  const allowed = new Set([
    formatDateOnly(lastWeek),
    formatDateOnly(thisWeek),
    formatDateOnly(nextWeek),
  ]);

  if (weekStartIso) {
    const requested = startOfWeek(
      parseDateOnly(weekStartIso),
      householdWeekStart,
    );
    if (allowed.has(formatDateOnly(requested))) {
      return { weekStart: requested, lastWeek, thisWeek, nextWeek };
    }
  }

  return { weekStart: thisWeek, lastWeek, thisWeek, nextWeek };
}

export async function generateShoppingList(weekStartIso?: string) {
  const { household } = await requireHousehold();
  const { weekStart } = resolveShopWeek(household.weekStart, weekStartIso);

  const plan = await prisma.mealPlan.findUnique({
    where: { householdId_weekStart: { householdId: household.id, weekStart } },
    include: {
      slots: {
        include: {
          recipe: { include: { ingredients: true } },
        },
      },
      shoppingList: { include: { items: true } },
    },
  });

  if (!plan) {
    throw new Error("No meal plan for this week — open Plan and add some meals first");
  }

  const pantry = await prisma.pantryStaple.findMany({
    where: { householdId: household.id },
  });
  const stapleNames = pantry.map((p) => p.name);

  const cookSlots = plan.slots.filter(
    (s) => s.status === MealSlotStatus.RECIPE && s.recipeId && s.recipe,
  );

  const rawLines: { name: string; quantity: number | null; unit: string | null }[] =
    [];

  for (const slot of cookSlots) {
    const recipe = slot.recipe!;
    const targetServings = slot.servings || recipe.servings;
    for (const ing of recipe.ingredients) {
      const qty =
        ing.quantity == null ? null : Number(ing.quantity.toString());
      rawLines.push({
        name: ing.name,
        quantity: scaleQuantity(qty, recipe.servings, targetServings),
        unit: ing.unit,
      });
    }
  }

  const aggregated = aggregateIngredients(rawLines).filter(
    (line) => !isPantryMatch(line.name, stapleNames),
  );

  let list = plan.shoppingList;
  if (!list) {
    list = await prisma.shoppingList.create({
      data: {
        householdId: household.id,
        mealPlanId: plan.id,
        weekStart,
        title: `Shop · ${formatWeekRange(weekStart)}`,
        archivedAt: null,
      },
      include: { items: true },
    });
  } else {
    await prisma.shoppingList.update({
      where: { id: list.id },
      data: {
        weekStart,
        title: `Shop · ${formatWeekRange(weekStart)}`,
        archivedAt: null,
      },
    });
  }

  const prevByName = new Map(
    list.items
      .filter((i) => i.source === "generated")
      .map((i) => [i.name.toLowerCase(), i]),
  );

  await prisma.shoppingListItem.deleteMany({
    where: { shoppingListId: list.id, source: "generated" },
  });

  if (aggregated.length > 0) {
    await prisma.shoppingListItem.createMany({
      data: aggregated.map((line, sortOrder) => {
        const prev = prevByName.get(line.name.toLowerCase());
        return {
          shoppingListId: list!.id,
          name: line.name,
          quantity: line.quantity,
          unit: line.unit,
          note: line.note || null,
          source: "generated",
          sortOrder,
          checked: prev?.checked ?? false,
          alreadyHave: prev?.alreadyHave ?? false,
          softDeleted: false,
        };
      }),
    });
  }

  revalidatePath("/shop");
  return {
    listId: list.id,
    itemCount: aggregated.length,
    mealCount: cookSlots.length,
  };
}

export async function getShoppingList(weekStartIso?: string) {
  const { household } = await requireHousehold();
  const { weekStart, lastWeek, thisWeek, nextWeek } = resolveShopWeek(
    household.weekStart,
    weekStartIso,
  );

  const plan = await prisma.mealPlan.findUnique({
    where: { householdId_weekStart: { householdId: household.id, weekStart } },
    include: {
      shoppingList: {
        include: {
          items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
      },
      slots: {
        where: { status: MealSlotStatus.RECIPE, recipeId: { not: null } },
        select: { id: true },
      },
    },
  });

  // Auto-archive lists older than last week (relative to today)
  await prisma.shoppingList.updateMany({
    where: {
      householdId: household.id,
      archivedAt: null,
      weekStart: { lt: lastWeek },
    },
    data: { archivedAt: new Date() },
  });

  const archived = await prisma.shoppingList.findMany({
    where: {
      householdId: household.id,
      archivedAt: { not: null },
    },
    orderBy: { weekStart: "desc" },
    take: 12,
    include: {
      _count: { select: { items: true } },
    },
  });

  return {
    weekStart: formatDateOnly(weekStart),
    weekLabel: formatWeekRange(weekStart),
    lastWeekStart: formatDateOnly(lastWeek),
    lastWeekLabel: formatWeekRange(lastWeek),
    nextWeekStart: formatDateOnly(nextWeek),
    nextWeekLabel: formatWeekRange(nextWeek),
    thisWeekStart: formatDateOnly(thisWeek),
    list: plan?.shoppingList ?? null,
    hasPlan: !!plan,
    plannedMealCount: plan?.slots.length ?? 0,
    archived: archived.map((a) => ({
      id: a.id,
      title: a.title,
      weekStart: a.weekStart ? formatDateOnly(a.weekStart) : null,
      weekLabel: a.weekStart ? formatWeekRange(a.weekStart) : a.title,
      itemCount: a._count.items,
    })),
  };
}

export async function archiveShoppingList(listId: string) {
  const { household } = await requireHousehold();
  await prisma.shoppingList.updateMany({
    where: { id: listId, householdId: household.id },
    data: { archivedAt: new Date() },
  });
  revalidatePath("/shop");
}

export async function unarchiveShoppingList(listId: string) {
  const { household } = await requireHousehold();
  await prisma.shoppingList.updateMany({
    where: { id: listId, householdId: household.id },
    data: { archivedAt: null },
  });
  revalidatePath("/shop");
}

export async function toggleChecked(itemId: string) {
  const { household } = await requireHousehold();
  const item = await prisma.shoppingListItem.findFirst({
    where: { id: itemId, shoppingList: { householdId: household.id } },
  });
  if (!item) throw new Error("Not found");
  await prisma.shoppingListItem.update({
    where: { id: item.id },
    data: { checked: !item.checked },
  });
  revalidatePath("/shop");
}

export async function toggleAlreadyHave(itemId: string) {
  const { household } = await requireHousehold();
  const item = await prisma.shoppingListItem.findFirst({
    where: { id: itemId, shoppingList: { householdId: household.id } },
  });
  if (!item) throw new Error("Not found");
  const next = !item.alreadyHave;
  await prisma.shoppingListItem.update({
    where: { id: item.id },
    data: { alreadyHave: next, checked: next ? true : item.checked },
  });
  revalidatePath("/shop");
}

export async function softDeleteItem(itemId: string) {
  const { household } = await requireHousehold();
  await prisma.shoppingListItem.updateMany({
    where: { id: itemId, shoppingList: { householdId: household.id } },
    data: { softDeleted: true },
  });
  revalidatePath("/shop");
}

export async function restoreItem(itemId: string) {
  const { household } = await requireHousehold();
  await prisma.shoppingListItem.updateMany({
    where: { id: itemId, shoppingList: { householdId: household.id } },
    data: { softDeleted: false, checked: false, alreadyHave: false },
  });
  revalidatePath("/shop");
}

export async function addCustomItem(listId: string, name: string) {
  const { household } = await requireHousehold();
  const list = await prisma.shoppingList.findFirst({
    where: { id: listId, householdId: household.id },
  });
  if (!list) throw new Error("List not found");
  const trimmed = name.trim();
  if (!trimmed) return;

  await prisma.shoppingListItem.create({
    data: {
      shoppingListId: list.id,
      name: trimmed,
      source: "custom",
      sortOrder: 9999,
    },
  });
  revalidatePath("/shop");
}
