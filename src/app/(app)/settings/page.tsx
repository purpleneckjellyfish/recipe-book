import { AdminUsersPanel } from "@/components/AdminUsersPanel";
import { ExportLibraryButtons } from "@/components/ExportLibraryButtons";
import { HouseholdControls } from "@/components/HouseholdControls";
import { SignOutButton } from "@/components/SignOutButton";
import { isAppAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/session";

export default async function SettingsPage() {
  const { household, membership, session } = await requireHousehold();
  const admin = isAppAdmin(session.user.email);

  const [members, pantry, pinnedShop, mealTypes, invites, allUsers] =
    await Promise.all([
      prisma.householdMember.findMany({
        where: { householdId: household.id },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.pantryStaple.findMany({
        where: { householdId: household.id },
        orderBy: { name: "asc" },
      }),
      prisma.pinnedShopItem.findMany({
        where: { householdId: household.id },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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
      admin
        ? prisma.user.findMany({
            include: {
              memberships: {
                include: { household: true },
                orderBy: { createdAt: "asc" },
              },
            },
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve([]),
    ]);

  return (
    <div className="space-y-8">
      <section className="animate-rise">
        <p className="chip mb-3">Kitchen setup</p>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Settings
        </h1>
        <p className="mt-2 max-w-xl text-[var(--ink-soft)]">
          Household, shopping habits, meal types, and library backup — kept in
          one place so the rest of the app stays tidy.
        </p>
      </section>

      {admin ? (
        <AdminUsersPanel
          viewerEmail={session.user.email}
          users={allUsers.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            createdAt: u.createdAt.toISOString(),
            kitchens: u.memberships.map((m) => ({
              name: m.household.name,
              role: m.role === "OWNER" ? "Owner" : "Member",
            })),
          }))}
        />
      ) : null}

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
                <span className="chip">
                  {m.role === "OWNER" ? "Owner" : "Member"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-rise animate-rise-delay-2 lg:col-span-2">
          <ExportLibraryButtons />
        </div>
      </div>

      <HouseholdControls
        isOwner={membership.role === "OWNER"}
        householdName={household.name}
        pantry={pantry}
        pinnedShop={pinnedShop.map((p) => ({
          id: p.id,
          name: p.name,
          quantity: p.quantity == null ? null : Number(p.quantity.toString()),
          unit: p.unit,
        }))}
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

      <section className="surface rounded-[1.5rem] p-5 md:hidden">
        <h2 className="font-display text-xl font-bold">Account</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Signed in as {session.user.email}.
        </p>
        <div className="mt-4 [&_.btn]:w-full">
          <SignOutButton />
        </div>
      </section>
    </div>
  );
}
