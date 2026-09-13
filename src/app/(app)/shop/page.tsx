import { formatWeekRange, parseDateOnly } from "@/lib/dates";
import { getShoppingList } from "./actions";
import { ShopClient } from "./ShopClient";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const data = await getShoppingList(week);

  return (
    <ShopClient
      weekStart={data.weekStart}
      weekLabel={data.weekLabel}
      lastWeekStart={data.lastWeekStart}
      lastWeekLabel={data.lastWeekLabel}
      nextWeekStart={data.nextWeekStart}
      nextWeekLabel={data.nextWeekLabel}
      thisWeekStart={data.thisWeekStart}
      thisWeekLabel={formatWeekRange(parseDateOnly(data.thisWeekStart))}
      listId={data.list?.id ?? null}
      hasPlan={data.hasPlan}
      plannedMealCount={data.plannedMealCount}
      archived={data.archived}
      items={(data.list?.items || []).map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity == null ? null : i.quantity.toString(),
        unit: i.unit,
        source: i.source,
        checked: i.checked,
        alreadyHave: i.alreadyHave,
        softDeleted: i.softDeleted,
        note: i.note,
      }))}
    />
  );
}
