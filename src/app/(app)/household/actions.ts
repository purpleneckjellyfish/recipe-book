"use server";

import { revalidatePath } from "next/cache";
import { hashPassword } from "better-auth/crypto";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { requireHousehold, requireSession } from "@/lib/session";

function revalidateSettings() {
  revalidatePath("/settings");
  revalidatePath("/household");
  revalidatePath("/home");
  revalidatePath("/library");
  revalidatePath("/plan");
  revalidatePath("/shop");
}

/** Remove empty solo kitchens so invite/join lands people in the shared one. */
async function abandonEmptyOwnedHouseholds(
  userId: string,
  keepHouseholdId: string,
) {
  const memberships = await prisma.householdMember.findMany({
    where: {
      userId,
      role: "OWNER",
      householdId: { not: keepHouseholdId },
    },
    include: {
      household: {
        include: {
          _count: { select: { members: true, mealPlans: true } },
        },
      },
    },
  });

  for (const m of memberships) {
    const recipeCount = await prisma.recipe.count({
      where: { householdId: m.householdId },
    });
    // Only auto-remove unused personal kitchens (just them, no recipes).
    if (m.household._count.members <= 1 && recipeCount === 0) {
      await prisma.household.delete({ where: { id: m.householdId } });
    }
  }
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
  const trimmed = code.trim();
  if (!trimmed) throw new Error("Enter an invite code");

  const invite = await prisma.householdInvite.findFirst({
    where: { code: { equals: trimmed, mode: "insensitive" } },
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

  await abandonEmptyOwnedHouseholds(session.user.id, invite.householdId);
  revalidateSettings();
  return invite.householdId;
}

/**
 * Owner creates a login for someone in this kitchen (same recipe book).
 * Prefer this over invite codes when you're setting up family on one device.
 */
export async function createHouseholdMember(opts: {
  name: string;
  email: string;
  password: string;
}) {
  const { membership, household } = await requireHousehold();
  if (membership.role !== "OWNER") {
    throw new Error("Only owners can add household members");
  }

  const name = opts.name.trim();
  const email = opts.email.trim().toLowerCase();
  const password = opts.password;
  if (!name) throw new Error("Name is required");
  if (!email.includes("@")) throw new Error("Enter a valid email");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    const already = await prisma.householdMember.findUnique({
      where: {
        householdId_userId: {
          householdId: household.id,
          userId: existingUser.id,
        },
      },
    });
    if (already) {
      throw new Error("That person is already in this kitchen");
    }
    await prisma.householdMember.create({
      data: {
        householdId: household.id,
        userId: existingUser.id,
        role: "MEMBER",
      },
    });
    await abandonEmptyOwnedHouseholds(existingUser.id, household.id);
    revalidateSettings();
    return { userId: existingUser.id, created: false };
  }

  const userId = nanoid();
  const hashed = await hashPassword(password);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: userId,
        name,
        email,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.account.create({
      data: {
        id: nanoid(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashed,
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.householdMember.create({
      data: {
        householdId: household.id,
        userId,
        role: "MEMBER",
      },
    });
  });

  revalidateSettings();
  return { userId, created: true };
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
