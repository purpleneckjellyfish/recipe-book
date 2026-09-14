"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  autoFillWeek,
  clearUnpinned,
  markBatchCovers,
  refreshSlotRecipe,
  setSlotNote,
  setSlotRecipe,
  setSlotStatus,
  togglePin,
} from "@/app/(app)/plan/actions";
import { addDays, formatDateOnly, parseDateOnly, weekdayLabel } from "@/lib/dates";

type RecipeOption = {
  id: string;
  title: string;
  servings: number;
  vegPortions: number | null;
  allowWeeklyRepeat: boolean;
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
  const [batchCookId, setBatchCookId] = useState<string | null>(null);
  const [batchTargets, setBatchTargets] = useState<string[]>([]);
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
              ? "Your week at a glance — tap a day to change it."
              : "Pin favourites, jot quick meals like pasta, mark eating-out nights, then auto-fill the rest."}
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
            Fills unpinned empty slots from Main and Soup only. “Avoid last N
            weeks” skips dinners already cooked recently (set to 0 to allow
            repeats like roast chicken again).
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

      {batchCookId ? (
        <section className="surface animate-rise rounded-[1.5rem] border border-[var(--leaf)] p-4">
          <p className="font-semibold text-[var(--leaf-deep)]">
            Batch cook — pick leftover days
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {slots
              .filter((s) => s.id !== batchCookId && s.status !== "SKIP")
              .map((s) => (
                <label
                  key={s.id}
                  className={`cursor-pointer rounded-full px-3 py-2.5 text-sm font-medium touch-manipulation min-h-[2.5rem] ${
                    batchTargets.includes(s.id)
                      ? "is-selected"
                      : "bg-white/70"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={batchTargets.includes(s.id)}
                    onChange={(e) => {
                      setBatchTargets((prev) =>
                        e.target.checked
                          ? [...prev, s.id]
                          : prev.filter((id) => id !== s.id),
                      );
                    }}
                  />
                  {weekdayLabel(parseDateOnly(s.date))}
                </label>
              ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="btn btn-primary text-sm"
              disabled={pending || batchTargets.length === 0}
              onClick={() =>
                run(async () => {
                  await markBatchCovers({
                    cookSlotId: batchCookId,
                    leftoverSlotIds: batchTargets,
                  });
                  setBatchCookId(null);
                  setBatchTargets([]);
                })
              }
            >
              Link leftovers
            </button>
            <button
              type="button"
              className="btn btn-ghost text-sm"
              onClick={() => {
                setBatchCookId(null);
                setBatchTargets([]);
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {/* Calendar week grid */}
      <div className="animate-rise animate-rise-delay-2 overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-white/40 shadow-[var(--shadow)]">
        <div className="grid grid-cols-1 divide-y divide-[var(--line)] sm:grid-cols-7 sm:divide-x sm:divide-y-0">
          {days.map((day) => {
            const daySlots = slots.filter((s) => s.date === day);
            const primary = daySlots[0];
            const isEditing = editingSlotId === primary?.id;
            const isSkip = primary?.status === "SKIP";
            const isLeftover = primary?.status === "LEFTOVER";

            return (
              <div
                key={day}
                className="flex min-h-[140px] flex-col bg-[rgba(244,247,245,0.55)] p-3 sm:min-h-[220px]"
              >
                <div className="mb-2 flex items-start justify-between gap-1">
                  <div>
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--leaf)]">
                      {parseDateOnly(day).toLocaleDateString("en-GB", {
                        weekday: "short",
                        timeZone: "UTC",
                      })}
                    </p>
                    <p className="font-display text-xl font-bold leading-none">
                      {parseDateOnly(day).toLocaleDateString("en-GB", {
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {primary?.pinned ? (
                      <span className="rounded-full bg-[var(--leaf-deep)] px-2 py-0.5 text-[0.65rem] font-bold text-white">
                        Pin
                      </span>
                    ) : null}
                    {primary &&
                    primary.status === "RECIPE" &&
                    primary.recipeId &&
                    !primary.pinned ? (
                      <button
                        type="button"
                        className="rounded-full bg-white/90 px-2 py-1 text-[0.65rem] font-bold text-[var(--leaf-deep)] shadow-sm touch-manipulation"
                        disabled={pending}
                        title="Try a different recipe"
                        onClick={(e) => {
                          e.stopPropagation();
                          run(() => refreshSlotRecipe(primary.id));
                        }}
                      >
                        Refresh
                      </button>
                    ) : null}
                  </div>
                </div>

                {daySlots.map((slot) => {
                  const noteText = slot.notes?.trim() || "";
                  const isNoteOnly = !!noteText && !slot.recipeId;
                  const editing =
                    editingSlotId === slot.id ||
                    (!weekComplete && editingSlotId === slot.id);

                  return (
                  <div key={slot.id} className="flex flex-1 flex-col gap-2">
                    {isSkip ? (
                      <button
                        type="button"
                        className="flex flex-1 flex-col justify-center rounded-2xl bg-[var(--mist)] px-2 py-3 text-left"
                        onClick={() => {
                          setNoteDraft(slot.notes || "");
                          setEditingSlotId(slot.id);
                        }}
                      >
                        <p className="text-sm font-semibold text-[var(--ink-soft)]">
                          Out / takeaway
                        </p>
                        <p className="text-xs text-[var(--ink-soft)]">Tap to change</p>
                      </button>
                    ) : isLeftover ? (
                      <div className="flex flex-1 flex-col justify-center rounded-2xl border border-dashed border-[var(--leaf)] bg-[var(--leaf-soft)]/40 px-2 py-3">
                        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--leaf-deep)]">
                          Leftovers
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-snug">
                          {slot.recipe?.title || "Leftovers"}
                        </p>
                      </div>
                    ) : slot.recipe ? (
                      <button
                        type="button"
                        className="flex flex-1 flex-col rounded-2xl bg-[var(--leaf-deep)] px-2.5 py-3 text-left text-[#f7fbf8] transition hover:brightness-110"
                        onClick={() => {
                          setNoteDraft(slot.notes || "");
                          setEditingSlotId(isEditing ? null : slot.id);
                        }}
                      >
                        <p className="text-[0.65rem] font-semibold uppercase tracking-wide opacity-80">
                          {slot.mealType.name}
                        </p>
                        <p className="mt-1 font-display text-sm font-bold leading-snug sm:text-[0.95rem]">
                          {slot.recipe.title}
                        </p>
                        <p className="mt-auto pt-2 text-[0.65rem] opacity-75">
                          Tap to edit
                        </p>
                      </button>
                    ) : isNoteOnly ? (
                      <button
                        type="button"
                        className="flex flex-1 flex-col rounded-2xl border border-[var(--leaf)] bg-[var(--leaf-soft)]/50 px-2.5 py-3 text-left transition hover:bg-[var(--leaf-soft)]/80"
                        onClick={() => {
                          setNoteDraft(noteText);
                          setEditingSlotId(isEditing ? null : slot.id);
                        }}
                      >
                        <p className="font-display text-sm font-bold leading-snug text-[var(--ink)] sm:text-[0.95rem]">
                          {noteText}
                        </p>
                        <p className="mt-auto pt-2 text-[0.65rem] text-[var(--ink-soft)]">
                          Quick meal · shop guesses staples
                        </p>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-white/50 px-2 py-4 text-center"
                        onClick={() => {
                          setNoteDraft("");
                          setEditingSlotId(slot.id);
                        }}
                      >
                        <p className="text-sm font-semibold text-[var(--ink-soft)]">
                          Empty
                        </p>
                        <p className="text-xs text-[var(--ink-soft)]">
                          Recipe or quick meal
                        </p>
                      </button>
                    )}

                    {editing ? (
                      <div className="space-y-2 rounded-xl bg-white/80 p-2">
                        <div>
                          <label className="label">Quick meal (no recipe)</label>
                          <form
                            className="flex gap-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              run(async () => {
                                await setSlotNote({
                                  slotId: slot.id,
                                  note: noteDraft,
                                });
                                setEditingSlotId(null);
                              });
                            }}
                          >
                            <input
                              className="field text-sm"
                              placeholder="e.g. Pasta, jacket potatoes…"
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              disabled={pending || isLeftover}
                            />
                            <button
                              type="submit"
                              className="btn btn-primary shrink-0 px-3 text-sm"
                              disabled={pending || isLeftover}
                            >
                              Set
                            </button>
                          </form>
                          <p className="mt-1 text-[0.65rem] text-[var(--ink-soft)]">
                            Shopping list will guess staples for common meals
                            (jackets, pasta, pizza…). Tip:{" "}
                            <code className="text-xs">jackets: potatoes, cheese, beans</code>{" "}
                            to list exact items.
                          </p>
                        </div>
                        <select
                          className="field text-sm"
                          disabled={pending || isLeftover}
                          value={slot.recipeId || ""}
                          onChange={(e) => {
                            const value = e.target.value || null;
                            run(async () => {
                              await setSlotRecipe({
                                slotId: slot.id,
                                recipeId: value,
                                pinned: true,
                              });
                              setEditingSlotId(null);
                            });
                          }}
                        >
                          <option value="">Or choose a library recipe…</option>
                          {recipes.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.title}
                            </option>
                          ))}
                        </select>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            className="rounded-full bg-[var(--mist)] px-3 py-2 text-xs font-bold touch-manipulation min-h-[2.5rem]"
                            disabled={pending}
                            onClick={() => run(() => togglePin(slot.id))}
                          >
                            {slot.pinned ? "Unpin" : "Pin"}
                          </button>
                          <button
                            type="button"
                            className="rounded-full bg-[var(--mist)] px-3 py-2 text-xs font-bold touch-manipulation min-h-[2.5rem]"
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
                            {isSkip ? "Unskip" : "Skip / out"}
                          </button>
                          {slot.recipeId && !isLeftover && !isSkip ? (
                            <>
                              {!slot.pinned ? (
                                <button
                                  type="button"
                                  className="rounded-full bg-[var(--leaf-soft)] px-3 py-2 text-xs font-bold text-[var(--leaf-deep)] touch-manipulation min-h-[2.5rem]"
                                  disabled={pending}
                                  onClick={() =>
                                    run(() => refreshSlotRecipe(slot.id))
                                  }
                                >
                                  Refresh
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="rounded-full bg-[var(--leaf-soft)] px-3 py-2 text-xs font-bold text-[var(--leaf-deep)] touch-manipulation min-h-[2.5rem]"
                                disabled={pending}
                                onClick={() => {
                                  setBatchCookId(slot.id);
                                  setBatchTargets([]);
                                  setEditingSlotId(null);
                                }}
                              >
                                Batch
                              </button>
                            </>
                          ) : null}
                          {(slot.recipeId || noteText) && !isSkip ? (
                            <button
                              type="button"
                              className="rounded-full bg-[var(--mist)] px-3 py-2 text-xs font-bold touch-manipulation min-h-[2.5rem]"
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
                          <button
                            type="button"
                            className="rounded-full px-3 py-2 text-xs font-bold text-[var(--ink-soft)] touch-manipulation min-h-[2.5rem]"
                            onClick={() => setEditingSlotId(null)}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
