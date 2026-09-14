"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { registerWithInvite } from "./actions";

export function SignupForm({
  bootstrap,
  defaultInvite,
}: {
  bootstrap: boolean;
  defaultInvite: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "");
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const inviteCode = String(form.get("inviteCode") || "").trim();

    try {
      if (bootstrap) {
        const result = await authClient.signUp.email({ name, email, password });
        if (result.error) {
          setError(result.error.message || "Could not create account");
          setPending(false);
          return;
        }
      } else {
        if (!inviteCode) {
          setError("An invite code is required");
          setPending(false);
          return;
        }
        await registerWithInvite({ name, email, password, inviteCode });
        const result = await authClient.signIn.email({ email, password });
        if (result.error) {
          setError(
            result.error.message ||
              "Account created — please sign in on the login page",
          );
          setPending(false);
          return;
        }
      }
      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4">
        {!bootstrap ? (
          <div>
            <label className="label" htmlFor="inviteCode">
              Invite code
            </label>
            <input
              className="field"
              id="inviteCode"
              name="inviteCode"
              required
              defaultValue={defaultInvite}
              autoComplete="off"
              placeholder="Paste the code from your household"
            />
          </div>
        ) : null}
        <div>
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input
            className="field"
            id="name"
            name="name"
            required
            autoComplete="name"
          />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            className="field"
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            className="field"
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        {error ? (
          <p className="rounded-xl bg-[rgba(212,120,74,0.15)] px-3 py-2 text-sm text-[var(--ink)]">
            {error}
          </p>
        ) : null}
        <button className="btn btn-primary w-full" disabled={pending} type="submit">
          {pending
            ? "Creating…"
            : bootstrap
              ? "Create account"
              : "Join kitchen"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--ink-soft)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--leaf-deep)]">
          Sign in
        </Link>
      </p>
    </>
  );
}
