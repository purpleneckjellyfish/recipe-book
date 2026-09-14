import Link from "next/link";
import {
  ARCHIVE_CATEGORIES,
  PLANNING_CATEGORY_SLUGS,
} from "@/lib/categories";
import { ensureHouseholdCategories } from "@/lib/ensure-categories";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/session";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    tag?: string;
    view?: string;
    minVeg?: string;
    sort?: string;
  }>;
}) {
  const { household } = await requireHousehold();
  await ensureHouseholdCategories(household.id);

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const category = params.category || "";
  const tag = params.tag || "";
  const minVeg = Math.max(0, Math.min(5, Number(params.minVeg) || 0));
  const sort = params.sort === "rating" ? "rating" : "recent";
  const weeknightMains = params.view === "mains";
  const viewAll = params.view === "all";
  const browsing = !!(
    q ||
    category ||
    tag ||
    weeknightMains ||
    viewAll ||
    minVeg > 0 ||
    sort === "rating"
  );

  const [categories, tags, allRecipes] = await Promise.all([
    prisma.category.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
    }),
    prisma.tag.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
    }),
    prisma.recipe.findMany({
      where: { householdId: household.id },
      include: {
        category: true,
        tags: { include: { tag: true } },
        ratings: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const orderedCategories = ARCHIVE_CATEGORIES.map((meta) => {
    const row = bySlug.get(meta.slug);
    return row
      ? { ...row, blurb: meta.blurb, image: meta.image }
      : null;
  }).filter(Boolean) as Array<{
    id: string;
    name: string;
    slug: string;
    blurb: string;
    image: string;
  }>;

  // Any extra custom categories not in the canonical list
  const knownSlugs = new Set<string>(ARCHIVE_CATEGORIES.map((c) => c.slug));
  const extras = categories
    .filter((c) => !knownSlugs.has(c.slug))
    .map((c) => ({ ...c, blurb: "Custom type", image: null as string | null }));

  const hubCategories = [...orderedCategories, ...extras];

  const planningIds = categories
    .filter((c) =>
      (PLANNING_CATEGORY_SLUGS as readonly string[]).includes(c.slug),
    )
    .map((c) => c.id);

  const uncategorisedCount = allRecipes.filter((r) => !r.categoryId).length;
  const mainsCount = allRecipes.filter(
    (r) => r.categoryId && planningIds.includes(r.categoryId),
  ).length;

  const categoryCounts = new Map<string, number>();
  const categoryCovers = new Map<string, string>();
  for (const r of allRecipes) {
    if (!r.categoryId) continue;
    categoryCounts.set(r.categoryId, (categoryCounts.get(r.categoryId) || 0) + 1);
    if (!categoryCovers.has(r.categoryId) && r.images[0]) {
      categoryCovers.set(r.categoryId, r.images[0].path);
    }
  }

  const mainsThumb =
    ARCHIVE_CATEGORIES.find((c) => c.slug === "main")?.image ?? null;

  const activeCategory = category
    ? categories.find((c) => c.id === category)
    : null;

  const categoryFilter =
    weeknightMains
      ? { categoryId: { in: planningIds } }
      : category === "uncategorised"
        ? { categoryId: null }
        : category
          ? { categoryId: category }
          : {};

  let list = q
    ? await prisma.recipe.findMany({
        where: {
          householdId: household.id,
          ...categoryFilter,
          ...(tag ? { tags: { some: { tagId: tag } } } : {}),
          ...(minVeg > 0 ? { vegPortions: { gte: minVeg } } : {}),
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            {
              ingredients: {
                some: { name: { contains: q, mode: "insensitive" } },
              },
            },
          ],
        },
        include: {
          category: true,
          tags: { include: { tag: true } },
          ratings: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
      })
    : allRecipes.filter((r) => {
        if (weeknightMains) {
          if (!r.categoryId || !planningIds.includes(r.categoryId)) return false;
        } else if (category === "uncategorised") {
          if (r.categoryId) return false;
        } else if (category) {
          if (r.categoryId !== category) return false;
        }
        if (tag && !r.tags.some((t) => t.tagId === tag)) return false;
        if (minVeg > 0 && (r.vegPortions || 0) < minVeg) return false;
        return true;
      });

  if (sort === "rating") {
    list = [...list].sort((a, b) => {
      const avgA =
        a.ratings.length > 0
          ? a.ratings.reduce((s, r) => s + r.score, 0) / a.ratings.length
          : 0;
      const avgB =
        b.ratings.length > 0
          ? b.ratings.reduce((s, r) => s + r.score, 0) / b.ratings.length
          : 0;
      return avgB - avgA;
    });
  }

  return (
    <div className="space-y-8">
      <section className="animate-rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="chip mb-3">Family library</p>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Library
          </h1>
          <p className="mt-2 max-w-xl text-[var(--ink-soft)]">
            Browse by type — mains for the week, or cakes, preserves, breakfast
            and everything else.
          </p>
        </div>
        <Link href="/recipes/new" className="btn btn-primary self-start">
          Add recipe
        </Link>
      </section>

      <form
        className="surface animate-rise animate-rise-delay-1 flex flex-col gap-3 rounded-[1.5rem] p-4 sm:flex-row"
        action="/library"
      >
        {weeknightMains ? <input type="hidden" name="view" value="mains" /> : null}
        {viewAll ? <input type="hidden" name="view" value="all" /> : null}
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <input
          className="field flex-1"
          name="q"
          defaultValue={q}
          placeholder="Search recipes or ingredients…"
        />
        <select className="field sm:max-w-[11rem]" name="tag" defaultValue={tag}>
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          className="field sm:max-w-[10rem]"
          name="minVeg"
          defaultValue={minVeg || ""}
        >
          <option value="">Any veg</option>
          <option value="1">1+ of 5</option>
          <option value="2">2+ of 5</option>
          <option value="3">3+ of 5</option>
          <option value="4">4+ of 5</option>
        </select>
        <select className="field sm:max-w-[10rem]" name="sort" defaultValue={sort}>
          <option value="recent">Newest</option>
          <option value="rating">Top rated</option>
        </select>
        <button className="btn btn-primary" type="submit">
          Search
        </button>
      </form>

      {!browsing ? (
        <>
          <Link
            href="/library?view=mains"
            className="surface group animate-rise relative flex overflow-hidden rounded-[1.75rem] transition hover:-translate-y-0.5"
          >
            <div className="flex flex-1 flex-col justify-center p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--leaf)]">
                Planning shortcut
              </p>
              <h2 className="font-display mt-2 text-3xl font-bold">
                Weeknight mains
              </h2>
              <p className="mt-2 max-w-md text-[var(--ink-soft)]">
                Mains and soups — the dishes you reach for when filling the meal
                plan.
              </p>
              <p className="mt-4 text-sm font-semibold text-[var(--leaf-deep)]">
                {mainsCount} recipe{mainsCount === 1 ? "" : "s"} →
              </p>
            </div>
            <div className="relative hidden w-44 shrink-0 sm:block lg:w-56">
              {mainsThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mainsThumb}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--leaf-deep)] to-[var(--leaf)]" />
              )}
            </div>
          </Link>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hubCategories.map((cat, i) => {
              const count = categoryCounts.get(cat.id) || 0;
              const cover = categoryCovers.get(cat.id) || cat.image;
              return (
                <Link
                  key={cat.id}
                  href={`/library?category=${cat.id}`}
                  className={`surface group animate-rise overflow-hidden rounded-[1.5rem] transition hover:-translate-y-1 ${
                    i % 3 === 1
                      ? "animate-rise-delay-1"
                      : i % 3 === 2
                        ? "animate-rise-delay-2"
                        : ""
                  }`}
                >
                  <div className="relative h-28 bg-gradient-to-br from-[var(--leaf-soft)] via-[#dfece6] to-[rgba(212,120,74,0.2)]">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </div>
                  <div className="p-4">
                    <h3 className="font-display text-xl font-bold">{cat.name}</h3>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">{cat.blurb}</p>
                    <p className="mt-3 text-xs font-semibold text-[var(--leaf-deep)]">
                      {count} recipe{count === 1 ? "" : "s"}
                    </p>
                  </div>
                </Link>
              );
            })}

            <Link
              href="/library?category=uncategorised"
              className="surface overflow-hidden rounded-[1.5rem] transition hover:-translate-y-1"
            >
              <div className="h-28 bg-[var(--mist)]" />
              <div className="p-4">
                <h3 className="font-display text-xl font-bold">Uncategorised</h3>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  Not filed under a type yet
                </p>
                <p className="mt-3 text-xs font-semibold text-[var(--leaf-deep)]">
                  {uncategorisedCount} recipe{uncategorisedCount === 1 ? "" : "s"}
                </p>
              </div>
            </Link>
          </div>

          {allRecipes.length > 0 ? (
            <p className="text-center text-sm text-[var(--ink-soft)]">
              <Link
                href="/library?view=all"
                className="font-semibold text-[var(--leaf-deep)]"
              >
                Or browse everything ({allRecipes.length})
              </Link>
            </p>
          ) : (
            <div className="surface rounded-[1.75rem] px-6 py-14 text-center">
              <p className="font-display text-2xl font-bold">Your library is empty</p>
              <p className="mx-auto mt-2 max-w-md text-[var(--ink-soft)]">
                Add from a URL, a photo, or type one in — cakes and preserves
                welcome, not just dinners.
              </p>
              <Link href="/recipes/new" className="btn btn-primary mt-6">
                Add your first recipe
              </Link>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href="/library" className="font-semibold text-[var(--leaf-deep)]">
              Library
            </Link>
            <span className="text-[var(--ink-soft)]">/</span>
            <span className="font-semibold text-[var(--ink)]">
              {weeknightMains
                ? "Weeknight mains"
                : category === "uncategorised"
                  ? "Uncategorised"
                  : activeCategory?.name ||
                    (q ? `Search “${q}”` : viewAll ? "All recipes" : "Recipes")}
            </span>
            <Link href="/library" className="ml-auto text-sm font-semibold text-[var(--ink-soft)]">
              ← All categories
            </Link>
          </div>

          {list.length === 0 ? (
            <div className="surface rounded-[1.75rem] px-6 py-14 text-center">
              <p className="font-display text-2xl font-bold">Nothing here yet</p>
              <p className="mt-2 text-[var(--ink-soft)]">
                Try another category, or add a recipe to this type.
              </p>
              <Link href="/recipes/new" className="btn btn-primary mt-6">
                Add recipe
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((recipe, i) => {
                const avg =
                  recipe.ratings.length > 0
                    ? recipe.ratings.reduce((s, r) => s + r.score, 0) /
                      recipe.ratings.length
                    : null;
                return (
                  <Link
                    key={recipe.id}
                    href={`/recipes/${recipe.id}`}
                    className={`surface group animate-rise overflow-hidden rounded-[1.5rem] transition hover:-translate-y-1 ${
                      i % 3 === 1
                        ? "animate-rise-delay-1"
                        : i % 3 === 2
                          ? "animate-rise-delay-2"
                          : ""
                    }`}
                  >
                    <div className="relative h-36 overflow-hidden bg-gradient-to-br from-[var(--leaf-soft)] via-[#dfece6] to-[rgba(212,120,74,0.25)]">
                      {recipe.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={recipe.images[0].path}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                      <div className="relative z-10 flex flex-wrap gap-2 p-4">
                        {recipe.category ? (
                          <span className="chip bg-white/90 backdrop-blur-sm">
                            {recipe.category.name}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-3 p-5">
                      <h2 className="font-display text-xl font-bold leading-snug group-hover:text-[var(--leaf-deep)]">
                        {recipe.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ink-soft)]">
                        <span>Serves {recipe.servings}</span>
                        {(recipe.prepMinutes || recipe.cookMinutes) && (
                          <span>
                            {(recipe.prepMinutes || 0) + (recipe.cookMinutes || 0)}{" "}
                            min
                          </span>
                        )}
                        {avg != null && (
                          <span className="font-semibold text-[var(--bloom)]">
                            ★ {avg.toFixed(1)}
                          </span>
                        )}
                        {recipe.vegPortions ? (
                          <span>{recipe.vegPortions} of 5</span>
                        ) : null}
                      </div>
                      {recipe.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {recipe.tags.slice(0, 3).map(({ tag: t }) => (
                            <span
                              key={t.id}
                              className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-[var(--ink-soft)]"
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
