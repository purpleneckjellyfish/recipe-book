"use client";

import { useMemo, useState } from "react";
import { formatQuantity, scaleQuantity } from "@/lib/scale";

type Ingredient = {
  id: string;
  quantity: { toString(): string } | number | null;
  unit: string | null;
  name: string;
  note: string | null;
};

export function ServingScaler({
  baseServings,
  ingredients,
}: {
  baseServings: number;
  ingredients: Ingredient[];
}) {
  const [servings, setServings] = useState(baseServings);

  const scaled = useMemo(
    () =>
      ingredients.map((ing) => {
        const qty =
          ing.quantity == null ? null : Number(ing.quantity.toString());
        return {
          ...ing,
          scaledQty: scaleQuantity(qty, baseServings, servings),
        };
      }),
    [ingredients, baseServings, servings],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Ingredients</h2>
        <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-3 py-1.5">
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full bg-[var(--mist)] font-bold"
            onClick={() => setServings((s) => Math.max(1, s - 1))}
          >
            −
          </button>
          <span className="min-w-24 text-center text-sm font-semibold">
            Serves {servings}
          </span>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full bg-[var(--mist)] font-bold"
            onClick={() => setServings((s) => s + 1)}
          >
            +
          </button>
        </div>
      </div>
      {servings !== baseServings ? (
        <p className="text-xs text-[var(--ink-soft)]">
          Scaled from {baseServings} servings
        </p>
      ) : null}
      <ul className="space-y-2.5">
        {scaled.map((ing) => (
          <li
            key={ing.id}
            className="flex gap-3 rounded-2xl bg-white/55 px-4 py-3 text-[var(--ink)]"
          >
            <span className="min-w-24 font-semibold text-[var(--leaf-deep)]">
              {formatQuantity(ing.scaledQty, ing.unit) || "—"}
            </span>
            <span>
              {ing.name}
              {ing.note ? (
                <span className="text-[var(--ink-soft)]"> ({ing.note})</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
