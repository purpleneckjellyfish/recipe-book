import Link from "next/link";

const links = [
  { href: "/home", label: "Home" },
  { href: "/library", label: "Library" },
  { href: "/plan", label: "Plan" },
  { href: "/shop", label: "Shop" },
  { href: "/household", label: "Household" },
];

export function AppNav({
  householdName,
  userName,
}: {
  householdName: string;
  userName: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(244,247,245,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/home" className="group flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--leaf-deep)] text-sm font-bold text-[#f7fbf8] shadow-[0_10px_24px_rgba(30,74,60,0.28)] transition group-hover:scale-[1.03]">
            RB
          </span>
          <div className="leading-tight">
            <p className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">
              Recipe Book
            </p>
            <p className="text-xs text-[var(--ink-soft)]">{householdName}</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-sm font-semibold text-[var(--ink-soft)] transition hover:bg-white/60 hover:text-[var(--ink)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-[var(--ink-soft)] sm:inline">
            {userName}
          </span>
          <form action="/api/auth/sign-out" method="post" className="hidden" />
          <Link href="/recipes/new" className="btn btn-primary text-sm">
            Add recipe
          </Link>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-[var(--line)] px-2 py-2 md:hidden">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--ink-soft)] hover:bg-white/70"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
