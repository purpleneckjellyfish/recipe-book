"use server";

import { revalidatePath } from "next/cache";
import {
  buildLibraryBackup,
  ensureDailyLibraryBackup,
  importLibraryBackup,
  listLibraryBackupsOnDisk,
  parseLibraryBackup,
  readLibraryBackupFromDisk,
  writeLibraryBackupToDisk,
} from "@/lib/library-backup";
import { requireHousehold } from "@/lib/session";

export async function exportLibraryJson() {
  const { household } = await requireHousehold();
  const backup = await buildLibraryBackup(household.id);
  // Also keep a server-side copy whenever someone downloads.
  await writeLibraryBackupToDisk(household.id, backup).catch((err) => {
    console.error("Server library backup write failed", err);
  });
  const safeName = household.name.replace(/\s+/g, "-").toLowerCase() || "kitchen";
  return {
    filename: `recipe-book-${safeName}-${backup.exportedAt.slice(0, 10)}.json`,
    json: JSON.stringify(backup, null, 2),
    recipeCount: backup.recipeCount,
  };
}

export async function saveLibraryBackupOnServer() {
  const { household } = await requireHousehold();
  const written = await writeLibraryBackupToDisk(household.id);
  return {
    filename: written.filename,
    recipeCount: written.recipeCount,
  };
}

export async function listServerLibraryBackups() {
  const { household } = await requireHousehold();
  return listLibraryBackupsOnDisk(household.id);
}

export async function downloadServerLibraryBackup(filename: string) {
  const { household } = await requireHousehold();
  const backup = await readLibraryBackupFromDisk(household.id, filename);
  return {
    filename,
    json: JSON.stringify(backup, null, 2),
    recipeCount: backup.recipeCount,
  };
}

export async function importLibraryJson(jsonText: string) {
  const { session, household } = await requireHousehold();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Could not read that file — it needs to be a .json backup");
  }
  const backup = parseLibraryBackup(parsed);
  const result = await importLibraryBackup(
    household.id,
    session.user.id,
    backup,
  );
  revalidatePath("/library");
  revalidatePath("/home");
  revalidatePath("/settings");
  return result;
}

/** Fire-and-forget daily snapshot when Settings is opened. */
export async function maybeWriteDailyLibraryBackup() {
  const { household } = await requireHousehold();
  return ensureDailyLibraryBackup(household.id);
}
