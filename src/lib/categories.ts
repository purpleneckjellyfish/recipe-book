/** Canonical archive categories — order is browse order on the library hub. */
export const ARCHIVE_CATEGORIES = [
  {
    name: "Main",
    slug: "main",
    blurb: "Weeknight dinners and centrepieces",
    image: "/categories/category-main.jpg",
  },
  {
    name: "Breakfast",
    slug: "breakfast",
    blurb: "Mornings and brunch",
    image: "/categories/category-breakfast.jpg",
  },
  {
    name: "Soup",
    slug: "soup",
    blurb: "Bowls and broths",
    image: "/categories/category-soup.jpg",
  },
  {
    name: "Side",
    slug: "side",
    blurb: "Accompaniments and salads",
    image: "/categories/category-side.jpg",
  },
  {
    name: "Dessert",
    slug: "dessert",
    blurb: "Puddings and sweet finishes",
    image: "/categories/category-dessert.jpg",
  },
  {
    name: "Cakes & bakes",
    slug: "cakes-bakes",
    blurb: "Cakes, biscuits and traybakes",
    image: "/categories/category-cakes-bakes.jpg",
  },
  {
    name: "Preserves",
    slug: "preserves",
    blurb: "Jams, chutneys and pickles",
    image: "/categories/category-preserves.jpg",
  },
  {
    name: "Sauces & condiments",
    slug: "sauces-condiments",
    blurb: "Sauces, dressings and dips",
    image: "/categories/category-sauces-condiments.jpg",
  },
  {
    name: "Drinks",
    slug: "drinks",
    blurb: "Cordials, cocktails and hot drinks",
    image: "/categories/category-drinks.jpg",
  },
  {
    name: "Snack",
    slug: "snack",
    blurb: "Nibbles and light bites",
    image: "/categories/category-snack.jpg",
  },
] as const;

/** Categories used for “Weeknight mains” planning shortcut. */
export const PLANNING_CATEGORY_SLUGS = ["main", "soup"] as const;

export function categoryCreateData() {
  return ARCHIVE_CATEGORIES.map((c) => ({
    name: c.name,
    slug: c.slug,
  }));
}

export function categoryThumb(slug: string): string | null {
  const match = ARCHIVE_CATEGORIES.find((c) => c.slug === slug);
  return match?.image ?? null;
}
