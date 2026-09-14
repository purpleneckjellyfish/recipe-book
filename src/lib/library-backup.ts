import { mkdir, readdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { uploadsRoot } from "@/lib/uploads";

export const LIBRARY_BACKUP_VERSION = 1 as const;

export type LibraryBackupRecipe = {
  title: string;
  description: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  vegPortions: number | null;
  allowWeeklyRepeat: boolean;
  sourceUrl: string | null;
  category: string | null;
  tags: string[];
  ingredients: {
    sortOrder: number;
    quantity: string | null;
    unit: string | null;
    name: string;
    note: string | null;
  }[];
  steps: { sortOrder: number; body: string }[];
  images: {
    sortOrder: number;
    filename: string;
    mime: string;
    data: string; // base64
  }[];
};

export type LibraryBackupFile = {
  version: typeof LIBRARY_BACKUP_VERSION;
  kind: "recipe-book-library";
  exportedAt: string;
  householdName: string;
  recipeCount: number;
  recipes: LibraryBackupRecipe[];
};

export function backupsRoot() {
  if (process.env.BACKUPS_DIR) return process.env.BACKUPS_DIR;
  // Prefer a folder on the uploads volume so snapshots survive without a
  // dedicated mount (Unraid can add /data/backups later for extra isolation).
  if (process.env.UPLOADS_DIR) {
    return path.join(
      /*turbopackIgnore: true*/ process.env.UPLOADS_DIR,
      "_library-backups",
    );
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "backups");
}

function mimeFromFilename(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

function resolveUploadPath(publicPath: string) {
  // Stored as `/uploads/{recipeId}/{file}`
  const cleaned = publicPath.replace(/^\/+/, "");
  if (cleaned.startsWith("uploads/")) {
    return path.join(
      /*turbopackIgnore: true*/ uploadsRoot(),
      ...cleaned.slice("uploads/".length).split("/"),
    );
  }
  return path.join(
    /*turbopackIgnore: true*/ uploadsRoot(),
    ...cleaned.split("/"),
  );
}

export async function buildLibraryBackup(
  householdId: string,
): Promise<LibraryBackupFile> {
  const household = await prisma.household.findUniqueOrThrow({
    where: { id: householdId },
  });

  const recipes = await prisma.recipe.findMany({
    where: { householdId },
    include: {
      category: true,
      ingredients: { orderBy: { sortOrder: "asc" } },
      steps: { orderBy: { sortOrder: "asc" } },
      tags: { include: { tag: true } },
      images: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { title: "asc" },
  });

  const out: LibraryBackupRecipe[] = [];

  for (const r of recipes) {
    const images: LibraryBackupRecipe["images"] = [];
    for (const img of r.images) {
      try {
        const abs = resolveUploadPath(img.path);
        const buf = await readFile(/*turbopackIgnore: true*/ abs);
        const filename = path.basename(img.path) || `image-${img.sortOrder}.jpg`;
        images.push({
          sortOrder: img.sortOrder,
          filename,
          mime: mimeFromFilename(filename),
          data: buf.toString("base64"),
        });
      } catch {
        /* missing file — still export the recipe text */
      }
    }

    out.push({
      title: r.title,
      description: r.description,
      servings: r.servings,
      prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes,
      vegPortions: r.vegPortions,
      allowWeeklyRepeat: r.allowWeeklyRepeat,
      sourceUrl: r.sourceUrl,
      category: r.category?.name ?? null,
      tags: r.tags.map((t) => t.tag.name),
      ingredients: r.ingredients.map((i) => ({
        sortOrder: i.sortOrder,
        quantity: i.quantity == null ? null : i.quantity.toString(),
        unit: i.unit,
        name: i.name,
        note: i.note,
      })),
      steps: r.steps.map((s) => ({
        sortOrder: s.sortOrder,
        body: s.body,
      })),
      images,
    });
  }

  return {
    version: LIBRARY_BACKUP_VERSION,
    kind: "recipe-book-library",
    exportedAt: new Date().toISOString(),
    householdName: household.name,
    recipeCount: out.length,
    recipes: out,
  };
}

export function parseLibraryBackup(raw: unknown): LibraryBackupFile {
  if (!raw || typeof raw !== "object") {
    throw new Error("Backup file is not valid JSON");
  }
  const data = raw as Record<string, unknown>;
  if (data.kind !== "recipe-book-library") {
    throw new Error("Not a Recipe Book library backup");
  }
  if (data.version !== LIBRARY_BACKUP_VERSION) {
    throw new Error(`Unsupported backup version (${String(data.version)})`);
  }
  if (!Array.isArray(data.recipes)) {
    throw new Error("Backup has no recipes list");
  }
  return data as LibraryBackupFile;
}

function householdBackupDir(householdId: string) {
  return path.join(
    /*turbopackIgnore: true*/ backupsRoot(),
    householdId,
  );
}

export async function writeLibraryBackupToDisk(
  householdId: string,
  backup?: LibraryBackupFile,
): Promise<{ filename: string; absolutePath: string; recipeCount: number }> {
  const payload = backup ?? (await buildLibraryBackup(householdId));
  const dir = householdBackupDir(householdId);
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });

  const stamp = payload.exportedAt.slice(0, 10);
  const filename = `library-${stamp}.json`;
  const absolutePath = path.join(/*turbopackIgnore: true*/ dir, filename);
  await writeFile(
    /*turbopackIgnore: true*/ absolutePath,
    JSON.stringify(payload),
    "utf8",
  );

  await pruneOldBackups(householdId, 14);
  return {
    filename,
    absolutePath,
    recipeCount: payload.recipeCount,
  };
}

async function pruneOldBackups(householdId: string, keep: number) {
  const dir = householdBackupDir(householdId);
  let entries: string[];
  try {
    entries = await readdir(/*turbopackIgnore: true*/ dir);
  } catch {
    return;
  }
  const files = entries
    .filter((f) => /^library-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  for (const old of files.slice(keep)) {
    try {
      await unlink(/*turbopackIgnore: true*/ path.join(dir, old));
    } catch {
      /* ignore */
    }
  }
}

export async function listLibraryBackupsOnDisk(householdId: string) {
  const dir = householdBackupDir(householdId);
  let entries: string[];
  try {
    entries = await readdir(/*turbopackIgnore: true*/ dir);
  } catch {
    return [];
  }
  return entries
    .filter((f) => /^library-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse()
    .map((filename) => ({
      filename,
      date: filename.replace(/^library-|\.json$/g, ""),
    }));
}

export async function readLibraryBackupFromDisk(
  householdId: string,
  filename: string,
): Promise<LibraryBackupFile> {
  if (!/^library-\d{4}-\d{2}-\d{2}\.json$/.test(filename)) {
    throw new Error("Invalid backup filename");
  }
  const abs = path.join(
    /*turbopackIgnore: true*/ householdBackupDir(householdId),
    filename,
  );
  const text = await readFile(/*turbopackIgnore: true*/ abs, "utf8");
  return parseLibraryBackup(JSON.parse(text));
}

/** Write a dated backup if none exists for today (or force). */
export async function ensureDailyLibraryBackup(
  householdId: string,
  opts?: { force?: boolean },
) {
  const dir = householdBackupDir(householdId);
  const today = new Date().toISOString().slice(0, 10);
  const todaysFile = path.join(
    /*turbopackIgnore: true*/ dir,
    `library-${today}.json`,
  );
  if (!opts?.force) {
    try {
      await readFile(/*turbopackIgnore: true*/ todaysFile);
      return { skipped: true as const, filename: `library-${today}.json` };
    } catch {
      /* need write */
    }
  }
  const written = await writeLibraryBackupToDisk(householdId);
  return { skipped: false as const, ...written };
}

export async function importLibraryBackup(
  householdId: string,
  userId: string,
  backup: LibraryBackupFile,
  opts?: { skipExistingTitles?: boolean },
) {
  const skipExisting = opts?.skipExistingTitles !== false;

  const existing = await prisma.recipe.findMany({
    where: { householdId },
    select: { title: true },
  });
  const existingTitles = new Set(
    existing.map((r) => r.title.trim().toLowerCase()),
  );

  let imported = 0;
  let skipped = 0;

  for (const recipe of backup.recipes) {
    const title = String(recipe.title || "").trim();
    if (!title) {
      skipped += 1;
      continue;
    }
    if (skipExisting && existingTitles.has(title.toLowerCase())) {
      skipped += 1;
      continue;
    }

    let categoryId: string | null = null;
    if (recipe.category?.trim()) {
      const catName = recipe.category.trim();
      const cat = await prisma.category.findFirst({
        where: {
          householdId,
          OR: [
            { name: { equals: catName, mode: "insensitive" } },
            { slug: slugify(catName) },
          ],
        },
      });
      categoryId = cat?.id ?? null;
    }

    const tagConnect: { tagId: string }[] = [];
    for (const tagName of recipe.tags || []) {
      const name = String(tagName).trim();
      if (!name) continue;
      const slug = slugify(name);
      const tag = await prisma.tag.upsert({
        where: { householdId_slug: { householdId, slug } },
        create: { householdId, name, slug },
        update: {},
      });
      tagConnect.push({ tagId: tag.id });
    }

    const ingredients = (recipe.ingredients || []).map((ing, idx) => ({
      sortOrder: ing.sortOrder ?? idx,
      quantity:
        ing.quantity == null || ing.quantity === ""
          ? null
          : ing.quantity,
      unit: ing.unit || null,
      name: String(ing.name || "").trim() || "ingredient",
      note: ing.note || null,
    }));

    const steps = (recipe.steps || [])
      .map((s, idx) => ({
        sortOrder: s.sortOrder ?? idx,
        body: String(s.body || "").trim(),
      }))
      .filter((s) => s.body);

    const created = await prisma.recipe.create({
      data: {
        householdId,
        createdById: userId,
        title,
        description: recipe.description || null,
        servings: recipe.servings > 0 ? recipe.servings : 4,
        prepMinutes: recipe.prepMinutes ?? null,
        cookMinutes: recipe.cookMinutes ?? null,
        vegPortions: recipe.vegPortions ?? null,
        allowWeeklyRepeat: !!recipe.allowWeeklyRepeat,
        sourceUrl: recipe.sourceUrl || null,
        categoryId,
        ingredients: { create: ingredients },
        steps: { create: steps },
        tags: { create: tagConnect },
      },
    });

    existingTitles.add(title.toLowerCase());

    for (const [idx, img] of (recipe.images || []).entries()) {
      if (!img?.data) continue;
      try {
        const buf = Buffer.from(img.data, "base64");
        if (buf.length < 50) continue;
        const safeName =
          (img.filename || `image-${idx}.jpg`).replace(/[^\w.-]+/g, "_") ||
          `image-${idx}.jpg`;
        const dir = path.join(
          /*turbopackIgnore: true*/ uploadsRoot(),
          created.id,
        );
        await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
        await writeFile(
          /*turbopackIgnore: true*/ path.join(dir, safeName),
          buf,
        );
        await prisma.recipeImage.create({
          data: {
            recipeId: created.id,
            path: `/uploads/${created.id}/${safeName}`,
            sortOrder: img.sortOrder ?? idx,
          },
        });
      } catch (err) {
        console.error("Failed to restore recipe image", title, err);
      }
    }

    imported += 1;
  }

  return { imported, skipped, total: backup.recipes.length };
}
