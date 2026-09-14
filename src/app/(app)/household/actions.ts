"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { requireHousehold, requireSession } from "@/lib/session";

function revalidateSettings() {
  revalidatePath("/settings");
  revalidatePath("/household");
  revalidatePath("/shop");
}

export async function createInvite() {
  const { membership, household } = await requireHousehold();
  if (membership.role !== "OWNER") {
    throw new Error("Only household owners can create invites");
  }
  const code = nanoid(10);
  await prisma.householdInvite.create({
    data: {
      householdId: household.id,
      code,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    },
  });
  revalidateSettings();
  return code;
}

export async function joinWithInvite(code: string) {
  const session = await requireSession();

  const invite = await prisma.householdInvite.findUnique({
    where: { code: code.trim() },
  });
  if (!invite) throw new Error("Invalid invite code");
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new Error("Invite has expired");
  }

  const existing = await prisma.householdMember.findUnique({
    where: {
      householdId_userId: {
        householdId: invite.householdId,
        userId: session.user.id,
      },
    },
  });
  if (!existing) {
    await prisma.householdMember.create({
      data: {
        householdId: invite.householdId,
        userId: session.user.id,
        role: "MEMBER",
      },
    });
  }

  revalidateSettings();
  revalidatePath("/library");
  return invite.householdId;
}

export async function renameHousehold(name: string) {
  const { membership, household } = await requireHousehold();
  if (membership.role !== "OWNER") throw new Error("Only owners can rename");
  await prisma.household.update({
    where: { id: household.id },
    data: { name: name.trim() || household.name },
  });
  revalidateSettings();
}

export async function addPantryStaple(name: string) {
  const { household } = await requireHousehold();
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return;
  await prisma.pantryStaple.upsert({
    where: {
      householdId_name: { householdId: household.id, name: trimmed },
    },
    create: { householdId: household.id, name: trimmed },
    update: {},
  });
  revalidateSettings();
}

export async function removePantryStaple(id: string) {
  const { household } = await requireHousehold();
  await prisma.pantryStaple.deleteMany({
    where: { id, householdId: household.id },
  });
  revalidateSettings();
}

export async function addPinnedShopItem(name: string) {
  const { household } = await requireHousehold();
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return;
  const max = await prisma.pinnedShopItem.aggregate({
    where: { householdId: household.id },
    _max: { sortOrder: true },
  });
  await prisma.pinnedShopItem.upsert({
    where: {
      householdId_name: { householdId: household.id, name: trimmed },
    },
    create: {
      householdId: household.id,
      name: trimmed,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
    update: {},
  });
  revalidateSettings();
}

export async function removePinnedShopItem(id: string) {
  const { household } = await requireHousehold();
  await prisma.pinnedShopItem.deleteMany({
    where: { id, householdId: household.id },
  });
  revalidateSettings();
}

export async function addMealType(name: string) {
  const { membership, household } = await requireHousehold();
  if (membership.role !== "OWNER") {
    throw new Error("Only owners can manage meal types");
  }
  const trimmed = name.trim();
  if (!trimmed) return;
  const { slugify } = await import("@/lib/slug");
  const slug = slugify(trimmed);
  const max = await prisma.mealType.aggregate({
    where: { householdId: household.id },
    _max: { sortOrder: true },
  });
  await prisma.mealType.upsert({
    where: {
      householdId_slug: { householdId: household.id, slug },
    },
    create: {
      householdId: household.id,
      name: trimmed,
      slug,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      enabled: true,
    },
    update: { name: trimmed, enabled: true },
  });
  revalidateSettings();
  revalidatePath("/plan");
}

export async function setMealTypeEnabled(id: string, enabled: boolean) {
  const { membership, household } = await requireHousehold();
  if (membership.role !== "OWNER") {
    throw new Error("Only owners can manage meal types");
  }
  await prisma.mealType.updateMany({
    where: { id, householdId: household.id },
    data: { enabled },
  });
  revalidateSettings();
  revalidatePath("/plan");
}
