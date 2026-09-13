"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");

    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message || "Could not sign in");
      setPending(false);
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 font-display text-center text-2xl font-bold">
        Recipe Book
      </Link>
      <div className="surface animate-rise rounded-[1.75rem] p-6 sm:p-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Sign in to your household kitchen.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
              autoComplete="current-password"
            />
          </div>
          {error ? (
            <p className="rounded-xl bg-[rgba(212,120,74,0.15)] px-3 py-2 text-sm">
              {error}
            </p>
          ) : null}
          <button className="btn btn-primary w-full" disabled={pending} type="submit">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--ink-soft)]">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-[var(--leaf-deep)]">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
