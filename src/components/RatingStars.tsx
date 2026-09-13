"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { rateRecipe } from "@/app/(app)/recipes/actions";

export function RatingStars({
  recipeId,
  myScore,
}: {
  recipeId: string;
  myScore: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={pending}
          aria-label={`Rate ${n} out of 5`}
          className={`text-2xl transition hover:scale-110 ${
            myScore && n <= myScore ? "text-[var(--bloom)]" : "text-[var(--leaf-soft)]"
          }`}
          onClick={() => {
            startTransition(async () => {
              await rateRecipe(recipeId, n);
              router.refresh();
            });
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}
