"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import {
  importFromPhoto,
  importFromUrl,
  saveImportDraft,
  type ImportDraft,
} from "@/app/(app)/recipes/import-actions";
import { RecipeForm } from "@/components/RecipeForm";
import { TagPicker } from "@/components/TagPicker";

type Mode = "url" | "photo" | "manual";

const TABS: { id: Mode; label: string; hint: string }[] = [
  { id: "url", label: "From URL", hint: "Paste a link" },
  { id: "photo", label: "From photo", hint: "Camera or gallery" },
  { id: "manual", label: "Manual", hint: "Type it in" },
];

export function AddRecipeWizard({
  categories,
  tagOptions = [],
  initialMode = "url",
}: {
  categories: { id: string; name: string }[];
  tagOptions?: string[];
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [url, setUrl] = useState("");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setDraft(null);
  }

  function loadUrl(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const d = await importFromUrl(url);
        setDraft(d);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  function submitPhoto(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    setPhotoName(file.name || "Photo");
    const fd = new FormData();
    fd.set("photo", file);
    startTransition(async () => {
      try {
        const d = await importFromPhoto(fd);
        setDraft(d);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Photo import failed");
      }
    });
  }

  if (draft) {
    const selectedTags = draft.tags
      ? draft.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : draft.suggestedTags;

    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-[var(--leaf-soft)]/60 px-4 py-3 text-sm">
          Review the draft, tweak tags, then save into your recipe library.
        </div>
        <form action={saveImportDraft} className="space-y-4">
          <input type="hidden" name="sourceUrl" value={draft.sourceUrl} />
          <input type="hidden" name="imageUrl" value={draft.imageUrl || ""} />
          {draft.imageUrl ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={draft.imageUrl}
                alt=""
                className="h-44 w-full object-cover"
              />
              <p className="bg-white/70 px-3 py-2 text-xs text-[var(--ink-soft)]">
                Photo from the source — saved into your library when you confirm.
              </p>
            </div>
          ) : null}
          <div>
            <label className="label">Title</label>
            <input className="field" name="title" required defaultValue={draft.title} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="field min-h-20"
              name="description"
              defaultValue={draft.description}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Servings</label>
              <input
                className="field"
                name="servings"
                type="number"
                defaultValue={draft.servings}
              />
            </div>
            <div>
              <label className="label">Prep min</label>
              <input
                className="field"
                name="prepMinutes"
                defaultValue={draft.prepMinutes}
              />
            </div>
            <div>
              <label className="label">Cook min</label>
              <input
                className="field"
                name="cookMinutes"
                defaultValue={draft.cookMinutes}
              />
            </div>
            <div>
              <label className="label">Of your 5</label>
              <input
                className="field"
                name="vegPortions"
                defaultValue={draft.vegPortions}
              />
            </div>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="field" name="categoryId" defaultValue={draft.categoryId}>
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <TagPicker
            key={`tags-${draft.title}-${draft.suggestedTags.join(",")}`}
            options={tagOptions}
            selected={selectedTags}
            suggested={draft.suggestedTags}
          />
          <div>
            <label className="label">Ingredients</label>
            <textarea
              className="field min-h-40 font-mono text-sm"
              name="ingredients"
              required
              defaultValue={draft.ingredients}
            />
          </div>
          <div>
            <label className="label">Method</label>
            <textarea
              className="field min-h-40"
              name="steps"
              required
              defaultValue={draft.steps}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" type="submit">
              Save to library
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
              Start over
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="How to add"
        className="grid grid-cols-3 gap-1 rounded-2xl bg-[var(--mist)] p-1"
      >
        {TABS.map((tab) => {
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchMode(tab.id)}
              className={`rounded-xl px-2 py-3 text-center transition ${
                active
                  ? "bg-white shadow-sm"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              <span className="block text-sm font-bold">{tab.label}</span>
              <span className="mt-0.5 hidden text-xs sm:block">{tab.hint}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-xl bg-[rgba(212,120,74,0.18)] px-4 py-3 text-sm">{error}</p>
      ) : null}

      {mode === "url" ? (
        <form onSubmit={loadUrl} className="space-y-3">
          <p className="text-sm text-[var(--ink-soft)]">
            Works with Good Food, BBC Food, Gousto, and most sites that publish
            recipe structured data.
            data — we pull the photo too.
          </p>
          <input
            className="field"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.bbcgoodfood.com/recipes/…"
            type="url"
            required
          />
          <button className="btn btn-primary" disabled={pending} type="submit">
            {pending ? "Fetching…" : "Import from URL"}
          </button>
        </form>
      ) : null}

      {mode === "photo" ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--ink-soft)]">
            On your phone, use <strong>Take photo</strong> to open the camera, or
            choose an existing picture. Needs <code>IMPORT_API_KEY</code> in{" "}
            <code>.env</code>.
          </p>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => submitPhoto(e.target.files?.[0])}
          />
          <input
            ref={libraryRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => submitPhoto(e.target.files?.[0])}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() => cameraRef.current?.click()}
            >
              {pending ? "Reading…" : "Take photo"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending}
              onClick={() => libraryRef.current?.click()}
            >
              Choose from gallery
            </button>
          </div>
          {photoName ? (
            <p className="text-xs text-[var(--ink-soft)]">Selected: {photoName}</p>
          ) : null}
        </div>
      ) : null}

      {mode === "manual" ? (
        <RecipeForm mode="create" categories={categories} tagOptions={tagOptions} />
      ) : null}
    </div>
  );
}
