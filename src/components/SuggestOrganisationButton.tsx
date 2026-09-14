"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { autoOrganiseRecipe } from "@/app/(app)/recipes/actions";

export function SuggestOrganisationButton({
  recipeId,
  aiConfigured,
}: {
  recipeId: string;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  if (!aiConfigured) {
    return (
      <p className="text-xs text-[var(--ink-soft)]">
        Set <code>IMPORT_API_KEY</code> so recipes can be auto-tagged and veg
        portions counted.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        className="btn btn-primary text-sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            setLast(null);
            try {
              const result = await autoOrganiseRecipe(recipeId);
              const bits = [
                result.categoryGuess ? `type ${result.categoryGuess}` : null,
                result.tags.length ? `${result.tags.length} tags` : null,
                result.vegPortions != null
                  ? `${result.vegPortions} of 5 veg`
                  : null,
              ].filter(Boolean);
              setLast(
                bits.length
                  ? `Updated: ${bits.join(" · ")}`
                  : "AI had nothing clear to add",
              );
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Auto-tag failed");
            }
          })
        }
      >
        {pending ? "Reading recipe…" : "Auto-tag with AI"}
      </button>
      <p className="text-xs text-[var(--ink-soft)]">
        Applies a fixed set of useful tags and counts veg/fruit portions per
        serving (potatoes excluded).
      </p>
      {last ? (
        <p className="text-xs font-medium text-[var(--leaf-deep)]">{last}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-[var(--bloom)]">{error}</p>
      ) : null}
    </div>
  );
}
