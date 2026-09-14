"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type MealSlotRecipeOption = {
  id: string;
  title: string;
  categoryName?: string | null;
};

function filterRecipes(
  recipes: MealSlotRecipeOption[],
  query: string,
): MealSlotRecipeOption[] {
  const q = query.trim().toLowerCase();
  const sorted = [...recipes].sort((a, b) =>
    a.title.localeCompare(b.title, "en"),
  );
  if (!q) return sorted;

  const scored = sorted
    .map((r) => {
      const title = r.title.toLowerCase();
      let score = 0;
      if (title === q) score = 100;
      else if (title.startsWith(q)) score = 80;
      else if (title.split(/\s+/).some((w) => w.startsWith(q))) score = 60;
      else if (title.includes(q)) score = 40;
      else return null;
      return { r, score };
    })
    .filter((x): x is { r: MealSlotRecipeOption; score: number } => x != null)
    .sort(
      (a, b) =>
        b.score - a.score || a.r.title.localeCompare(b.r.title, "en"),
    );

  return scored.map((x) => x.r);
}

export function MealSlotPicker({
  recipes,
  initialQuery = "",
  disabled,
  pending,
  onPickRecipe,
  onQuickMeal,
  onCancel,
}: {
  recipes: MealSlotRecipeOption[];
  initialQuery?: string;
  disabled?: boolean;
  pending?: boolean;
  onPickRecipe: (recipeId: string) => void;
  onQuickMeal: (note: string) => void;
  onCancel?: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => filterRecipes(recipes, query), [recipes, query]);
  const trimmed = query.trim();
  const showQuickMeal = trimmed.length > 0;
  const quickIndex = matches.length;
  const maxIndex = showQuickMeal ? quickIndex : Math.max(0, matches.length - 1);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) onCancel?.();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onCancel]);

  function pickRecipe(id: string) {
    onPickRecipe(id);
  }

  function pickQuick() {
    if (!trimmed) return;
    onQuickMeal(trimmed);
  }

  function onEnter() {
    if (showQuickMeal && matches.length === 0) {
      pickQuick();
      return;
    }
    if (matches.length === 1 && trimmed) {
      pickRecipe(matches[0].id);
      return;
    }
    if (highlight >= 0 && highlight < matches.length) {
      pickRecipe(matches[highlight].id);
      return;
    }
    if (showQuickMeal && highlight === quickIndex) {
      pickQuick();
    }
  }

  function moveHighlight(delta: number) {
    setHighlight((h) => Math.min(maxIndex, Math.max(0, h + delta)));
  }

  return (
    <div
      ref={rootRef}
      className="absolute left-0 right-0 top-full z-30 mt-1 space-y-1 rounded-xl border border-[var(--line)] bg-white p-2 shadow-[var(--shadow)]"
    >
      <input
        className="field text-sm"
        autoFocus
        role="combobox"
        aria-expanded
        aria-controls="meal-slot-suggestions"
        aria-autocomplete="list"
        placeholder="Filter library…"
        value={query}
        disabled={disabled || pending}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            moveHighlight(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            moveHighlight(-1);
          } else if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel?.();
          }
        }}
      />

      <ul
        id="meal-slot-suggestions"
        role="listbox"
        className="max-h-52 overflow-y-auto rounded-lg border border-[var(--line)]"
      >
        {matches.length === 0 && !showQuickMeal ? (
          <li className="px-3 py-3 text-sm text-[var(--ink-soft)]">
            No recipes in the library yet
          </li>
        ) : null}
        {matches.map((r, i) => (
          <li key={r.id} role="option" aria-selected={highlight === i}>
            <button
              type="button"
              title={r.title}
              className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left touch-manipulation ${
                highlight === i
                  ? "bg-[var(--leaf-soft)] text-[var(--leaf-deep)]"
                  : "hover:bg-[var(--mist)]"
              }`}
              disabled={pending}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pickRecipe(r.id)}
            >
              <span className="text-sm font-medium leading-snug">{r.title}</span>
              {r.categoryName ? (
                <span className="text-[0.65rem] font-medium text-[var(--ink-soft)]">
                  {r.categoryName}
                </span>
              ) : null}
            </button>
          </li>
        ))}
        {showQuickMeal ? (
          <li role="option" aria-selected={highlight === quickIndex}>
            <button
              type="button"
              className={`flex w-full flex-col gap-0.5 border-t border-[var(--line)] px-3 py-2 text-left touch-manipulation ${
                highlight === quickIndex
                  ? "bg-[var(--leaf-soft)]"
                  : "hover:bg-[var(--mist)]"
              }`}
              disabled={pending}
              onMouseEnter={() => setHighlight(quickIndex)}
              onClick={() => pickQuick()}
            >
              <span className="text-sm font-bold text-[var(--ink)]">
                Use “{trimmed}” as quick meal
              </span>
              <span className="text-[0.65rem] text-[var(--ink-soft)]">
                {matches.length === 0
                  ? "Not in the library"
                  : "Skip the library"}
              </span>
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
