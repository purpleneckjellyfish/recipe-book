"use server";

import { hashPassword } from "better-auth/crypto";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { findValidInvite } from "@/lib/signup-gate";

/**
 * Invite-only account creation (does not use open Better Auth sign-up).
 * Caller should sign in afterwards with the same email/password.
 */
export async function registerWithInvite(opts: {
  name: string;
  email: string;
  password: string;
  inviteCode: string;
}) {
  const name = opts.name.trim();
  const email = opts.email.trim().toLowerCase();
  const password = opts.password;
  const inviteCode = opts.inviteCode.trim();

  if (!name) throw new Error("Name is required");
  if (!email.includes("@")) throw new Error("Enter a valid email");
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const invite = await findValidInvite(inviteCode);
  if (!invite) {
    throw new Error("Invalid or expired invite code");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("That email already has an account — sign in instead");
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
        householdId: invite.householdId,
        userId,
        role: "MEMBER",
      },
    });
  });

  return { ok: true as const };
}
