"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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

  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="chip mb-3">Supermarket mode</p>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Shopping list
        </h1>
      </section>

      <div className="grid gap-2 sm:grid-cols-3">
        {tabs.map((tab) => {
          const activeTab = weekStart === tab.start;
          return (
            <Link
              key={tab.start}
              href={`/shop?week=${tab.start}`}
              className={`rounded-[1.25rem] border px-4 py-3 transition ${
                activeTab
                  ? "border-[var(--leaf)] bg-[var(--leaf-deep)] text-[#f7fbf8] shadow-md"
                  : "border-[var(--line)] bg-white/60 hover:bg-white/90"
              }`}
            >
              <p className="text-sm font-bold">{tab.title}</p>
              <p
                className={`mt-1 text-xs leading-snug ${
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
        <Link href={`/plan?week=${weekStart}`} className="btn btn-ghost text-sm">
          Open plan
        </Link>
        <button
          type="button"
          className="btn btn-primary text-sm"
          disabled={pending || !hasPlan}
          onClick={() =>
            run(async () => {
              const result = await generateShoppingList(weekStart);
              setToast(
                result.itemCount > 0
                  ? `Added ${result.itemCount} items from ${result.mealCount} meals`
                  : result.mealCount === 0
                    ? "No meals on this week’s plan yet"
                    : "Meals found but nothing left after pantry staples — check Plan",
              );
              setTimeout(() => setToast(null), 4500);
            })
          }
        >
          {listId ? "Refresh from plan" : "Generate from plan"}
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

      {!hasPlan ? (
        <div className="surface rounded-[1.5rem] p-8 text-center">
          <p className="font-display text-2xl font-bold">No plan for this week</p>
          <p className="mt-2 text-[var(--ink-soft)]">
            Build a meal plan for <strong>{weekLabel}</strong>, then generate
            your list.
          </p>
          <Link href={`/plan?week=${weekStart}`} className="btn btn-primary mt-5">
            Open plan
          </Link>
        </div>
      ) : null}

      {hasPlan && plannedMealCount === 0 ? (
        <p className="rounded-2xl bg-[rgba(212,120,74,0.12)] px-4 py-3 text-sm">
          This week’s plan has no recipes yet — add meals on Plan, then generate
          the list.
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
                  <div key={item.id} className="animate-rise">
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
            <div key={item.id} className="animate-sink">
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
        <div className="fixed bottom-5 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full bg-[var(--leaf-deep)] px-4 py-2 text-center text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
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
      className={`flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-white/60 px-3 py-3 transition ${
        grey ? "bg-white/35" : ""
      }`}
    >
      <button
        type="button"
        aria-label="Toggle got it"
        disabled={pending}
        onClick={onCheck}
        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border ${
          item.checked || item.alreadyHave
            ? "border-[var(--leaf)] bg-[var(--leaf-soft)]"
            : "border-[var(--line)] bg-white"
        }`}
      >
        {(item.checked || item.alreadyHave) && (
          <span className="text-xs font-bold text-[var(--leaf-deep)]">✓</span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${grey ? "line-through" : ""}`}>
          {qty ? <span className="text-[var(--leaf-deep)]">{qty} </span> : null}
          {item.name}
          {item.source === "custom" ? (
            <span className="ml-2 text-xs font-medium text-[var(--ink-soft)]">
              custom
            </span>
          ) : null}
        </p>
        {item.note ? (
          <p className="text-xs text-[var(--ink-soft)]">{item.note}</p>
        ) : null}
        {item.alreadyHave ? (
          <p className="text-xs font-medium text-[var(--ink-soft)]">Already have</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          className="text-xs font-semibold text-[var(--ink-soft)]"
          disabled={pending}
          onClick={onHave}
        >
          Have
        </button>
        <button
          type="button"
          className="text-xs font-semibold text-[var(--bloom)]"
          disabled={pending}
          onClick={onDelete}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
