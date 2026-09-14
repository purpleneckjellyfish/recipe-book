"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addFeaturedToArchive,
  addFeaturedToTry,
  addRecipeToTry,
  pinArchiveRecipeToDate,
  pinFeaturedToNextWeek,
  removeFromTry,
} from "@/app/(app)/home/actions";

type DayOpt = { iso: string; label: string };

type ArchiveCard = {
  id: string;
  title: string;
  imagePath: string | null;
  category: string | null;
  onToTry?: boolean;
};

type FeaturedCard = {
  sourceUrl: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  sourceLabel: string;
  servings: number | null;
};

type Tab = "ideas" | "try";

export function HomeClient({
  initialTab = "ideas",
  archivePicks,
  toTry,
  goodFood,
  bbcFood,
  nextWeekDays,
}: {
  initialTab?: Tab;
  archivePicks: ArchiveCard[];
  toTry: ArchiveCard[];
  goodFood: FeaturedCard[];
  bbcFood: FeaturedCard[];
  nextWeekDays: DayOpt[];
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="space-y-8">
      <section className="animate-rise">
        <p className="chip mb-3">Welcome back</p>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          What’s cooking?
        </h1>
        <p className="mt-2 max-w-xl text-[var(--ink-soft)]">
          Browse this week’s ideas, or park recipes in To try until you can fit
          them on the plan.
        </p>
      </section>

      <div
        role="tablist"
        aria-label="Home"
        className="grid grid-cols-2 gap-1 rounded-2xl bg-[var(--mist)] p-1 sm:max-w-md"
      >
        {(
          [
            { id: "ideas" as const, label: "Ideas", hint: "This week" },
            {
              id: "try" as const,
              label: "To try",
              hint: toTry.length ? `${toTry.length} saved` : "Parking list",
            },
          ] as const
        ).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(t.id);
                const url =
                  t.id === "try" ? "/home?tab=try" : "/home";
                window.history.replaceState(null, "", url);
              }}
              className={`rounded-xl px-3 py-3 text-center transition ${
                active
                  ? "bg-white shadow-sm"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              <span className="block text-sm font-bold">{t.label}</span>
              <span className="mt-0.5 block text-xs">{t.hint}</span>
            </button>
          );
        })}
      </div>

      {tab === "ideas" ? (
        <div className="space-y-10">
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold">
                  From your archive
                </h2>
                <p className="text-sm text-[var(--ink-soft)]">
                  Random favourites — pin to next week, or save to try later.
                </p>
              </div>
              <Link
                href="/library"
                className="text-sm font-semibold text-[var(--leaf-deep)]"
              >
                Full library
              </Link>
            </div>
            {archivePicks.length === 0 ? (
              <div className="surface rounded-[1.5rem] p-8 text-center">
                <p className="font-display text-xl font-bold">No recipes yet</p>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">
                  Import from a URL or photo, or add one manually.
                </p>
                <Link href="/recipes/new" className="btn btn-primary mt-4">
                  Add a recipe
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {archivePicks.map((r) => (
                  <ArchivePickCard
                    key={r.id}
                    recipe={r}
                    nextWeekDays={nextWeekDays}
                    showTry
                  />
                ))}
              </div>
            )}
          </section>

          <FeaturedSection
            title="From Good Food"
            blurb="bbcgoodfood.com — fixed for this week. Archive, pin, or save to try."
            cards={goodFood}
            nextWeekDays={nextWeekDays}
          />

          <FeaturedSection
            title="From BBC Food"
            blurb="bbc.co.uk/food — separate from Good Food. Same actions."
            cards={bbcFood}
            nextWeekDays={nextWeekDays}
          />
        </div>
      ) : (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-bold">To try</h2>
            <p className="text-sm text-[var(--ink-soft)]">
              Recipes that caught your eye — park them here until there’s a gap
              on the meal plan.
            </p>
          </div>
          {toTry.length === 0 ? (
            <div className="surface rounded-[1.5rem] p-8 text-center">
              <p className="font-display text-xl font-bold">Nothing parked yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-soft)]">
                On Ideas, tap <strong>Save to try</strong> on a featured recipe or
                archive pick when you can’t fit it this week.
              </p>
              <button
                type="button"
                className="btn btn-primary mt-5"
                onClick={() => setTab("ideas")}
              >
                Browse ideas
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {toTry.map((r) => (
                <ArchivePickCard
                  key={r.id}
                  recipe={r}
                  nextWeekDays={nextWeekDays}
                  showTry
                  tryMode
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function FeaturedSection({
  title,
  blurb,
  cards,
  nextWeekDays,
}: {
  title: string;
  blurb: string;
  cards: FeaturedCard[];
  nextWeekDays: DayOpt[];
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        <p className="text-sm text-[var(--ink-soft)]">{blurb}</p>
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)]">
          Couldn’t load recipes from this source right now — try again later.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((f) => (
            <FeaturedCardView
              key={f.sourceUrl}
              card={f}
              nextWeekDays={nextWeekDays}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ArchivePickCard({
  recipe,
  nextWeekDays,
  showTry,
  tryMode,
}: {
  recipe: ArchiveCard;
  nextWeekDays: DayOpt[];
  showTry?: boolean;
  tryMode?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <article className="surface overflow-hidden rounded-[1.35rem]">
      <Link href={`/recipes/${recipe.id}`} className="block">
        <div className="relative h-32 bg-gradient-to-br from-[var(--leaf-soft)] to-[rgba(212,120,74,0.25)]">
          {recipe.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imagePath}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="p-4">
          {recipe.category ? (
            <p className="text-xs font-semibold text-[var(--leaf)]">
              {recipe.category}
            </p>
          ) : null}
          <h3 className="font-display mt-1 text-lg font-bold leading-snug">
            {recipe.title}
          </h3>
        </div>
      </Link>
      <div className="space-y-2 border-t border-[var(--line)] px-4 py-3">
        {!open ? (
          <>
            <button
              type="button"
              className="btn btn-primary w-full text-sm"
              onClick={() => setOpen(true)}
            >
              Pin to next week
            </button>
            {showTry ? (
              recipe.onToTry || tryMode ? (
                <button
                  type="button"
                  className="btn btn-ghost w-full text-sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await removeFromTry(recipe.id);
                      setMsg("Removed from To try");
                      router.refresh();
                    })
                  }
                >
                  Remove from To try
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost w-full text-sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await addRecipeToTry(recipe.id);
                      setMsg("Saved to To try");
                      router.refresh();
                    })
                  }
                >
                  Save to try
                </button>
              )
            ) : null}
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--ink-soft)]">
              Choose a day
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {nextWeekDays.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  disabled={pending}
                  className="rounded-xl bg-[var(--mist)] px-3 py-3 text-left text-sm font-semibold touch-manipulation min-h-[2.75rem] hover:bg-[var(--leaf-soft)]"
                  onClick={() =>
                    startTransition(async () => {
                      await pinArchiveRecipeToDate(recipe.id, d.iso);
                      if (tryMode || recipe.onToTry) {
                        await removeFromTry(recipe.id);
                      }
                      setMsg(`Pinned · ${d.label}`);
                      router.refresh();
                    })
                  }
                >
                  {d.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-[var(--ink-soft)]"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        )}
        {msg ? <p className="text-xs text-[var(--leaf-deep)]">{msg}</p> : null}
      </div>
    </article>
  );
}

function FeaturedCardView({
  card,
  nextWeekDays,
}: {
  card: FeaturedCard;
  nextWeekDays: DayOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <article className="surface overflow-hidden rounded-[1.5rem]">
      <a
        href={card.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
      >
        <div className="relative h-44 bg-gradient-to-br from-[var(--leaf-soft)] to-[#dfece6]">
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.imageUrl}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : null}
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[var(--leaf-deep)]">
            {card.sourceLabel}
          </span>
        </div>
        <div className="space-y-2 px-5 pt-5">
          <h3 className="font-display text-2xl font-bold leading-snug group-hover:text-[var(--leaf-deep)]">
            {card.title}
          </h3>
          {card.description ? (
            <p className="line-clamp-2 text-sm text-[var(--ink-soft)]">
              {card.description}
            </p>
          ) : null}
          {card.servings ? (
            <p className="text-xs text-[var(--ink-soft)]">
              Serves {card.servings}
            </p>
          ) : null}
          <p className="text-xs font-semibold text-[var(--leaf-deep)]">
            View on {card.sourceLabel} →
          </p>
        </div>
      </a>
      <div className="space-y-3 p-5 pt-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost text-sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const id = await addFeaturedToArchive(card.sourceUrl);
                setMsg("Saved to archive");
                router.push(`/recipes/${id}`);
              })
            }
          >
            Add to archive
          </button>
          <button
            type="button"
            className="btn btn-ghost text-sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await addFeaturedToTry(card.sourceUrl);
                setMsg("Saved to To try");
                router.refresh();
              })
            }
          >
            Save to try
          </button>
          <button
            type="button"
            className="btn btn-primary text-sm"
            disabled={pending}
            onClick={() => setOpen((v) => !v)}
          >
            Pin to next week
          </button>
        </div>

        {open ? (
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[var(--mist)]/60 p-2 sm:grid-cols-4">
            {nextWeekDays.map((d) => (
              <button
                key={d.iso}
                type="button"
                disabled={pending}
                className="rounded-xl bg-white/80 px-2 py-2 text-left text-xs font-semibold"
                onClick={() =>
                  startTransition(async () => {
                    const result = await pinFeaturedToNextWeek(
                      card.sourceUrl,
                      d.iso,
                    );
                    setMsg(`Pinned · ${d.label}`);
                    router.refresh();
                    router.push(`/plan?week=${result.weekStart}`);
                  })
                }
              >
                {d.label}
              </button>
            ))}
          </div>
        ) : null}
        {msg ? <p className="text-sm text-[var(--leaf-deep)]">{msg}</p> : null}
      </div>
    </article>
  );
}
