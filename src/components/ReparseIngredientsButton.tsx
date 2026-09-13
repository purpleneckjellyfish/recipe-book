"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { reparseRecipeIngredients } from "@/app/(app)/recipes/actions";

export function ReparseIngredientsButton({ recipeId }: { recipeId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="text-xs font-semibold text-[var(--leaf-deep)] underline-offset-2 hover:underline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await reparseRecipeIngredients(recipeId);
          router.refresh();
        })
      }
    >
      {pending ? "Fixing…" : "Fix tsp/tbsp quantities"}
    </button>
  );
}
