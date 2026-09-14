import { redirect } from "next/navigation";
import { bootstrapHousehold } from "@/lib/auth";
import { requireSession, getActiveHousehold } from "@/lib/session";

/** Creates a household if signup bootstrap was skipped, then continues into the app. */
export default async function OnboardingPage() {
  const session = await requireSession();
  const existing = await getActiveHousehold(session.user.id);
  if (existing) redirect("/home");

  await bootstrapHousehold(session.user.id, session.user.name || "Family");
  redirect("/home");
}
