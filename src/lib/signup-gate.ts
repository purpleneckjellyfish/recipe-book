import { prisma } from "@/lib/prisma";

/** email → householdId for the in-flight invite signup */
const pendingInvites = new Map<string, string>();

export function setPendingInviteHousehold(email: string, householdId: string) {
  pendingInvites.set(email.trim().toLowerCase(), householdId);
}

export function takePendingInviteHousehold(email: string): string | null {
  const key = email.trim().toLowerCase();
  const id = pendingInvites.get(key) ?? null;
  if (id) pendingInvites.delete(key);
  return id;
}

export function peekPendingInviteHousehold(email: string): string | null {
  return pendingInvites.get(email.trim().toLowerCase()) ?? null;
}

export async function isSignupBootstrapAllowed() {
  if (process.env.ALLOW_PUBLIC_SIGNUP === "true") return true;
  const count = await prisma.user.count();
  return count === 0;
}

export async function findValidInvite(code: string) {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const invite = await prisma.householdInvite.findFirst({
    where: { code: { equals: trimmed, mode: "insensitive" } },
  });
  if (!invite) return null;
  if (invite.expiresAt && invite.expiresAt < new Date()) return null;
  return invite;
}

/**
 * Gate public sign-up: first user (or ALLOW_PUBLIC_SIGNUP), else valid invite.
 * Stashes household id for the post-create hook when invite is used.
 */
export async function gateSignUp(opts: {
  email: string;
  inviteCode?: string | null;
}) {
  const email = opts.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required");

  if (await isSignupBootstrapAllowed()) {
    return { mode: "bootstrap" as const };
  }

  const invite = await findValidInvite(String(opts.inviteCode || ""));
  if (!invite) {
    throw new Error(
      "Signup is invite-only. Ask your household owner for an invite code.",
    );
  }

  setPendingInviteHousehold(email, invite.householdId);
  return { mode: "invite" as const, householdId: invite.householdId };
}
