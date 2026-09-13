import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function buildRecipePdf(opts: {
  title: string;
  description?: string | null;
  servings: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  ingredients: string[];
  steps: string[];
  tags?: string[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  const margin = 48;
  let y = 794;

  const ink = rgb(0.07, 0.15, 0.12);
  const soft = rgb(0.25, 0.35, 0.3);

  function ensureSpace(needed: number) {
    if (y - needed < margin) {
      page = doc.addPage([595, 842]);
      y = 794;
    }
  }

  function write(text: string, size: number, f = font, color = ink) {
    const width = 595 - margin * 2;
    const words = text.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > width) {
        ensureSpace(size + 6);
        page.drawText(line, { x: margin, y, size, font: f, color });
        y -= size + 6;
        line = word;
      } else {
        line = next;
      }
    }
    if (line) {
      ensureSpace(size + 6);
      page.drawText(line, { x: margin, y, size, font: f, color });
      y -= size + 8;
    }
  }

  write(opts.title, 22, bold);
  y -= 4;
  const meta = [
    `Serves ${opts.servings}`,
    opts.prepMinutes != null ? `Prep ${opts.prepMinutes}m` : null,
    opts.cookMinutes != null ? `Cook ${opts.cookMinutes}m` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  write(meta, 11, font, soft);
  if (opts.tags?.length) write(`Tags: ${opts.tags.join(", ")}`, 10, font, soft);
  if (opts.description) {
    y -= 4;
    write(opts.description, 11, font, soft);
  }

  y -= 8;
  write("Ingredients", 14, bold);
  for (const line of opts.ingredients) write(`• ${line}`, 11);

  y -= 8;
  write("Method", 14, bold);
  opts.steps.forEach((step, i) => write(`${i + 1}. ${step}`, 11));

  y -= 16;
  write("Shared from Recipe Book — no account required to read this.", 9, font, soft);

  return doc.save();
}

export function recipePlainText(opts: {
  title: string;
  description?: string | null;
  servings: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  ingredients: string[];
  steps: string[];
}): string {
  const lines = [
    opts.title,
    "",
    `Serves ${opts.servings}` +
      (opts.prepMinutes != null ? ` · Prep ${opts.prepMinutes}m` : "") +
      (opts.cookMinutes != null ? ` · Cook ${opts.cookMinutes}m` : ""),
    opts.description ? `\n${opts.description}` : "",
    "",
    "Ingredients",
    ...opts.ingredients.map((i) => `- ${i}`),
    "",
    "Method",
    ...opts.steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    "— Shared from Recipe Book",
  ];
  return lines.filter((l, idx) => !(l === "" && lines[idx - 1] === "")).join("\n");
}
