import type { Txn } from "./club";

export type TxnFilters = {
  member: string; // "" = all
  category: string;
  source: string;
  from: string; // YYYY-MM-DD or ""
  to: string;
  q: string;
};

export const EMPTY_FILTERS: TxnFilters = { member: "", category: "", source: "", from: "", to: "", q: "" };

/** Apply filters, newest added first. */
export function filterTxns(txns: Txn[], f: TxnFilters, names: Record<string, string> = {}): Txn[] {
  const q = f.q.trim().toLowerCase();
  return txns
    .filter((t) => (!f.member || t.member_id === f.member)
      && (!f.category || t.category_id === f.category)
      && (!f.source || t.source === f.source)
      && (!f.from || t.purchase_date >= f.from)
      && (!f.to || t.purchase_date <= f.to)
      && (!q || t.merchant.toLowerCase().includes(q) || (names[t.member_id ?? ""] ?? "").toLowerCase().includes(q)))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV of the given rows. Amount written from integer cents, e.g. 1234 -> 12.34. */
export function txnsToCsv(rows: Txn[], members: Record<string, string>, cats: Record<string, string>, reimb: Record<string, string> = {}): string {
  const head = ["Date", "Merchant", "Amount", "Category", "Person", "Source", "Added", "Reimbursement status"];
  const lines = rows.map((t) => {
    const a = Math.abs(t.amount_cents);
    const amt = `${t.amount_cents < 0 ? "-" : ""}${Math.floor(a / 100)}.${String(a % 100).padStart(2, "0")}`;
    return [t.purchase_date, t.merchant, amt, cats[t.category_id ?? ""] ?? "", members[t.member_id ?? ""] ?? "", t.source, t.created_at, reimb[t.id] ?? ""]
      .map((v) => cell(String(v))).join(",");
  });
  return [head.join(","), ...lines].join("\n");
}
