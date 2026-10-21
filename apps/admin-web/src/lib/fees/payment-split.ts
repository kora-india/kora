/**
 * What a fee payment does to each item (U10), shared by the two collection
 * screens and matching the server.
 *
 * A month whose item amounts (as shown on screen) add up to the amount
 * entered is sent item by item, so the receipt matches the preview. Any other
 * month is sent as a total, and the server fills its items in id order
 * (creation order) — the same order `splitMonthTotal` uses for the preview.
 */

export interface SplitItem {
  id: string;
  /** What is still owed; 0 for paid or waived items. */
  due: number;
}

export interface SplitMonth {
  id: string;
  items: SplitItem[];
}

const money = (n: number) => Math.round(n * 100) / 100;

/** The order the server fills a month's items in. */
export function allocationOrder<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** How a month total lands on its items; anything over the dues is surplus. */
export function splitMonthTotal(items: SplitItem[], amount: number) {
  let left = money(amount);
  const allocations: { itemId: string; amount: number }[] = [];
  for (const item of allocationOrder(items)) {
    if (left <= 0) break;
    const due = money(item.due);
    if (due <= 0) continue;
    const take = money(Math.min(due, left));
    allocations.push({ itemId: item.id, amount: take });
    left = money(left - take);
  }
  return { allocations, surplus: left };
}

/** The item amounts entered for a month, when they account for all of it. */
function itemBreakdown(
  month: SplitMonth,
  amount: number,
  itemAmounts: Record<string, string>,
) {
  const parts = month.items
    .map((it) => ({
      itemId: it.id,
      amount: money(Number(itemAmounts[it.id]) || 0),
    }))
    .filter((p) => p.amount > 0);
  const total = money(parts.reduce((s, p) => s + p.amount, 0));
  return parts.length > 0 && total === money(amount) ? parts : null;
}

/** What the preview shows for one month. */
export function previewMonth(
  month: SplitMonth,
  amount: number,
  itemAmounts: Record<string, string>,
) {
  const parts = itemBreakdown(month, amount, itemAmounts);
  if (parts) {
    // Item path: anything above an item's due is credited as advance.
    const dueById = new Map(month.items.map((it) => [it.id, money(it.due)]));
    let surplus = 0;
    const allocations = parts.map((p) => {
      const due = dueById.get(p.itemId) ?? 0;
      surplus = money(surplus + Math.max(0, p.amount - due));
      return { itemId: p.itemId, amount: money(Math.min(due, p.amount)) };
    });
    return { allocations: allocations.filter((a) => a.amount > 0), surplus };
  }
  return splitMonthTotal(month.items, amount);
}

/** The `allocatePayment` amounts for the selected months. */
export function buildPaymentPayload(
  months: SplitMonth[],
  selected: Record<string, boolean>,
  monthAmounts: Record<string, string>,
  itemAmounts: Record<string, string>,
) {
  const monthPayments: { chargeId: string; amount: number }[] = [];
  const itemPayments: { chargeItemId: string; amount: number }[] = [];
  for (const month of months) {
    const amount = money(Number(monthAmounts[month.id]) || 0);
    if (!selected[month.id] || amount <= 0) continue;
    const parts = itemBreakdown(month, amount, itemAmounts);
    if (parts) {
      parts.forEach((p) =>
        itemPayments.push({ chargeItemId: p.itemId, amount: p.amount }),
      );
    } else {
      monthPayments.push({ chargeId: month.id, amount });
    }
  }
  return { monthPayments, itemPayments };
}
