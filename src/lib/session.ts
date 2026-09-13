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
  const membership = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: true },
    orderBy: { createdAt: "asc" },
  });
  return membership;
}

export async function requireHousehold() {
  const session = await requireSession();
  const membership = await getActiveHousehold(session.user.id);
  if (!membership) redirect("/onboarding");
  return { session, membership, household: membership.household };
}
