import { formatDateOnly } from "@/lib/dates";
import { loadWeekPlan } from "./actions";
import { PlanClient } from "./PlanClient";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const data = await loadWeekPlan(week);

  const slots = data.plan.slots.map((s) => ({
    id: s.id,
    date: formatDateOnly(s.date),
    status: s.status,
    pinned: s.pinned,
    recipeId: s.recipeId,
    servings: s.servings,
    cookSlotId: s.cookSlotId,
    mealType: { id: s.mealType.id, name: s.mealType.name },
    recipe: s.recipe
      ? { id: s.recipe.id, title: s.recipe.title, servings: s.recipe.servings }
      : null,
  }));

  return (
    <PlanClient
      weekStart={data.weekStart}
      slots={slots}
      recipes={data.recipes.map((r) => ({
        id: r.id,
        title: r.title,
        servings: r.servings,
        vegPortions: r.vegPortions,
        allowWeeklyRepeat: r.allowWeeklyRepeat,
      }))}
    />
  );
}
