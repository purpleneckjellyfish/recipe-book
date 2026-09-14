import Link from "next/link";
import { isSignupBootstrapAllowed } from "@/lib/signup-gate";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const bootstrap = await isSignupBootstrapAllowed();

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 font-display text-center text-2xl font-bold">
        Recipe Book
      </Link>
      <div className="surface animate-rise rounded-[1.75rem] p-6 sm:p-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {bootstrap ? "Create your kitchen" : "Join with an invite"}
        </h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          {bootstrap
            ? "First account becomes the household owner. After that, signup is invite-only."
            : "Ask your household owner for an invite code from Settings."}
        </p>
        <div className="mt-6">
          <SignupForm
            bootstrap={bootstrap}
            defaultInvite={invite?.trim() || ""}
          />
        </div>
      </div>
    </div>
  );
}
