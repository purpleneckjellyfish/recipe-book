"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignupPage() {
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

    const result = await authClient.signUp.email({ name, email, password });
    if (result.error) {
      setError(result.error.message || "Could not create account");
      setPending(false);
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <AuthShell
      title="Create your kitchen"
      subtitle="Start a household recipe archive you can share with family."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input className="field" id="name" name="name" required autoComplete="name" />
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
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--ink-soft)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--leaf-deep)]">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 font-display text-center text-2xl font-bold">
        Recipe Book
      </Link>
      <div className="surface animate-rise rounded-[1.75rem] p-6 sm:p-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-[var(--ink-soft)]">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
