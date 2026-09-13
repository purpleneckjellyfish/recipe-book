"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addRecipeToTry, removeFromTry } from "@/app/(app)/home/actions";

export function ToTryButton({
  recipeId,
  onToTry,
}: {
  recipeId: string;
  onToTry: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(onToTry);

  return (
    <button
      type="button"
      disabled={pending}
      className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25 disabled:opacity-60"
      onClick={() =>
        startTransition(async () => {
          if (saved) {
            await removeFromTry(recipeId);
            setSaved(false);
          } else {
            await addRecipeToTry(recipeId);
            setSaved(true);
          }
          router.refresh();
        })
      }
    >
      {pending ? "…" : saved ? "On To try ✓" : "Save to try"}
    </button>
  );
}
