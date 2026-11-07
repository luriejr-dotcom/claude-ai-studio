import { describe, expect, it } from "vitest";
import { reimbSummary } from "./reimb";

describe("reimbursement summary", () => {
  const rows = [
    { status: "submitted" as const, amount_cents: 500, created_at: "2026-03-05T00:00:00Z" },
    { status: "submitted" as const, amount_cents: 700, created_at: "2026-03-01T00:00:00Z" },
    { status: "approved" as const, amount_cents: 1200, created_at: "2026-02-01T00:00:00Z" },
    { status: "paid" as const, amount_cents: 9999, created_at: "2026-01-01T00:00:00Z" },
    { status: "denied" as const, amount_cents: 300, created_at: "2026-01-01T00:00:00Z" },
  ];
  it("owed counts only approved, unpaid requests", () => {
    expect(reimbSummary(rows).owedCents).toBe(1200);
  });
  it("counts waiting requests and finds the oldest", () => {
    expect(reimbSummary(rows).waitingCount).toBe(2);
    expect(reimbSummary(rows).oldestWaiting).toBe("2026-03-01T00:00:00Z");
  });
});
