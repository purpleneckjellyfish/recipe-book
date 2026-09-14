import type { Recipe, RecipeRating, RecipeTag, Tag, Category } from "@prisma/client";
import { PLANNING_CATEGORY_SLUGS } from "@/lib/categories";

type RecipeCandidate = Recipe & {
  ratings: RecipeRating[];
  tags: (RecipeTag & { tag: Tag })[];
  category: Category | null;
};

export type FillConstraints = {
  vegetarian?: number;
  fish?: number;
  preferVeg?: boolean;
  avoidLastWeeks?: number; // default 1
};

const PLAN_SLUGS = new Set<string>(PLANNING_CATEGORY_SLUGS);

/** Evening-plan pool: Main + Soup only — never cakes, desserts, sides, etc. */
export function isPlanMealRecipe(r: RecipeCandidate) {
  const slug = r.category?.slug?.toLowerCase();
  return !!slug && PLAN_SLUGS.has(slug);
}

function avgRating(r: RecipeCandidate) {
  if (!r.ratings.length) return 3; // neutral mid weight
  return r.ratings.reduce((s, x) => s + x.score, 0) / r.ratings.length;
}

function hasTag(r: RecipeCandidate, needles: string[]) {
  const hay = [
    ...r.tags.map((t) => t.tag.name),
    ...r.tags.map((t) => t.tag.slug),
  ]
    .join(" ")
    .toLowerCase();
  return needles.some((n) => hay.includes(n.toLowerCase()));
}

function isVegetarian(r: RecipeCandidate) {
  return hasTag(r, ["vegetarian", "veggie", "vegan"]);
}

function isFish(r: RecipeCandidate) {
  return hasTag(r, ["fish", "salmon", "cod", "tuna", "seafood", "prawn"]);
}

function weightedPick<T>(items: { item: T; weight: number }[]): T | null {
  if (!items.length) return null;
  const total = items.reduce((s, i) => s + Math.max(0.05, i.weight), 0);
  let roll = Math.random() * total;
  for (const entry of items) {
    roll -= Math.max(0.05, entry.weight);
    if (roll <= 0) return entry.item;
  }
  return items[items.length - 1]?.item ?? null;
}

export function autoFillRecipes(opts: {
  recipes: RecipeCandidate[];
  usedRecentlyIds: Set<string>;
  alreadyPickedIds: Set<string>;
  slotsToFill: number;
  constraints: FillConstraints;
}): string[] {
  const avoidWeeks = opts.constraints.avoidLastWeeks ?? 1;
  const picked: string[] = [];
  let vegNeeded = opts.constraints.vegetarian ?? 0;
  let fishNeeded = opts.constraints.fish ?? 0;

  // Hard gate: only Main / Soup (matches Library “planning” shortcut).
  const mealPool = opts.recipes.filter(isPlanMealRecipe);

  const eligible = () =>
    mealPool.filter((r) => {
      if (picked.includes(r.id) || opts.alreadyPickedIds.has(r.id)) return false;
      if (avoidWeeks > 0 && opts.usedRecentlyIds.has(r.id) && !r.allowWeeklyRepeat) {
        return false;
      }
      return true;
    });

  function pickOne(filter: (r: RecipeCandidate) => boolean) {
    const pool = eligible()
      .filter(filter)
      .map((r) => {
        let weight = avgRating(r);
        if (opts.constraints.preferVeg && (r.vegPortions || 0) > 0) {
          weight += (r.vegPortions || 0) * 0.35;
        }
        weight += Math.random() * 0.4; // jitter
        return { item: r, weight };
      });
    return weightedPick(pool);
  }

  while (vegNeeded > 0 && picked.length < opts.slotsToFill) {
    const r = pickOne(isVegetarian);
    if (!r) break;
    picked.push(r.id);
    vegNeeded -= 1;
  }

  while (fishNeeded > 0 && picked.length < opts.slotsToFill) {
    const r = pickOne(isFish);
    if (!r) break;
    picked.push(r.id);
    fishNeeded -= 1;
  }

  while (picked.length < opts.slotsToFill) {
    const r = pickOne(() => true);
    if (!r) break;
    picked.push(r.id);
  }

  return picked;
}
