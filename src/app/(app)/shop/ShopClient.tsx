"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  addCustomItem,
  archiveShoppingList,
  generateShoppingList,
  restoreItem,
  softDeleteItem,
  toggleAlreadyHave,
  toggleChecked,
  unarchiveShoppingList,
} from "@/app/(app)/shop/actions";
import { CustomShopItemInput } from "@/components/CustomShopItemInput";
import { formatQuantity } from "@/lib/scale";
import {
  groupItemsByAisle,
  shouldShowShopQuantity,
} from "@/lib/shopping-aisles";

type Item = {
  id: string;
  name: string;
  quantity: string | number | null;
  unit: string | null;
  source: string;
  checked: boolean;
  alreadyHave: boolean;
  softDeleted: boolean;
  note: string | null;
};

type Archived = {
  id: string;
  title: string;
  weekStart: string | null;
  weekLabel: string;
  itemCount: number;
};

export function ShopClient({
  weekStart,
  weekLabel,
  lastWeekStart,
  lastWeekLabel,
  nextWeekStart,
  nextWeekLabel,
  thisWeekStart,
  thisWeekLabel,
  listId,
  items,
  hasPlan,
  plannedMealCount,
  archived,
}: {
  weekStart: string;
  weekLabel: string;
  lastWeekStart: string;
  lastWeekLabel: string;
  nextWeekStart: string;
  nextWeekLabel: string;
  thisWeekStart: string;
  thisWeekLabel: string;
  listId: string | null;
  items: Item[];
  hasPlan: boolean;
  plannedMealCount: number;
  archived: Archived[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [shoppingMode, setShoppingMode] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  function run(fn: () => Promise<void>, message?: string) {
    startTransition(async () => {
      try {
        await fn();
        if (message) {
          setToast(message);
          setTimeout(() => setToast(null), 3500);
        }
        router.refresh();
      } catch (e) {
        setToast(e instanceof Error ? e.message : "Something went wrong");
        setTimeout(() => setToast(null), 4500);
      }
    });
  }

  useEffect(() => {
    if (!shoppingMode) {
      void wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
      return;
    }

    let cancelled = false;

    async function requestWakeLock() {
      try {
        if (!("wakeLock" in navigator)) return;
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await lock.release();
          return;
        }
        wakeLockRef.current = lock;
      } catch {
        /* unsupported / denied */
      }
    }

    void requestWakeLock();

    function onVisible() {
      if (document.visibilityState === "visible") void requestWakeLock();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
    };
  }, [shoppingMode]);

  const active = items.filter(
    (i) => !i.softDeleted && !i.checked && !i.alreadyHave,
  );
  const gotIt = items.filter(
    (i) => !i.softDeleted && (i.checked || i.alreadyHave),
  );
  const removed = items.filter((i) => i.softDeleted);

  const tabs = [
    { start: lastWeekStart, title: "Last week", dates: lastWeekLabel },
    { start: thisWeekStart, title: "This week", dates: thisWeekLabel },
    { start: nextWeekStart, title: "Next week", dates: nextWeekLabel },
  ];

  if (shoppingMode) {
    return (
      <div className="shop-mode-root">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--leaf-deep)] px-4 py-3 text-white">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
              Shopping mode
            </p>
            <h1 className="truncate font-display text-xl font-bold">{weekLabel}</h1>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full bg-white/15 px-4 py-2.5 text-sm font-bold touch-manipulation"
            onClick={() => setShoppingMode(false)}
          >
            Exit
          </button>
        </header>

        <div className="shop-mode-list flex-1 overflow-y-auto px-3 py-3">
          <div className="mx-auto max-w-lg space-y-6">
            {active.length === 0 && gotIt.length === 0 ? (
              <p className="px-2 py-8 text-center text-[var(--ink-soft)]">
                Nothing on this list yet.
              </p>
            ) : null}

            {active.length === 0 && gotIt.length > 0 ? (
              <p className="rounded-2xl bg-[var(--mist)] px-4 py-3 text-center text-sm font-semibold text-[var(--leaf-deep)]">
                All done — nice one.
              </p>
            ) : null}

            {groupItemsByAisle(active).map(({ aisle, items: aisleItems }) => (
              <section key={aisle.id} className="space-y-2">
                <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--leaf)]">
                  {aisle.label}
                  <span className="ml-2 font-medium normal-case tracking-normal text-[var(--ink-soft)]">
                    ({aisleItems.length})
                  </span>
                </h2>
                <ul className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white divide-y divide-[var(--line)]">
                  {aisleItems.map((item) => (
                    <li key={item.id}>
                      <ShopModeRow
                        item={item}
                        pending={pending}
                        onToggle={() => run(() => toggleChecked(item.id))}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {gotIt.length > 0 ? (
              <section className="space-y-2 opacity-60">
                <h2 className="px-1 font-display text-lg font-bold text-[var(--ink-soft)]">
                  Got it ({gotIt.length})
                </h2>
                <ul className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white/50 divide-y divide-[var(--line)]">
                  {gotIt.map((item) => (
                    <li key={item.id}>
                      <ShopModeRow
                        item={item}
                        pending={pending}
                        done
                        onToggle={() => run(() => toggleChecked(item.id))}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <p className="px-1 pb-4 text-center text-xs text-[var(--ink-soft)]">
              {active.length} left · {gotIt.length} done
              {"wakeLock" in navigator ? " · screen stays on" : ""}
            </p>
          </div>
        </div>

        {toast ? (
          <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 max-w-[90vw] -translate-x-1/2 rounded-full bg-[var(--leaf-deep)] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
            {toast}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="chip mb-3">Supermarket mode</p>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Shopping list
        </h1>
      </section>

      <div className="grid grid-cols-3 gap-2">
        {tabs.map((tab) => {
          const activeTab = weekStart === tab.start;
          return (
            <Link
              key={tab.start}
              href={`/shop?week=${tab.start}`}
              className={`rounded-[1.25rem] border px-2 py-3 text-center transition sm:px-4 sm:text-left ${
                activeTab
                  ? "is-selected border-[var(--leaf-deep)] shadow-md"
                  : "border-[var(--line)] bg-white/60 hover:bg-white/90"
              }`}
            >
              <p className={`text-xs font-bold sm:text-sm ${activeTab ? "text-white" : ""}`}>
                {tab.title}
              </p>
              <p
                className={`mt-1 text-[0.65rem] leading-snug sm:text-xs ${
                  activeTab ? "text-white/80" : "text-[var(--ink-soft)]"
                }`}
              >
                {tab.dates}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {listId && active.length + gotIt.length > 0 ? (
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => setShoppingMode(true)}
          >
            Start shopping
          </button>
        ) : null}
        <Link href={`/plan?week=${weekStart}`} className="btn btn-ghost text-sm">
          Open plan
        </Link>
        <button
          type="button"
          className="btn btn-ghost text-sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const result = await generateShoppingList(weekStart);
              setToast(
                result.itemCount > 0
                  ? result.mealCount > 0
                    ? `Added ${result.itemCount} items from ${result.mealCount} meals`
                    : `Added ${result.itemCount} weekly pin${result.itemCount === 1 ? "" : "s"}`
                  : result.mealCount === 0
                    ? "Nothing to add — plan meals, or pin weekly staples in Settings"
                    : "Meals found but nothing left after pantry staples — check Plan",
              );
              setTimeout(() => setToast(null), 4500);
            })
          }
        >
          {listId ? "Refresh list" : "Generate list"}
        </button>
        {listId ? (
          <button
            type="button"
            className="btn btn-ghost text-sm"
            disabled={pending}
            onClick={() =>
              run(() => archiveShoppingList(listId), "List archived")
            }
          >
            Archive this list
          </button>
        ) : null}
      </div>

      {!hasPlan || plannedMealCount === 0 ? (
        <p className="rounded-2xl bg-[rgba(212,120,74,0.12)] px-4 py-3 text-sm">
          {plannedMealCount === 0
            ? "No recipes on this week’s plan yet — generate still pulls in weekly pins from Settings, or "
            : "No plan for this week yet — generate still pulls in weekly pins from Settings, or "}
          <Link href={`/plan?week=${weekStart}`} className="font-semibold underline">
            add meals on Plan
          </Link>
          .
        </p>
      ) : null}

      {listId ? (
        <CustomShopItemInput
          disabled={pending}
          excludeNames={items.filter((i) => !i.softDeleted).map((i) => i.name)}
          onAdd={(name) => run(() => addCustomItem(listId, name))}
        />
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-xl font-bold">
          To get{" "}
          <span className="text-base font-medium text-[var(--ink-soft)]">
            ({active.length})
          </span>
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">
            {listId
              ? gotIt.length > 0
                ? "All clear — everything is in Got it."
                : "Nothing on the list yet — tap Generate from plan."
              : "Generate a list from this week’s plan to start."}
          </p>
        ) : (
          <div className="space-y-6">
            {groupItemsByAisle(active).map(({ aisle, items: aisleItems }) => (
              <div key={aisle.id} className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--leaf)]">
                  {aisle.label}
                  <span className="ml-2 font-medium normal-case tracking-normal text-[var(--ink-soft)]">
                    ({aisleItems.length})
                  </span>
                </h3>
                {aisleItems.map((item) => (
                  <div key={item.id}>
                    <ItemRow
                      item={item}
                      pending={pending}
                      onCheck={() => run(() => toggleChecked(item.id))}
                      onHave={() => run(() => toggleAlreadyHave(item.id))}
                      onDelete={() =>
                        run(
                          () => softDeleteItem(item.id),
                          "Removed — restore below if needed",
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {gotIt.length > 0 ? (
        <section className="space-y-2 opacity-70">
          <h2 className="font-display text-xl font-bold text-[var(--ink-soft)]">
            Got it ({gotIt.length})
          </h2>
          {gotIt.map((item) => (
            <div key={item.id}>
              <ItemRow
                item={item}
                pending={pending}
                grey
                onCheck={() => run(() => toggleChecked(item.id))}
                onHave={() => run(() => toggleAlreadyHave(item.id))}
                onDelete={() => run(() => softDeleteItem(item.id))}
              />
            </div>
          ))}
        </section>
      ) : null}

      {removed.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-[var(--ink-soft)]">
            Removed
          </h2>
          {removed.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-2xl border border-dashed border-[var(--line)] px-4 py-3 text-sm"
            >
              <span className="line-through text-[var(--ink-soft)]">{item.name}</span>
              <button
                type="button"
                className="font-semibold text-[var(--leaf-deep)]"
                disabled={pending}
                onClick={() => run(() => restoreItem(item.id))}
              >
                Restore
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <section className="surface rounded-[1.5rem] p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setShowArchive((v) => !v)}
        >
          <div>
            <h2 className="font-display text-xl font-bold">Archived lists</h2>
            <p className="text-sm text-[var(--ink-soft)]">
              Older than last week ({archived.length})
            </p>
          </div>
          <span className="grid size-9 place-items-center rounded-full bg-[var(--mist)] font-bold">
            {showArchive ? "−" : "+"}
          </span>
        </button>
        {showArchive ? (
          <ul className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">
            {archived.length === 0 ? (
              <li className="text-sm text-[var(--ink-soft)]">No archived lists yet.</li>
            ) : (
              archived.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/60 px-3 py-3"
                >
                  <div>
                    <p className="font-semibold">{a.weekLabel}</p>
                    <p className="text-xs text-[var(--ink-soft)]">
                      {a.itemCount} items
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-sm font-semibold text-[var(--ink-soft)]"
                      disabled={pending}
                      onClick={() =>
                        run(() => unarchiveShoppingList(a.id), "Restored")
                      }
                    >
                      Unarchive
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </section>

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full bg-[var(--leaf-deep)] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function ShopModeRow({
  item,
  pending,
  done,
  onToggle,
}: {
  item: Item;
  pending: boolean;
  done?: boolean;
  onToggle: () => void;
}) {
  const qty =
    item.quantity == null || !shouldShowShopQuantity(item.name)
      ? null
      : formatQuantity(Number(item.quantity), item.unit);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left touch-manipulation active:bg-[var(--mist)]"
    >
      <span
        className={`grid size-7 shrink-0 place-items-center rounded-md border-2 ${
          done
            ? "border-[var(--leaf-deep)] bg-[var(--leaf-deep)] text-white"
            : "border-[var(--line)] bg-white"
        }`}
        aria-hidden
      >
        {done ? "✓" : null}
      </span>
      <span
        className={`min-w-0 flex-1 text-[1.05rem] font-semibold leading-snug ${
          done ? "text-[var(--ink-soft)] line-through" : ""
        }`}
      >
        {qty && !done ? (
          <span className="text-[var(--leaf-deep)]">{qty} </span>
        ) : qty ? (
          <span>{qty} </span>
        ) : null}
        {item.name}
      </span>
    </button>
  );
}

function ItemRow({
  item,
  pending,
  grey,
  onCheck,
  onHave,
  onDelete,
}: {
  item: Item;
  pending: boolean;
  grey?: boolean;
  onCheck: () => void;
  onHave: () => void;
  onDelete: () => void;
}) {
  const qty =
    item.quantity == null || !shouldShowShopQuantity(item.name)
      ? null
      : formatQuantity(Number(item.quantity), item.unit);

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-white/60 px-2 py-2 transition sm:gap-3 sm:px-3 sm:py-3 ${
        grey ? "bg-white/35" : ""
      }`}
    >
      <button
        type="button"
        aria-label="Toggle got it"
        disabled={pending}
        onClick={onCheck}
        className={`touch-target grid size-11 shrink-0 place-items-center rounded-xl border sm:size-10 ${
          item.checked || item.alreadyHave
            ? "border-[var(--leaf-deep)] bg-[var(--leaf-deep)] text-white"
            : "border-[var(--line)] bg-white"
        }`}
      >
        {(item.checked || item.alreadyHave) && (
          <span className="text-sm font-bold text-white">✓</span>
        )}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onCheck}
        className="min-w-0 flex-1 py-2 text-left touch-manipulation"
      >
        <p className={`text-base font-semibold leading-snug ${grey ? "line-through" : ""}`}>
          {qty ? <span className="text-[var(--leaf-deep)]">{qty} </span> : null}
          {item.name}
          {item.source === "custom" ? (
            <span className="ml-2 text-xs font-medium text-[var(--ink-soft)]">
              custom
            </span>
          ) : null}
          {item.source === "pinned" ? (
            <span className="ml-2 text-xs font-medium text-[var(--ink-soft)]">
              weekly
            </span>
          ) : null}
        </p>
        {item.note ? (
          <p className="text-xs text-[var(--ink-soft)]">{item.note}</p>
        ) : null}
        {item.alreadyHave ? (
          <p className="text-xs font-medium text-[var(--ink-soft)]">Already have</p>
        ) : null}
      </button>
      <div className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          className="touch-target rounded-lg px-2 text-xs font-semibold text-[var(--ink-soft)] sm:px-1"
          disabled={pending}
          onClick={onHave}
        >
          Have
        </button>
        <button
          type="button"
          className="touch-target rounded-lg px-2 text-xs font-semibold text-[var(--bloom)] sm:px-1"
          disabled={pending}
          onClick={onDelete}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
