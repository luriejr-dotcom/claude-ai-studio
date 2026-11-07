import { parseDollarsToCents } from "./money";

export type ReceiptReading = {
  isReceipt: boolean;
  merchant: string;
  date: string; // YYYY-MM-DD or ""
  totalCents: number | null;
  note: string;
};

function realDate(s: unknown): string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : "";
}

/** Re-check the AI's raw JSON in code; anything that fails becomes blank. */
export function sanitizeReading(raw: unknown): ReceiptReading {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const currency = typeof r["currency"] === "string" ? r["currency"].trim().toUpperCase() : "";
  const usd = currency === "" || currency === "USD" || currency === "$";
  const total = typeof r["total"] === "string" || typeof r["total"] === "number" ? String(r["total"]) : "";
  const cents = usd && /^\$?\d{1,3}(,?\d{3})*(\.\d{1,2})?$/.test(total.trim()) ? parseDollarsToCents(total) : null;
  const merchant = typeof r["merchant"] === "string" ? r["merchant"].trim().slice(0, 120) : "";
  let note = typeof r["notes"] === "string" ? r["notes"].trim().slice(0, 300) : "";
  if (!usd) note = [note, `Receipt is in ${currency}; enter the USD total.`].filter(Boolean).join(" ");
  return {
    isReceipt: r["is_receipt"] === true,
    merchant,
    date: realDate(r["date"]),
    totalCents: cents && cents > 0 ? cents : null,
    note,
  };
}
