// All money is integer cents. Never use floating-point math on amounts.

/** Parse a user-typed dollar string ("1,234.5", "$12") into integer cents, or null if invalid. */
export function parseDollarsToCents(input: string): number | null {
  const s = input.replace(/[$,\s]/g, "");
  if (s === "") return null;
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = (m[2] ?? "").padEnd(2, "0");
  return whole * 100 + Number(frac);
}

/** Format integer cents as $1,234.56 (negative as -$1,234.56). */
export function formatCents(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${neg ? "-" : ""}$${dollars.toLocaleString("en-US")}.${String(rem).padStart(2, "0")}`;
}

/** Split cents into a dollars string ("$1,234") and cents string (".56") for display. */
export function splitCents(cents: number): { dollars: string; cents: string } {
  const f = formatCents(cents);
  const i = f.lastIndexOf(".");
  return { dollars: f.slice(0, i), cents: f.slice(i) };
}

export type Health = "green" | "yellow" | "red";

/**
 * Health rule: red if spent > budget; yellow if 80%+ spent, or spent + promised > budget;
 * otherwise green.
 */
export function budgetHealth(spent: number, promised: number, budget: number): Health {
  if (spent > budget) return "red";
  if (spent * 100 >= budget * 80 && budget > 0) return "yellow";
  if (spent + promised > budget) return "yellow";
  return "green";
}

export const HEALTH_LABEL: Record<Health, string> = {
  green: "On track",
  yellow: "Watch closely",
  red: "Over budget",
};

/** Whole percent used, 0..100+ (integer math). */
export function percentUsed(spent: number, budget: number): number {
  if (budget <= 0) return spent > 0 ? 100 : 0;
  return Math.floor((spent * 100) / budget);
}
