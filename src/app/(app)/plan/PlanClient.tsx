"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  autoFillWeek,
  clearUnpinned,
  refreshSlotRecipe,
  setSlotNote,
  setSlotRecipe,
  setSlotStatus,
  togglePin,
} from "@/app/(app)/plan/actions";
import { MealSlotPicker } from "@/components/MealSlotPicker";
import { addDays, formatDateOnly, parseDateOnly } from "@/lib/dates";

type RecipeOption = {
  id: string;
  title: string;
  servings: number;
  vegPortions: number | null;
  allowWeeklyRepeat: boolean;
  categoryName?: string | null;
};

type Slot = {
  id: string;
  date: string;
  status: "RECIPE" | "LEFTOVER" | "SKIP";
  pinned: boolean;
  recipeId: string | null;
  servings: number | null;
  cookSlotId: string | null;
  notes: string | null;
  mealType: { id: string; name: string };
  recipe: { id: string; title: string; servings: number } | null;
};

function slotLabel(slot: Slot) {
  if (slot.status === "SKIP") return "Out / takeaway";
  if (slot.status === "LEFTOVER")
    return slot.recipe?.title ? `Leftovers · ${slot.recipe.title}` : "Leftovers";
  if (slot.recipe?.title) return slot.recipe.title;
  const note = slot.notes?.trim();
  if (note) return note;
  return "";
}

export function PlanClient({
  weekStart,
  slots,
  recipes,
}: {
  weekStart: string;
  slots: Slot[];
  recipes: RecipeOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [vegetarian, setVegetarian] = useState(0);
  const [fish, setFish] = useState(0);
  const [preferVeg, setPreferVeg] = useState(false);
  const [avoidLastWeeks, setAvoidLastWeeks] = useState(1);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        formatDateOnly(addDays(parseDateOnly(weekStart), i)),
      ),
    [weekStart],
  );

  const filledCount = slots.filter(
    (s) =>
      s.status === "SKIP" ||
      s.status === "LEFTOVER" ||
      (s.status === "RECIPE" && (!!s.recipeId || !!s.notes?.trim())),
  ).length;
  const totalSlots = slots.length || 1;
  const weekComplete = filledCount >= totalSlots && totalSlots > 0;

  const prev = formatDateOnly(addDays(parseDateOnly(weekStart), -7));
  const next = formatDateOnly(addDays(parseDateOnly(weekStart), 7));

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section className="animate-rise flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="chip mb-3">
            {weekComplete ? "Week ready" : "This week"}
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Meal plan
          </h1>
          <p className="mt-2 max-w-xl text-[var(--ink-soft)]">
            {weekComplete
              ? "Your week at a glance — open a day to change it."
              : "Pick a Main or Soup (or type a quick meal), then auto-fill the rest."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/plan?week=${prev}`} className="btn btn-ghost text-sm">
            ← Prev
          </Link>
          <Link href={`/plan?week=${next}`} className="btn btn-ghost text-sm">
            Next →
          </Link>
          <Link href={`/shop?week=${weekStart}`} className="btn btn-primary text-sm">
            Shopping list
          </Link>
        </div>
      </section>

      {!weekComplete ? (
        <section className="surface animate-rise animate-rise-delay-1 rounded-[1.5rem] p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold">Auto-fill blanks</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Fills empty slots from Main and Soup. “Avoid last N weeks” only
            affects auto-fill — you can still pick those recipes by hand.
          </p>
          <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap sm:items-end">
            <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end sm:gap-3">
              <div className="min-w-0">
                <label className="label">Vegetarian meals</label>
                <input
                  className="field w-full sm:w-24"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={vegetarian}
                  onChange={(e) => setVegetarian(Number(e.target.value))}
                />
              </div>
              <div className="min-w-0">
                <label className="label">Fish meals</label>
                <input
                  className="field w-full sm:w-24"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={fish}
                  onChange={(e) => setFish(Number(e.target.value))}
                />
              </div>
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <label className="label">Avoid last N weeks</label>
                <input
                  className="field w-full sm:w-24"
                  type="number"
                  min={0}
                  max={8}
                  inputMode="numeric"
                  value={avoidLastWeeks}
                  onChange={(e) => setAvoidLastWeeks(Number(e.target.value))}
                />
              </div>
            </div>
            <label className="flex min-h-[2.75rem] items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={preferVeg}
                onChange={(e) => setPreferVeg(e.target.checked)}
                className="size-5 accent-[var(--leaf-deep)]"
              />
              Prefer higher “5 a day”
            </label>
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <button
                type="button"
                className="btn btn-primary w-full sm:w-auto"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    autoFillWeek({
                      weekStartIso: weekStart,
                      vegetarian,
                      fish,
                      preferVeg,
                      avoidLastWeeks,
                    }),
                  )
                }
              >
                Fill blanks
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full sm:w-auto"
                disabled={pending}
                onClick={() => run(() => clearUnpinned(weekStart))}
              >
                Clear unpinned
              </button>
            </div>
          </div>
        </section>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost text-sm"
            disabled={pending}
            onClick={() => run(() => clearUnpinned(weekStart))}
          >
            Clear unpinned & edit
          </button>
        </div>
      )}

      <div className="animate-rise animate-rise-delay-2 overflow-visible rounded-[1.75rem] border border-[var(--line)] bg-white/50 shadow-[var(--shadow)]">
        <ul className="divide-y divide-[var(--line)]">
          {days.map((day) => {
            const slot = slots.find((s) => s.date === day);
            if (!slot) return null;

            const isSkip = slot.status === "SKIP";
            const isLeftover = slot.status === "LEFTOVER";
            const noteText = slot.notes?.trim() || "";
            const label = slotLabel(slot);
            const editing = editingSlotId === slot.id;
            const empty = !label;

            return (
              <li
                key={day}
                className={`relative px-3 py-3 sm:px-4 ${editing ? "z-20" : "z-0"}`}
              >
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="w-14 shrink-0 sm:w-16">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[var(--leaf)]">
                      {parseDateOnly(day).toLocaleDateString("en-GB", {
                        weekday: "short",
                        timeZone: "UTC",
                      })}
                    </p>
                    <p className="font-display text-lg font-bold leading-none">
                      {parseDateOnly(day).toLocaleDateString("en-GB", {
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </p>
                  </div>

                  <div className="relative min-w-0 flex-1">
                    <button
                      type="button"
                      title={label || undefined}
                      disabled={pending || isLeftover}
                      className={`field flex w-full items-center justify-between gap-2 text-left text-sm ${
                        isSkip
                          ? "text-[var(--ink-soft)]"
                          : empty
                            ? "text-[var(--ink-soft)]"
                            : ""
                      }`}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        if (isLeftover) return;
                        if (editing) {
                          setEditingSlotId(null);
                          return;
                        }
                        setNoteDraft(noteText && !slot.recipeId ? noteText : "");
                        setEditingSlotId(slot.id);
                      }}
                    >
                      <span className="min-w-0 truncate">
                        {isSkip
                          ? "Out / takeaway"
                          : isLeftover
                            ? label
                            : empty
                              ? "Choose a meal…"
                              : label}
                      </span>
                      <span className="shrink-0 text-[var(--ink-soft)]" aria-hidden>
                        ▾
                      </span>
                    </button>

                    {editing && !isLeftover ? (
                      <MealSlotPicker
                        key={slot.id}
                        recipes={recipes}
                        initialQuery={noteDraft}
                        pending={pending}
                        onCancel={() => setEditingSlotId(null)}
                        onPickRecipe={(recipeId) =>
                          run(async () => {
                            await setSlotRecipe({
                              slotId: slot.id,
                              recipeId,
                              pinned: true,
                            });
                            setEditingSlotId(null);
                          })
                        }
                        onQuickMeal={(note) =>
                          run(async () => {
                            await setSlotNote({
                              slotId: slot.id,
                              note,
                            });
                            setEditingSlotId(null);
                          })
                        }
                      />
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {slot.pinned && !isSkip ? (
                      <span className="rounded-full bg-[var(--leaf-deep)] px-2 py-0.5 text-[0.65rem] font-bold text-white">
                        Pin
                      </span>
                    ) : null}
                    {noteText && !slot.recipeId && !isSkip ? (
                      <span className="rounded-full bg-[var(--mist)] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--ink-soft)]">
                        Quick
                      </span>
                    ) : null}
                    {!isLeftover ? (
                      <button
                        type="button"
                        className="rounded-full bg-[var(--mist)] px-2.5 py-1.5 text-[0.7rem] font-bold touch-manipulation"
                        disabled={pending}
                        onClick={() =>
                          run(async () => {
                            await setSlotStatus({
                              slotId: slot.id,
                              status: isSkip ? "RECIPE" : "SKIP",
                            });
                            setEditingSlotId(null);
                          })
                        }
                      >
                        {isSkip ? "Unskip" : "Skip"}
                      </button>
                    ) : null}
                    {slot.recipeId && !isLeftover && !isSkip && !slot.pinned ? (
                      <button
                        type="button"
                        className="rounded-full bg-[var(--mist)] px-2.5 py-1.5 text-[0.7rem] font-bold touch-manipulation"
                        disabled={pending}
                        onClick={() => run(() => refreshSlotRecipe(slot.id))}
                      >
                        Refresh
                      </button>
                    ) : null}
                    {slot.recipeId && !isLeftover && !isSkip ? (
                      <button
                        type="button"
                        className="rounded-full bg-[var(--mist)] px-2.5 py-1.5 text-[0.7rem] font-bold touch-manipulation"
                        disabled={pending}
                        onClick={() => {
                          run(() => togglePin(slot.id));
                          setEditingSlotId(null);
                        }}
                      >
                        {slot.pinned ? "Unpin" : "Pin"}
                      </button>
                    ) : null}
                    {(slot.recipeId || noteText) && !isSkip && !isLeftover ? (
                      <button
                        type="button"
                        className="rounded-full bg-[var(--mist)] px-2.5 py-1.5 text-[0.7rem] font-bold touch-manipulation"
                        disabled={pending}
                        onClick={() =>
                          run(async () => {
                            await setSlotNote({ slotId: slot.id, note: "" });
                            await setSlotRecipe({
                              slotId: slot.id,
                              recipeId: null,
                              pinned: false,
                            });
                            setNoteDraft("");
                            setEditingSlotId(null);
                          })
                        }
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
