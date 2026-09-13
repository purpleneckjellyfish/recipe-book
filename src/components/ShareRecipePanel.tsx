"use client";

import { FormEvent, useState, useTransition } from "react";
import {
  emailRecipe,
  getRecipePdfBase64,
  getRecipeText,
} from "@/app/(app)/share-actions";

function downloadBase64(base64: string, filename: string, mime: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ShareRecipePanel({ recipeId }: { recipeId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25"
        onClick={() => setOpen(true)}
      >
        Share
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-black/20 p-4 text-left sm:max-w-md">
      <p className="text-sm font-semibold">Share this recipe</p>
      <p className="mt-1 text-xs text-white/75">
        Sends a self-contained PDF/text — no link to your home server.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const pdf = await getRecipePdfBase64(recipeId);
              downloadBase64(pdf.base64, pdf.filename, "application/pdf");
              setMessage("PDF downloaded");
            })
          }
        >
          Download PDF
        </button>
        <button
          type="button"
          className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const text = await getRecipeText(recipeId);
              await navigator.clipboard.writeText(text);
              setMessage("Copied to clipboard");
            })
          }
        >
          Copy text
        </button>
        <button
          type="button"
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          startTransition(async () => {
            try {
              await emailRecipe(recipeId, email);
              setMessage(`Emailed to ${email}`);
              setEmail("");
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Email failed");
            }
          });
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-full border-0 bg-white/90 px-3 py-2 text-sm text-[var(--ink)]"
          type="email"
          required
          placeholder="friend@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-full bg-[var(--bloom)] px-3 py-2 text-xs font-bold text-white"
          disabled={pending}
        >
          Email
        </button>
      </form>
      {message ? <p className="mt-2 text-xs text-white/85">{message}</p> : null}
    </div>
  );
}
