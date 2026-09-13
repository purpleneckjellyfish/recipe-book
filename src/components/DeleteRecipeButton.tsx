"use client";

import { useTransition } from "react";
import { deleteRecipe } from "@/app/(app)/recipes/actions";

export function DeleteRecipeButton({
  recipeId,
  title,
}: {
  recipeId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="rounded-full bg-black/20 px-4 py-2 text-sm font-semibold hover:bg-black/30 disabled:opacity-60"
      onClick={() => {
        const ok = window.confirm(
          `Delete “${title}”? This can’t be undone.`,
        );
        if (!ok) return;
        startTransition(async () => {
          await deleteRecipe(recipeId);
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
