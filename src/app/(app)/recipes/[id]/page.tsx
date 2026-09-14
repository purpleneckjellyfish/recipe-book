import Link from "next/link";
import { notFound } from "next/navigation";
import { RatingStars } from "@/components/RatingStars";
import { ServingScaler } from "@/components/ServingScaler";
import { ShareRecipePanel } from "@/components/ShareRecipePanel";
import { PhotoUpload } from "@/components/PhotoUpload";
import { PinToWeekPanel } from "@/components/PinToWeekPanel";
import { RecipeTagsPanel } from "@/components/RecipeTagsPanel";
import { ReparseIngredientsButton } from "@/components/ReparseIngredientsButton";
import { ToTryButton } from "@/components/ToTryButton";
import { SuggestOrganisationButton } from "@/components/SuggestOrganisationButton";
import { DeleteRecipeButton } from "@/components/DeleteRecipeButton";
import { ensureHouseholdCategories } from "@/lib/ensure-categories";
import { isImportAiConfigured } from "@/lib/ai-import";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/session";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { session, household } = await requireHousehold();
  await ensureHouseholdCategories(household.id);

  const [recipe, householdTags, categories, toTryRow] = await Promise.all([
    prisma.recipe.findFirst({
      where: { id, householdId: household.id },
      include: {
        category: true,
        tags: { include: { tag: true } },
        ingredients: { orderBy: { sortOrder: "asc" } },
        steps: { orderBy: { sortOrder: "asc" } },
        ratings: true,
        images: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.tag.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
    }),
    prisma.toTryItem.findFirst({
      where: { householdId: household.id, recipeId: id },
      select: { id: true },
    }),
  ]);

  if (!recipe) notFound();

  const myScore =
    recipe.ratings.find((r) => r.userId === session.user.id)?.score ?? null;
  const avg =
    recipe.ratings.length > 0
      ? recipe.ratings.reduce((s, r) => s + r.score, 0) / recipe.ratings.length
      : null;

  const tagNames = recipe.tags.map(({ tag }) => tag.name);

  return (
    <div className="space-y-8">
      <section className="animate-rise overflow-hidden rounded-[2rem] border border-[var(--line)] bg-gradient-to-br from-[var(--leaf-deep)] via-[#2a5c4c] to-[#3d6e4f] p-6 text-[#f7fbf8] shadow-[0_24px_60px_rgba(18,38,31,0.2)] sm:p-10">
        <div className="flex flex-wrap gap-2">
          {recipe.category ? (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              {recipe.category.name}
            </span>
          ) : (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              Uncategorised
            </span>
          )}
          {recipe.vegPortions ? (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              {recipe.vegPortions} of your 5 a day
            </span>
          ) : null}
          {recipe.allowWeeklyRepeat ? (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              OK to repeat
            </span>
          ) : null}
        </div>
        <h1 className="font-display mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          {recipe.title}
        </h1>
        {recipe.description ? (
          <p className="mt-4 max-w-2xl text-base text-white/85">{recipe.description}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-4 text-sm text-white/80">
          <span>Serves {recipe.servings}</span>
          {recipe.prepMinutes != null ? <span>Prep {recipe.prepMinutes}m</span> : null}
          {recipe.cookMinutes != null ? <span>Cook {recipe.cookMinutes}m</span> : null}
          {avg != null ? <span>Household ★ {avg.toFixed(1)}</span> : null}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25"
          >
            Edit recipe
          </Link>
          <ShareRecipePanel recipeId={recipe.id} />
          <PinToWeekPanel
            recipeId={recipe.id}
            weekStartDay={household.weekStart}
          />
          <ToTryButton recipeId={recipe.id} onToTry={!!toTryRow} />
          <DeleteRecipeButton recipeId={recipe.id} title={recipe.title} />
        </div>
        <div className="mt-4">
          <PhotoUpload recipeId={recipe.id} />
        </div>
        {recipe.images.length > 0 ? (
          <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
            {recipe.images.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id}
                src={img.path}
                alt=""
                className="h-28 w-40 shrink-0 rounded-2xl object-cover"
              />
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="surface animate-rise animate-rise-delay-1 rounded-[1.75rem] p-5 sm:p-7">
          <ServingScaler
            baseServings={recipe.servings}
            ingredients={recipe.ingredients.map((ing) => ({
              id: ing.id,
              quantity:
                ing.quantity == null ? null : Number(ing.quantity.toString()),
              unit: ing.unit,
              name: ing.name,
              note: ing.note,
            }))}
          />
          <div className="mt-4">
            <ReparseIngredientsButton recipeId={recipe.id} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface animate-rise animate-rise-delay-2 rounded-[1.75rem] p-5 sm:p-7">
            <h2 className="font-display text-2xl font-bold">Method</h2>
            <ol className="mt-5 space-y-4">
              {recipe.steps.map((step, i) => (
                <li key={step.id} className="flex gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--leaf-soft)] text-sm font-bold text-[var(--leaf-deep)]">
                    {i + 1}
                  </span>
                  <p className="pt-1 leading-relaxed text-[var(--ink-soft)]">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <RecipeTagsPanel
            recipeId={recipe.id}
            selected={tagNames}
            options={householdTags.map((t) => t.name)}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            categoryId={recipe.categoryId}
            categoryName={recipe.category?.name ?? null}
          />
          <div className="px-1">
            <SuggestOrganisationButton
              recipeId={recipe.id}
              aiConfigured={isImportAiConfigured()}
            />
          </div>

          <div className="surface animate-rise animate-rise-delay-3 rounded-[1.75rem] p-5 sm:p-7">
            <h2 className="font-display text-2xl font-bold">Your rating</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Higher scores are favoured when auto-filling meal plans.
            </p>
            <div className="mt-4">
              <RatingStars recipeId={recipe.id} myScore={myScore} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
