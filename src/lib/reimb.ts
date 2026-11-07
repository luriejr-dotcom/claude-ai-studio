import type { Database } from "@/integrations/supabase/types";

export type Reimb = Database["public"]["Tables"]["reimbursements"]["Row"];
export type ReimbStatus = Reimb["status"];
export type PayMethod = NonNullable<Reimb["paid_method"]>;

export const STATUS_LABEL: Record<ReimbStatus, string> = { submitted: "Waiting for approval", approved: "Approved · not paid", denied: "Denied", paid: "Paid" };
export const METHOD_LABEL: Record<PayMethod, string> = { venmo: "Venmo", zelle: "Zelle", cash: "Cash", check: "Check", club_card_refund: "Club card refund", other: "Other" };

/** Budget card numbers: owed = approved but unpaid; waiting = submitted. */
export function reimbSummary(rows: Pick<Reimb, "status" | "amount_cents" | "created_at">[]) {
  const waiting = rows.filter((r) => r.status === "submitted");
  return {
    owedCents: rows.filter((r) => r.status === "approved").reduce((s, r) => s + r.amount_cents, 0),
    waitingCount: waiting.length,
    oldestWaiting: waiting.reduce<string | null>((o, r) => (o === null || r.created_at < o ? r.created_at : o), null),
  };
}

export type ReimbFilters = { status: "" | ReimbStatus; member: string; from: string; to: string };
export const EMPTY_REIMB: ReimbFilters = { status: "", member: "", from: "", to: "" };

export function filterReimb<T extends Reimb>(rows: T[], f: ReimbFilters): T[] {
  return rows
    .filter((r) => !f.status || r.status === f.status)
    .filter((r) => !f.member || r.member_id === f.member)
    .filter((r) => !f.from || r.created_at.slice(0, 10) >= f.from)
    .filter((r) => !f.to || r.created_at.slice(0, 10) <= f.to)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
