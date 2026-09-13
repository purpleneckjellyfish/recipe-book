"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateRecipeTags } from "@/app/(app)/recipes/actions";
import { TagPicker } from "@/components/TagPicker";

type CategoryOption = { id: string; name: string };

export function RecipeTagsPanel({
  recipeId,
  selected,
  options,
  categories,
  categoryId,
  categoryName,
}: {
  recipeId: string;
  selected: string[];
  options: string[];
  categories: CategoryOption[];
  categoryId: string | null;
  categoryName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const typeLabel = categoryName || "Uncategorised";
  const tagSummary =
    selected.length > 0
      ? `${selected.length} tag${selected.length === 1 ? "" : "s"}`
      : "No tags yet";

  return (
    <section className="surface rounded-[1.75rem] p-4 sm:p-5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <h2 className="font-display text-xl font-bold">Type & tags</h2>
          <p className="text-sm text-[var(--ink-soft)]">
            {typeLabel} · {tagSummary}
          </p>
        </div>
        <span className="grid size-9 place-items-center rounded-full bg-[var(--mist)] text-lg font-bold text-[var(--leaf-deep)]">
          {open ? "−" : "+"}
        </span>
      </button>

      {open ? (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          {!editing ? (
            <>
              <div className="space-y-3">
                <div>
                  <p className="label mb-1.5">Type</p>
                  <span className="chip">{typeLabel}</span>
                </div>
                <div>
                  <p className="label mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.length > 0 ? (
                      selected.map((tag) => (
                        <span key={tag} className="chip">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--ink-soft)]">No tags yet.</p>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost mt-4 text-sm"
                onClick={() => setEditing(true)}
              >
                Edit type & tags
              </button>
            </>
          ) : (
            <form
              className="space-y-4"
              action={(formData) => {
                startTransition(async () => {
                  await updateRecipeTags(recipeId, formData);
                  setMessage("Saved");
                  setEditing(false);
                  router.refresh();
                });
              }}
            >
              <div>
                <label className="label" htmlFor="categoryId">
                  Type
                </label>
                <select
                  className="field"
                  id="categoryId"
                  name="categoryId"
                  defaultValue={categoryId || ""}
                >
                  <option value="">Uncategorised</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <TagPicker options={options} selected={selected} />
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pending}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
              {message ? (
                <p className="text-sm text-[var(--leaf-deep)]">{message}</p>
              ) : null}
            </form>
          )}
        </div>
      ) : null}
    </section>
  );
}
