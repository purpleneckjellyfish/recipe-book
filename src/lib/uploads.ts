import { mkdir, writeFile } from "fs/promises";
import path from "path";

export function uploadsRoot() {
  if (process.env.UPLOADS_DIR) return process.env.UPLOADS_DIR;
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "uploads");
}

function extFromContentType(ct: string | null) {
  if (!ct) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  return "jpg";
}

function extFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.(jpg|jpeg|png|webp|gif)(?:$|\?)/);
    return match?.[1] === "jpeg" ? "jpg" : match?.[1] || null;
  } catch {
    return null;
  }
}

/** Download a remote recipe image into local uploads; returns public path or null. */
export async function storeRemoteImage(
  recipeId: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: imageUrl,
      },
      signal: AbortSignal.timeout(25000),
      redirect: "follow",
    });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) return null;

    const ext =
      extFromUrl(imageUrl) ||
      extFromContentType(res.headers.get("content-type")) ||
      "jpg";

    const dir = path.join(/*turbopackIgnore: true*/ uploadsRoot(), recipeId);
    await mkdir(dir, { recursive: true });
    const filename = `source-${Date.now()}.${ext}`;
    await writeFile(path.join(/*turbopackIgnore: true*/ dir, filename), buffer);
    return `/uploads/${recipeId}/${filename}`;
  } catch (err) {
    console.error("Failed to store remote image", imageUrl, err);
    return null;
  }
}
