"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  applyRecipeOrganisation,
  suggestRecipeOrganisation,
} from "@/app/(app)/recipes/actions";

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
  const [draft, setDraft] = useState<{
    tags: string[];
    categoryId: string | null;
    categoryGuess: string | null;
    vegPortions: number | null;
  } | null>(null);

  if (!aiConfigured) {
    return (
      <p className="text-xs text-[var(--ink-soft)]">
        Set <code>IMPORT_API_KEY</code> to re-suggest type, tags, and veg portions.
      </p>
    );
  }

  if (draft) {
    return (
      <div className="mt-3 space-y-3 rounded-2xl bg-[var(--mist)]/70 p-3 text-sm">
        <p className="font-semibold">Suggested updates</p>
        {draft.categoryGuess ? (
          <p>
            Type: <strong>{draft.categoryGuess}</strong>
          </p>
        ) : null}
        {draft.vegPortions != null ? (
          <p>
            Of your 5: <strong>{draft.vegPortions}</strong>
          </p>
        ) : null}
        {draft.tags.length ? (
          <p>Tags: {draft.tags.join(", ")}</p>
        ) : (
          <p className="text-[var(--ink-soft)]">No tag suggestions</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary text-sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await applyRecipeOrganisation(recipeId, {
                  tags: draft.tags,
                  categoryId: draft.categoryId,
                  vegPortions: draft.vegPortions,
                });
                setDraft(null);
                router.refresh();
              })
            }
          >
            Apply
          </button>
          <button
            type="button"
            className="btn btn-ghost text-sm"
            disabled={pending}
            onClick={() => setDraft(null)}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        className="btn btn-ghost text-sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const result = await suggestRecipeOrganisation(recipeId);
              setDraft(result);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Suggest failed");
            }
          })
        }
      >
        {pending ? "Asking AI…" : "Suggest type & tags"}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-[var(--bloom)]">{error}</p>
      ) : null}
    </div>
  );
}
