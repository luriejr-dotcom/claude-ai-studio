import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, filterTxns, txnsToCsv } from "./txns";
import type { Txn } from "./club";

const t = (o: Partial<Txn>): Txn => ({
  ai_corrected: false, amount_cents: 100, category_id: "c1", club_id: "k", created_at: "2026-01-01T00:00:00Z",
  id: Math.random().toString(), member_id: "m1", merchant: "Shop", purchase_date: "2026-01-01",
  receipt_path: null, ai_date: null, ai_merchant: null, ai_note: "", ai_total_cents: null, confirmed_at: null, confirmed_by: null, receipt_hash: null, semester_id: "s", source: "manual", task_id: null, ...o,
}) as Txn;

describe("transactions", () => {
  it("sorts newest added first", () => {
    const r = filterTxns([t({ merchant: "old", created_at: "2026-01-01" }), t({ merchant: "new", created_at: "2026-02-01" })], EMPTY_FILTERS);
    expect(r.map((x) => x.merchant)).toEqual(["new", "old"]);
  });
  it("filters by date range inclusive and person", () => {
    const rows = [t({ purchase_date: "2026-01-05" }), t({ purchase_date: "2026-01-10", member_id: "m2" }), t({ purchase_date: "2026-01-20" })];
    expect(filterTxns(rows, { ...EMPTY_FILTERS, from: "2026-01-05", to: "2026-01-10" })).toHaveLength(2);
    expect(filterTxns(rows, { ...EMPTY_FILTERS, member: "m2" })).toHaveLength(1);
  });
  it("writes cents as dollars in CSV", () => {
    const csv = txnsToCsv([t({ amount_cents: 123456, merchant: "A, B" })], { m1: "Ana" }, { c1: "Food" });
    expect(csv.split("\n")[1]).toBe('2026-01-01,"A, B",1234.56,Food,Ana,manual,2026-01-01T00:00:00Z,');
  });
  it("adds the reimbursement status column", () => {
    const row = t({});
    const csv = txnsToCsv([row], {}, {}, { [row.id]: "approved" });
    expect(csv.split("\n")[0]!.endsWith("Reimbursement status")).toBe(true);
    expect(csv.split("\n")[1]!.endsWith(",approved")).toBe(true);
  });
});
