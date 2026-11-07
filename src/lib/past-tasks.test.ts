import { describe, expect, it } from "vitest";
import { EMPTY_PAST, filterPast, spendTone } from "./past-tasks";
import type { Task } from "./club";

const t = (id: string, status: Task["status"], completed_at: string | null, extra: Partial<Task> = {}) =>
  ({ id, status, completed_at, created_at: "2026-01-01T00:00:00Z", title: id, assignee_id: null, category_id: null, ...extra }) as Task;

describe("past tasks", () => {
  const all = [
    t("open", "assigned", null),
    t("a", "done", "2026-03-01T10:00:00Z", { assignee_id: "m1" }),
    t("b", "cancelled", "2026-03-05T10:00:00Z"),
  ];
  it("only includes done and cancelled, newest first", () => {
    expect(filterPast(all, EMPTY_PAST).map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("filters by status, person and date", () => {
    expect(filterPast(all, { ...EMPTY_PAST, status: "cancelled" }).map((x) => x.id)).toEqual(["b"]);
    expect(filterPast(all, { ...EMPTY_PAST, member: "m1" }).map((x) => x.id)).toEqual(["a"]);
    expect(filterPast(all, { ...EMPTY_PAST, to: "2026-03-02" }).map((x) => x.id)).toEqual(["a"]);
  });
  it("is red only when spent is over the limit", () => {
    expect(spendTone(5000, 5000)).toBe("under");
    expect(spendTone(5001, 5000)).toBe("over");
  });
});
