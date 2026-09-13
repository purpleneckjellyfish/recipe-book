import { HomeClient } from "@/components/HomeClient";
import { getFeaturedBySource } from "@/lib/featured";
import { nextWeekDayOptions } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/session";

export default async function HomeDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { household } = await requireHousehold();
  const params = await searchParams;
  const initialTab = params.tab === "try" ? "try" : "ideas";

  const [recipes, toTryRows] = await Promise.all([
    prisma.recipe.findMany({
      where: { householdId: household.id },
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    }),
    prisma.toTryItem.findMany({
      where: { householdId: household.id },
      orderBy: { createdAt: "desc" },
      include: {
        recipe: {
          include: {
            category: true,
            images: { orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
      },
    }),
  ]);

  // Deterministic shuffle by week so picks stay stable for a few days
  const weekSeed = Math.floor(Date.now() / (3 * 24 * 60 * 60 * 1000));
  const shuffled = [...recipes].sort((a, b) => {
    const ha = hash(`${weekSeed}-${a.id}`);
    const hb = hash(`${weekSeed}-${b.id}`);
    return ha - hb;
  });

  const toTryIds = new Set(toTryRows.map((t) => t.recipeId));

  const archivePicks = shuffled.slice(0, 4).map((r) => ({
    id: r.id,
    title: r.title,
    imagePath: r.images[0]?.path ?? null,
    category: r.category?.name ?? null,
    onToTry: toTryIds.has(r.id),
  }));

  const toTry = toTryRows.map((t) => ({
    id: t.recipe.id,
    title: t.recipe.title,
    imagePath: t.recipe.images[0]?.path ?? null,
    category: t.recipe.category?.name ?? null,
    onToTry: true,
  }));

  let featured = {
    version: 0,
    weekKey: "",
    goodFood: [],
    bbcFood: [],
  } as Awaited<ReturnType<typeof getFeaturedBySource>>;
  try {
    featured = await getFeaturedBySource();
  } catch {
    featured = { version: 0, weekKey: "", goodFood: [], bbcFood: [] };
  }

  const nextWeekDays = nextWeekDayOptions(household.weekStart);

  return (
    <HomeClient
      initialTab={initialTab}
      archivePicks={archivePicks}
      toTry={toTry}
      goodFood={featured.goodFood}
      bbcFood={featured.bbcFood}
      nextWeekDays={nextWeekDays}
    />
  );
}

function hash(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}
