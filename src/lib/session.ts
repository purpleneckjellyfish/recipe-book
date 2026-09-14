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
  // Newest membership first so invite/join and “add member” land on the shared kitchen.
  const membership = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: true },
    orderBy: { createdAt: "desc" },
  });
  return membership;
}

export async function requireHousehold() {
  const session = await requireSession();
  const membership = await getActiveHousehold(session.user.id);
  if (!membership) redirect("/onboarding");
  return { session, membership, household: membership.household };
}
