import { notFound } from "next/navigation";
import { RecipeForm } from "@/components/RecipeForm";
import { formatQuantity } from "@/lib/scale";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/session";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { household } = await requireHousehold();

  const [recipe, categories, tags] = await Promise.all([
    prisma.recipe.findFirst({
      where: { id, householdId: household.id },
      include: {
        ingredients: { orderBy: { sortOrder: "asc" } },
        steps: { orderBy: { sortOrder: "asc" } },
        tags: { include: { tag: true } },
      },
    }),
    prisma.category.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
    }),
    prisma.tag.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!recipe) notFound();

  const ingredientsText = recipe.ingredients
    .map((ing) => {
      const qty =
        ing.quantity == null ? null : Number(ing.quantity.toString());
      const left = formatQuantity(qty, ing.unit);
      return left ? `${left} ${ing.name}` : ing.name;
    })
    .join("\n");

  const stepsText = recipe.steps.map((s) => s.body).join("\n");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="animate-rise">
        <p className="chip mb-3">Edit</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          {recipe.title}
        </h1>
      </div>
      <div className="surface animate-rise animate-rise-delay-1 rounded-[1.75rem] p-5 sm:p-8">
        <RecipeForm
          mode="edit"
          recipeId={recipe.id}
          categories={categories}
          tagOptions={tags.map((t) => t.name)}
          defaults={{
            title: recipe.title,
            description: recipe.description,
            servings: recipe.servings,
            prepMinutes: recipe.prepMinutes,
            cookMinutes: recipe.cookMinutes,
            categoryId: recipe.categoryId,
            vegPortions: recipe.vegPortions,
            allowWeeklyRepeat: recipe.allowWeeklyRepeat,
            ingredientsText,
            stepsText,
            tags: recipe.tags.map((t) => t.tag.name),
          }}
        />
      </div>
    </div>
  );
}
