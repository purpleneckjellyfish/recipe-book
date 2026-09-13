"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useTransition } from "react";
import { uploadRecipePhoto } from "@/app/(app)/recipes/photo-actions";

export function PhotoUpload({ recipeId }: { recipeId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          await uploadRecipePhoto(recipeId, fd);
          e.currentTarget.reset();
          router.refresh();
        });
      }}
    >
      <input
        name="photo"
        type="file"
        accept="image/*"
        capture="environment"
        required
        className="text-sm text-white/90 file:mr-2 file:rounded-full file:border-0 file:bg-white/20 file:px-3 file:py-1.5 file:text-sm file:font-semibold"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
      >
        {pending ? "Uploading…" : "Add photo"}
      </button>
    </form>
  );
}
