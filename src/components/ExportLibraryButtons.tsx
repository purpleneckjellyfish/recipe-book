"use client";

import { useState, useTransition } from "react";
import {
  exportLibraryCsv,
  exportLibraryPdfBase64,
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

export function ExportLibraryButtons() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="surface rounded-[1.5rem] p-5">
      <h2 className="font-display text-xl font-bold">Family archive export</h2>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        Download the whole library as CSV or a printable PDF pack — portable
        without the app.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary text-sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const { csv, filename } = await exportLibraryCsv();
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              a.click();
              URL.revokeObjectURL(url);
              setMsg("CSV downloaded");
            })
          }
        >
          Export CSV
        </button>
        <button
          type="button"
          className="btn btn-ghost text-sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const pdf = await exportLibraryPdfBase64();
              downloadBase64(pdf.base64, pdf.filename, "application/pdf");
              setMsg("PDF archive downloaded");
            })
          }
        >
          Export PDF pack
        </button>
      </div>
      {msg ? <p className="mt-3 text-sm text-[var(--leaf-deep)]">{msg}</p> : null}
    </div>
  );
}
