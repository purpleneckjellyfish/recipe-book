import { redirect } from "next/navigation";

/** Old path — settings now lives at /settings. */
export default function HouseholdRedirect() {
  redirect("/settings");
}
