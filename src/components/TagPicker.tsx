"use client";

import { useMemo, useState } from "react";

export const SUGGESTED_TAGS = [
  "batch cooking",
  "speedy",
  "packups",
  "entertaining",
  "vegetarian",
  "vegan",
  "fish",
  "freezer friendly",
  "one pot",
  "comfort food",
];

type TagPickerProps = {
  options?: string[];
  selected?: string[];
  suggested?: string[];
  name?: string;
};

export function TagPicker({
  options = [],
  selected = [],
  suggested = [],
  name = "tags",
}: TagPickerProps) {
  const allOptions = useMemo(() => {
    const set = new Set<string>([
      ...SUGGESTED_TAGS,
      ...options,
      ...suggested,
      ...selected,
    ]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [options, suggested, selected]);

  const [checked, setChecked] = useState<Set<string>>(() => {
    return new Set(
      [...selected, ...suggested].map((t) => t.trim()).filter(Boolean),
    );
  });
  const [custom, setCustom] = useState("");
  const [extra, setExtra] = useState<string[]>([]);

  const visible = useMemo(() => {
    const set = new Set([...allOptions, ...extra]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allOptions, extra]);

  function toggle(tag: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function addCustom() {
    const tag = custom.trim();
    if (!tag) return;
    setExtra((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setChecked((prev) => new Set(prev).add(tag));
    setCustom("");
  }

  const selectedList = [...checked];

  return (
    <div className="space-y-3 rounded-[1.25rem] border border-[var(--line)] bg-white/55 p-4">
      <div>
        <p className="font-display text-lg font-bold text-[var(--ink)]">Tags</p>
        <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
          Tap to turn on or off. Add your own below if you need something else.
        </p>
      </div>

      {/* Hidden fields so server actions always receive selected tags reliably */}
      {selectedList.map((tag) => (
        <input key={`hidden-${tag}`} type="hidden" name={name} value={tag} />
      ))}

      <div className="flex flex-wrap gap-2">
        {visible.map((tag) => {
          const on = checked.has(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`select-none rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                on
                  ? "bg-[var(--leaf-deep)] text-[#f7fbf8] shadow-sm"
                  : "bg-white/80 text-[var(--ink-soft)] ring-1 ring-[var(--line)] hover:ring-[var(--leaf)]"
              }`}
            >
              {on ? "✓ " : ""}
              {tag}
            </button>
          );
        })}
      </div>

      {selectedList.length > 0 ? (
        <p className="text-xs font-medium text-[var(--leaf-deep)]">
          Selected: {selectedList.join(" · ")}
        </p>
      ) : (
        <p className="text-xs text-[var(--ink-soft)]">No tags selected yet.</p>
      )}

      <div className="flex gap-2">
        <input
          className="field"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Add a custom tag…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button type="button" className="btn btn-ghost shrink-0" onClick={addCustom}>
          Add
        </button>
      </div>
    </div>
  );
}
