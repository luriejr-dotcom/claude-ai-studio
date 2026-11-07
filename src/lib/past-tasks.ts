import type { Task } from "./club";

export type PastFilters = { q: string; member: string; category: string; status: "" | "done" | "cancelled"; from: string; to: string };
export const EMPTY_PAST: PastFilters = { q: "", member: "", category: "", status: "", from: "", to: "" };

export const isPast = (t: Pick<Task, "status">) => t.status === "done" || t.status === "cancelled";

/** Finished date as YYYY-MM-DD (local), falling back to created date. */
export const finishedDay = (t: Pick<Task, "completed_at" | "created_at">) => (t.completed_at ?? t.created_at).slice(0, 10);

/** Past (done/cancelled) tasks matching filters, most recently finished first. */
export function filterPast<T extends Task>(tasks: T[], f: PastFilters): T[] {
  const q = f.q.trim().toLowerCase();
  return tasks
    .filter((t) => isPast(t))
    .filter((t) => !f.status || t.status === f.status)
    .filter((t) => !f.member || t.assignee_id === f.member)
    .filter((t) => !f.category || t.category_id === f.category)
    .filter((t) => !f.from || finishedDay(t) >= f.from)
    .filter((t) => !f.to || finishedDay(t) <= f.to)
    .filter((t) => !q || t.title.toLowerCase().includes(q))
    .sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at));
}

/** Spent vs limit: "under" (incl. equal) is fine, "over" exceeds a set limit. */
export function spendTone(spent: number, limit: number): "under" | "over" {
  return limit > 0 && spent > limit ? "over" : "under";
}
