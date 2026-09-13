import { AddRecipeWizard } from "@/components/AddRecipeWizard";
import { ensureHouseholdCategories } from "@/lib/ensure-categories";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/session";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { household } = await requireHousehold();
  await ensureHouseholdCategories(household.id);

  const params = await searchParams;
  const modeParam = params.mode;
  const initialMode =
    modeParam === "photo" || modeParam === "manual" || modeParam === "url"
      ? modeParam
      : "url";

  const [categories, tags] = await Promise.all([
    prisma.category.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
    }),
    prisma.tag.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="animate-rise">
        <p className="chip mb-3">New entry</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          Add a recipe
        </h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Import from a URL or photo, or type one in by hand.
        </p>
      </div>
      <div className="surface animate-rise animate-rise-delay-1 rounded-[1.75rem] p-5 sm:p-8">
        <AddRecipeWizard
          categories={categories}
          tagOptions={tags.map((t) => t.name)}
          initialMode={initialMode}
        />
      </div>
    </div>
  );
}
