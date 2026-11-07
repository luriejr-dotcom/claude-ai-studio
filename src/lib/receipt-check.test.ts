import { describe, expect, it } from "vitest";
import { sanitizeReading } from "./receipt-check";

describe("receipt re-check", () => {
  it("keeps valid values", () => {
    const r = sanitizeReading({ is_receipt: true, merchant: "Costco", date: "2026-03-04", total: "48.20", currency: "USD" });
    expect(r).toMatchObject({ merchant: "Costco", date: "2026-03-04", totalCents: 4820 });
  });
  it("blanks an impossible date", () => {
    expect(sanitizeReading({ date: "2026-02-30" }).date).toBe("");
  });
  it("blanks a total that doesn't look like money", () => {
    expect(sanitizeReading({ total: "about 40" }).totalCents).toBeNull();
  });
  it("blanks the total for non-USD receipts", () => {
    expect(sanitizeReading({ total: "12.00", currency: "EUR" }).totalCents).toBeNull();
  });
});
