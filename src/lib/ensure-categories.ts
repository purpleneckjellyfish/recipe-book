import { ARCHIVE_CATEGORIES } from "@/lib/categories";
import { prisma } from "@/lib/prisma";

/** Ensure a household has the full library category set (safe to call repeatedly). */
export async function ensureHouseholdCategories(householdId: string) {
  for (const cat of ARCHIVE_CATEGORIES) {
    await prisma.category.upsert({
      where: {
        householdId_slug: { householdId, slug: cat.slug },
      },
      create: {
        householdId,
        name: cat.name,
        slug: cat.slug,
      },
      update: { name: cat.name },
    });
  }
}
