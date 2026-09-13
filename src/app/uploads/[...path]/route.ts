import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await ctx.params;
  const safe = parts.map((p) => p.replace(/[^a-zA-Z0-9._-]/g, ""));
  if (safe.some((p, i) => p !== parts[i])) {
    return new NextResponse("Bad path", { status: 400 });
  }

  const root =
    process.env.UPLOADS_DIR ||
    path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "uploads");
  const filePath = path.join(/*turbopackIgnore: true*/ root, ...safe);
  if (!filePath.startsWith(root)) {
    return new NextResponse("Bad path", { status: 400 });
  }

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
            ? "image/gif"
            : "image/jpeg";
    return new NextResponse(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
