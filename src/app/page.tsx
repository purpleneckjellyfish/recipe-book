import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/home");

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <p className="font-display text-xl font-bold tracking-tight">Recipe Book</p>
        <div className="flex gap-2">
          <Link href="/login" className="btn btn-primary text-sm">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-ghost text-sm">
            Have an invite?
          </Link>
        </div>
      </header>

      <section className="mt-16 grid flex-1 items-center gap-12 lg:mt-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-rise">
          <p className="chip mb-5">Household recipe library</p>
          <h1 className="font-display max-w-xl text-5xl font-bold leading-[1.05] tracking-tight text-[var(--ink)] sm:text-6xl">
            Recipe Book
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-[var(--ink-soft)]">
            Keep every family favourite in one place. Plan the week from your
            own recipes, build a shopping list, and share the library for years
            to come.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn btn-primary">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-ghost">
              Join with an invite
            </Link>
          </div>
        </div>

        <div className="surface animate-rise animate-rise-delay-1 relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[var(--leaf-soft)] blur-2xl" />
          <div className="absolute -bottom-10 -left-6 h-36 w-36 rounded-full bg-[rgba(212,120,74,0.2)] blur-2xl" />
          <div className="relative space-y-4">
            <div className="rounded-2xl bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--leaf)]">
                This week
              </p>
              <p className="mt-2 font-display text-2xl font-bold">5 evenings planned</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                2 vegetarian · 1 fish · leftovers Wednesday
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[var(--leaf-deep)] p-4 text-[#f7fbf8]">
                <p className="text-xs opacity-80">Shopping</p>
                <p className="mt-2 font-display text-xl font-bold">12 items</p>
              </div>
              <div className="rounded-2xl bg-white/70 p-4">
                <p className="text-xs text-[var(--ink-soft)]">Library</p>
                <p className="mt-2 font-display text-xl font-bold">Yours forever</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
