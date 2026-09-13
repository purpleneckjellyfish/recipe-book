"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/session";
import { uploadsRoot } from "@/lib/uploads";

export async function uploadRecipePhoto(recipeId: string, formData: FormData) {
  const { household } = await requireHousehold();
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, householdId: household.id },
  });
  if (!recipe) throw new Error("Recipe not found");

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a photo");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const dir = path.join(/*turbopackIgnore: true*/ uploadsRoot(), recipeId);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}.${safeExt}`;
  const full = path.join(/*turbopackIgnore: true*/ dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(full, buffer);

  const publicPath = `/uploads/${recipeId}/${filename}`;
  const count = await prisma.recipeImage.count({ where: { recipeId } });
  await prisma.recipeImage.create({
    data: { recipeId, path: publicPath, sortOrder: count },
  });

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/library");
}
