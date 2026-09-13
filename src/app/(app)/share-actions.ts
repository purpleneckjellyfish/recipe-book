"use server";

import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { buildRecipePdf, recipePlainText } from "@/lib/recipe-export";
import { formatQuantity } from "@/lib/scale";
import { requireHousehold } from "@/lib/session";

async function loadRecipe(recipeId: string) {
  const { household } = await requireHousehold();
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, householdId: household.id },
    include: {
      ingredients: { orderBy: { sortOrder: "asc" } },
      steps: { orderBy: { sortOrder: "asc" } },
      tags: { include: { tag: true } },
    },
  });
  if (!recipe) throw new Error("Recipe not found");
  return recipe;
}

function toPayload(recipe: Awaited<ReturnType<typeof loadRecipe>>) {
  const ingredients = recipe.ingredients.map((ing) => {
    const qty = ing.quantity == null ? null : Number(ing.quantity.toString());
    const left = formatQuantity(qty, ing.unit);
    return left ? `${left} ${ing.name}` : ing.name;
  });
  const steps = recipe.steps.map((s) => s.body);
  return {
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    ingredients,
    steps,
    tags: recipe.tags.map((t) => t.tag.name),
  };
}

export async function getRecipePdfBase64(recipeId: string) {
  const recipe = await loadRecipe(recipeId);
  const pdf = await buildRecipePdf(toPayload(recipe));
  return {
    filename: `${recipe.title.replace(/[^\w\s-]+/g, "").trim() || "recipe"}.pdf`,
    base64: Buffer.from(pdf).toString("base64"),
  };
}

export async function getRecipeText(recipeId: string) {
  const recipe = await loadRecipe(recipeId);
  return recipePlainText(toPayload(recipe));
}

export async function emailRecipe(recipeId: string, toEmail: string) {
  const recipe = await loadRecipe(recipeId);
  const payload = toPayload(recipe);
  const text = recipePlainText(payload);
  const pdf = await buildRecipePdf(payload);

  const host = process.env.SMTP_HOST;
  if (!host) {
    throw new Error(
      "SMTP is not configured. Download the PDF or copy text instead, or set SMTP_* in .env.",
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: `Recipe: ${recipe.title}`,
    text,
    attachments: [
      {
        filename: `${recipe.title}.pdf`,
        content: Buffer.from(pdf),
        contentType: "application/pdf",
      },
    ],
  });

  return { ok: true };
}

export async function exportLibraryCsv() {
  const { household } = await requireHousehold();
  const recipes = await prisma.recipe.findMany({
    where: { householdId: household.id },
    include: {
      category: true,
      ingredients: { orderBy: { sortOrder: "asc" } },
      steps: { orderBy: { sortOrder: "asc" } },
      tags: { include: { tag: true } },
      ratings: true,
    },
    orderBy: { title: "asc" },
  });

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [
    [
      "title",
      "category",
      "servings",
      "prepMinutes",
      "cookMinutes",
      "vegPortions",
      "tags",
      "avgRating",
      "ingredients",
      "steps",
      "description",
    ].join(","),
  ];

  for (const r of recipes) {
    const avg =
      r.ratings.length > 0
        ? (
            r.ratings.reduce((s, x) => s + x.score, 0) / r.ratings.length
          ).toFixed(2)
        : "";
    rows.push(
      [
        escape(r.title),
        escape(r.category?.name || ""),
        String(r.servings),
        String(r.prepMinutes ?? ""),
        String(r.cookMinutes ?? ""),
        String(r.vegPortions ?? ""),
        escape(r.tags.map((t) => t.tag.name).join("; ")),
        avg,
        escape(
          r.ingredients
            .map((i) => {
              const q = i.quantity == null ? "" : i.quantity.toString();
              return [q, i.unit, i.name].filter(Boolean).join(" ");
            })
            .join(" | "),
        ),
        escape(r.steps.map((s) => s.body).join(" | ")),
        escape(r.description || ""),
      ].join(","),
    );
  }

  return {
    filename: `recipe-book-${household.name.replace(/\s+/g, "-").toLowerCase()}.csv`,
    csv: rows.join("\n"),
  };
}

export async function exportLibraryPdfBase64() {
  const { household } = await requireHousehold();
  const recipes = await prisma.recipe.findMany({
    where: { householdId: household.id },
    include: {
      ingredients: { orderBy: { sortOrder: "asc" } },
      steps: { orderBy: { sortOrder: "asc" } },
      tags: { include: { tag: true } },
    },
    orderBy: { title: "asc" },
  });

  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const cover = doc.addPage([595, 842]);
  cover.drawText("Recipe Book", {
    x: 48,
    y: 720,
    size: 28,
    font: bold,
    color: rgb(0.07, 0.15, 0.12),
  });
  cover.drawText(household.name, {
    x: 48,
    y: 680,
    size: 16,
    font,
    color: rgb(0.25, 0.35, 0.3),
  });
  cover.drawText(`${recipes.length} recipes · family archive export`, {
    x: 48,
    y: 650,
    size: 12,
    font,
    color: rgb(0.25, 0.35, 0.3),
  });

  for (const recipe of recipes) {
    const ingredients = recipe.ingredients.map((ing) => {
      const qty = ing.quantity == null ? null : Number(ing.quantity.toString());
      const left = formatQuantity(qty, ing.unit);
      return left ? `${left} ${ing.name}` : ing.name;
    });
    const bytes = await buildRecipePdf({
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      ingredients,
      steps: recipe.steps.map((s) => s.body),
      tags: recipe.tags.map((t) => t.tag.name),
    });
    const src = await PDFDocument.load(bytes);
    const pages = await doc.copyPages(src, src.getPageIndices());
    pages.forEach((p) => doc.addPage(p));
  }

  const out = await doc.save();
  return {
    filename: `recipe-book-archive.pdf`,
    base64: Buffer.from(out).toString("base64"),
  };
}
