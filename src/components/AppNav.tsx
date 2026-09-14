"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/home", label: "Home", match: (path: string) => path === "/home" },
  {
    href: "/library",
    label: "Library",
    match: (path: string) =>
      path === "/library" || path.startsWith("/recipes"),
  },
  { href: "/plan", label: "Plan", match: (path: string) => path === "/plan" },
  { href: "/shop", label: "Shop", match: (path: string) => path === "/shop" },
  {
    href: "/settings",
    label: "Settings",
    match: (path: string) =>
      path === "/settings" || path === "/household",
  },
];

export function AppNav({
  householdName,
  userName,
}: {
  householdName: string;
  userName: string;
}) {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(244,247,245,0.92)] backdrop-blur-xl pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
          <Link href="/home" className="group flex min-w-0 items-center gap-2.5 sm:gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[var(--leaf-deep)] text-xs font-bold text-[#f7fbf8] shadow-[0_10px_24px_rgba(30,74,60,0.28)] transition group-hover:scale-[1.03] sm:h-10 sm:w-10 sm:text-sm">
              RB
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-base font-bold tracking-tight text-[var(--ink)] sm:text-lg">
                Recipe Book
              </p>
              <p className="truncate text-xs text-[var(--ink-soft)]">
                {householdName}
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  link.match(pathname)
                    ? "bg-[var(--leaf-deep)] text-[#f7fbf8]"
                    : "text-[var(--ink-soft)] hover:bg-white/60 hover:text-[var(--ink)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-[var(--ink-soft)] lg:inline">
              {userName}
            </span>
            <Link
              href="/recipes/new"
              className="btn btn-primary px-3 py-2 text-sm sm:px-4"
              aria-label="Add recipe"
            >
              <span className="sm:hidden">+</span>
              <span className="hidden sm:inline">Add recipe</span>
            </Link>
          </div>
        </div>
      </header>

      <nav
        className="mobile-tab-bar fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-[rgba(244,247,245,0.94)] backdrop-blur-xl md:hidden"
        aria-label="Main"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-5 gap-0 px-1">
          {links.map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-center transition touch-manipulation ${
                  active
                    ? "text-[var(--leaf-deep)]"
                    : "text-[var(--ink-soft)] active:bg-white/70"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={`h-1 w-8 rounded-full transition ${
                    active ? "bg-[var(--leaf-deep)]" : "bg-transparent"
                  }`}
                  aria-hidden
                />
                <span className="text-[0.68rem] font-bold leading-none tracking-tight">
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
