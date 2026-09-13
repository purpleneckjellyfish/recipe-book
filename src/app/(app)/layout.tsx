import { AppNav } from "@/components/AppNav";
import { SignOutButton } from "@/components/SignOutButton";
import { requireHousehold } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, household } = await requireHousehold();

  return (
    <div className="relative z-10 min-h-screen">
      <AppNav
        householdName={household.name}
        userName={session.user.name}
      />
      <div className="mx-auto flex max-w-6xl justify-end px-4 pt-3 sm:px-6">
        <SignOutButton />
      </div>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">{children}</main>
    </div>
  );
}
