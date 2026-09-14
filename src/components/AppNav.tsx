"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(244,247,245,0.96)] pt-[env(safe-area-inset-top)] md:bg-[rgba(244,247,245,0.92)] md:backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
        <Link href="/home" className="group flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[var(--leaf-deep)] text-xs font-bold text-white shadow-[0_10px_24px_rgba(30,74,60,0.28)] transition group-hover:scale-[1.03] sm:h-10 sm:w-10 sm:text-sm">
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
                  ? "bg-[var(--leaf-deep)] text-white"
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
            className="btn btn-primary hidden px-3 py-2 text-sm sm:inline-flex sm:px-4"
          >
            Add recipe
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-xl border border-[var(--line)] bg-white/70 text-[var(--ink)] touch-manipulation md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="flex w-5 flex-col gap-1.5" aria-hidden>
              <span
                className={`h-0.5 w-full rounded-full bg-current transition ${
                  open ? "translate-y-2 rotate-45" : ""
                }`}
              />
              <span
                className={`h-0.5 w-full rounded-full bg-current transition ${
                  open ? "opacity-0" : ""
                }`}
              />
              <span
                className={`h-0.5 w-full rounded-full bg-current transition ${
                  open ? "-translate-y-2 -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(18,38,31,0.35)]"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 top-0 border-b border-[var(--line)] bg-[var(--paper)] px-4 pb-6 pt-[calc(env(safe-area-inset-top)+4.5rem)] shadow-[var(--shadow)]">
            <nav className="mx-auto flex max-w-6xl flex-col gap-1">
              {links.map((link) => {
                const active = link.match(pathname);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-2xl px-4 py-3.5 text-base font-semibold touch-manipulation ${
                      active
                        ? "bg-[var(--leaf-deep)] text-white"
                        : "text-[var(--ink)] active:bg-[var(--mist)]"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <Link
                href="/recipes/new"
                className="mt-2 rounded-2xl bg-[var(--leaf-deep)] px-4 py-3.5 text-center text-base font-semibold text-white touch-manipulation"
              >
                Add recipe
              </Link>
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
