import { ExportLibraryButtons } from "@/components/ExportLibraryButtons";
import { HouseholdControls } from "@/components/HouseholdControls";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/session";

export default async function HouseholdPage() {
  const { household, membership } = await requireHousehold();

  const [members, pantry, mealTypes, invites] = await Promise.all([
    prisma.householdMember.findMany({
      where: { householdId: household.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pantryStaple.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
    }),
    prisma.mealType.findMany({
      where: { householdId: household.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.householdInvite.findMany({
      where: { householdId: household.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-8">
      <section className="animate-rise">
        <p className="chip mb-3">Shared kitchen</p>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {household.name}
        </h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Everyone here sees the same recipes, plans, and lists.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface animate-rise animate-rise-delay-1 rounded-[1.5rem] p-5">
          <h2 className="font-display text-xl font-bold">Members</h2>
          <ul className="mt-4 space-y-3">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-2xl bg-white/60 px-3 py-3"
              >
                <div>
                  <p className="font-semibold">{m.user.name}</p>
                  <p className="text-xs text-[var(--ink-soft)]">{m.user.email}</p>
                </div>
                <span className="chip">{m.role === "OWNER" ? "Owner" : "Member"}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-rise animate-rise-delay-2">
          <ExportLibraryButtons />
        </div>
      </div>

      <HouseholdControls
        isOwner={membership.role === "OWNER"}
        householdName={household.name}
        pantry={pantry}
        mealTypes={mealTypes.map((m) => ({
          id: m.id,
          name: m.name,
          enabled: m.enabled,
        }))}
        invites={invites.map((i) => ({
          id: i.id,
          code: i.code,
          expiresAt: i.expiresAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
