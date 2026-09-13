"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { pinRecipeToDate } from "@/app/(app)/plan/actions";
import {
  addDays,
  formatDateOnly,
  startOfWeek,
  toDateOnly,
  weekdayLabel,
} from "@/lib/dates";

export function PinToWeekPanel({
  recipeId,
  weekStartDay = 1,
}: {
  recipeId: string;
  weekStartDay?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const nextWeek = useMemo(() => {
    const today = toDateOnly(new Date());
    const thisWeek = startOfWeek(today, weekStartDay);
    const start = addDays(thisWeek, 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return {
        iso: formatDateOnly(d),
        label: weekdayLabel(d),
      };
    });
  }, [weekStartDay]);

  if (!open) {
    return (
      <button
        type="button"
        className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25"
        onClick={() => setOpen(true)}
      >
        Pin to next week
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-black/20 p-4 text-left sm:max-w-lg">
      <p className="text-sm font-semibold">Pin to next week</p>
      <p className="mt-1 text-xs text-white/75">
        Choose a day — it’s locked on the meal plan so auto-fill won’t replace it.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {nextWeek.map((day) => (
          <button
            key={day.iso}
            type="button"
            disabled={pending}
            className="rounded-xl bg-white/15 px-2 py-2.5 text-left text-xs font-semibold hover:bg-white/25 disabled:opacity-60"
            onClick={() =>
              startTransition(async () => {
                const result = await pinRecipeToDate({
                  recipeId,
                  dateIso: day.iso,
                });
                setMessage(`Pinned for ${day.label}`);
                router.refresh();
                // Keep panel open briefly with link
                setTimeout(() => setMessage(`Pinned · week of ${result.weekStart}`), 0);
              })
            }
          >
            {day.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
        {message ? (
          <>
            <span className="text-xs text-white/85">{message}</span>
            <Link
              href={`/plan?week=${nextWeek[0]?.iso}`}
              className="text-xs font-bold underline"
            >
              Open plan
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
