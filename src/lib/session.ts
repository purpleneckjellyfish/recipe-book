import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./prisma";

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session;
}

export async function getActiveHousehold(userId: string) {
  // Prefer the kitchen that actually has recipes so updates / multi-membership
  // never strand the user on an empty kitchen (library “vanishing”).
  // Tie-break: OWNER over MEMBER, then newest membership (invite/join).
  const memberships = await prisma.householdMember.findMany({
    where: { userId },
    include: {
      household: {
        include: { _count: { select: { recipes: true } } },
      },
    },
  });
  if (memberships.length === 0) return null;

  memberships.sort((a, b) => {
    const byRecipes =
      b.household._count.recipes - a.household._count.recipes;
    if (byRecipes !== 0) return byRecipes;
    const ownerScore = (role: string) => (role === "OWNER" ? 1 : 0);
    const byRole = ownerScore(b.role) - ownerScore(a.role);
    if (byRole !== 0) return byRole;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const best = memberships[0];
  const { _count: _, ...household } = best.household;
  return { ...best, household };
}

export async function requireHousehold() {
  const session = await requireSession();
  const membership = await getActiveHousehold(session.user.id);
  if (!membership) redirect("/onboarding");
  return { session, membership, household: membership.household };
}
