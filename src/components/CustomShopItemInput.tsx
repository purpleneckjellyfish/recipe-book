"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { suggestSupermarketItems } from "@/lib/supermarket-suggest";

export function CustomShopItemInput({
  disabled,
  excludeNames = [],
  onAdd,
}: {
  disabled?: boolean;
  /** Names already on the list — hide from suggestions. */
  excludeNames?: string[];
  onAdd: (name: string) => void;
}) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const suggestions = suggestSupermarketItems(value, 8, excludeNames);

  useEffect(() => {
    setHighlight(0);
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function commit(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setValue("");
    setOpen(false);
    onAdd(trimmed);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (open && suggestions[highlight]) {
      commit(suggestions[highlight]);
      return;
    }
    commit(value);
  }

  return (
    <form onSubmit={onSubmit} className="surface relative rounded-[1.25rem] p-3">
      <div ref={wrapRef} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            className="field w-full"
            value={value}
            autoComplete="off"
            role="combobox"
            aria-expanded={open && suggestions.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            placeholder="Add custom item (bread, milk, bin bags…)"
            disabled={disabled}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (!open || suggestions.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => (h + 1) % suggestions.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight(
                  (h) => (h - 1 + suggestions.length) % suggestions.length,
                );
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
          />
          {open && suggestions.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-auto rounded-2xl border border-[var(--line)] bg-white py-1 shadow-lg"
            >
              {suggestions.map((item, i) => (
                <li key={item} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    className={`block w-full px-3 py-2 text-left text-sm font-medium ${
                      i === highlight
                        ? "bg-[var(--leaf-soft)] text-[var(--leaf-deep)]"
                        : "hover:bg-[var(--mist)]"
                    }`}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit(item);
                    }}
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button className="btn btn-primary shrink-0" type="submit" disabled={disabled}>
          Add
        </button>
      </div>
    </form>
  );
}
