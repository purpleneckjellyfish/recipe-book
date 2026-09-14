"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  exportLibraryCsv,
  exportLibraryPdfBase64,
} from "@/app/(app)/share-actions";
import {
  downloadServerLibraryBackup,
  exportLibraryJson,
  importLibraryJson,
  listServerLibraryBackups,
  maybeWriteDailyLibraryBackup,
  saveLibraryBackupOnServer,
} from "@/app/(app)/library-backup-actions";

function downloadText(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const [serverBackups, setServerBackups] = useState<
    { filename: string; date: string }[]
  >([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function refreshServerList() {
    startTransition(async () => {
      try {
        await maybeWriteDailyLibraryBackup();
        setServerBackups(await listServerLibraryBackups());
      } catch {
        /* disk may be unavailable in some local setups */
      }
    });
  }

  useEffect(() => {
    refreshServerList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  return (
    <div className="surface rounded-[1.5rem] p-5">
      <h2 className="font-display text-xl font-bold">Library backup</h2>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        Download a full restore file (recipes + photos), keep automatic copies
        on the server, and import again if the library is wiped by mistake.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary text-sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const { json, filename, recipeCount } = await exportLibraryJson();
              downloadText(json, filename, "application/json");
              setServerBackups(await listServerLibraryBackups());
              setMsg(
                `Downloaded backup (${recipeCount} recipe${recipeCount === 1 ? "" : "s"}) — keep a copy on your phone or Drive too`,
              );
            })
          }
        >
          Download backup (.json)
        </button>
        <button
          type="button"
          className="btn btn-ghost text-sm"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
        >
          Import backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            startTransition(async () => {
              try {
                const text = await file.text();
                const result = await importLibraryJson(text);
                setMsg(
                  `Imported ${result.imported} recipe${result.imported === 1 ? "" : "s"}` +
                    (result.skipped
                      ? ` · skipped ${result.skipped} already in library`
                      : ""),
                );
              } catch (err) {
                setMsg(
                  err instanceof Error ? err.message : "Import failed",
                );
              }
            });
          }}
        />
        <button
          type="button"
          className="btn btn-ghost text-sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const written = await saveLibraryBackupOnServer();
              setServerBackups(await listServerLibraryBackups());
              setMsg(
                `Saved on server as ${written.filename} (${written.recipeCount} recipes)`,
              );
            })
          }
        >
          Save backup on server
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
        <button
          type="button"
          className="btn btn-ghost text-sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const { csv, filename } = await exportLibraryCsv();
              downloadText(csv, filename, "text/csv;charset=utf-8");
              setMsg("CSV downloaded (for spreadsheets — not for full restore)");
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
              setMsg("PDF library downloaded");
            })
          }
        >
          Export PDF pack
        </button>
      </div>

      <div className="mt-5 rounded-2xl bg-white/55 px-4 py-3">
        <h3 className="text-sm font-bold">Server copies</h3>
        <p className="mt-1 text-xs text-[var(--ink-soft)]">
          Automatic daily snapshot when you open Settings, plus any manual
          saves. Stored under the separate <code>backups</code> folder on the
          server (not inside the live database).
        </p>
        {serverBackups.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            No server backups yet — download or save one above.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {serverBackups.slice(0, 8).map((b) => (
              <li
                key={b.filename}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="font-medium">{b.date}</span>
                <button
                  type="button"
                  className="font-semibold text-[var(--leaf-deep)]"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const file = await downloadServerLibraryBackup(
                        b.filename,
                      );
                      downloadText(
                        file.json,
                        file.filename,
                        "application/json",
                      );
                      setMsg(`Downloaded ${file.filename}`);
                    })
                  }
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {msg ? (
        <p className="mt-3 text-sm text-[var(--leaf-deep)]">{msg}</p>
      ) : null}
    </div>
  );
}
