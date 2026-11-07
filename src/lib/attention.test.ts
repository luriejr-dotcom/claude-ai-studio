import { describe, expect, it } from "vitest";
import { reimbursementNeedsAttention, taskNeedsAttention } from "./attention";

describe("action-required indicators", () => {
  it("marks open tasks for execs", () => {
    expect(taskNeedsAttention({ status: "assigned", assignee_id: "other" }, true, "me")).toBe(true);
    expect(taskNeedsAttention({ status: "receipt_uploaded", assignee_id: "other" }, true, "me")).toBe(true);
  });
  it("only marks an officer's own tasks", () => {
    expect(taskNeedsAttention({ status: "assigned", assignee_id: "me" }, false, "me")).toBe(true);
    expect(taskNeedsAttention({ status: "assigned", assignee_id: "other" }, false, "me")).toBe(false);
  });
  it.each(["done", "cancelled"] as const)("clears the task indicator for %s tasks", (status) => {
    expect(taskNeedsAttention({ status, assignee_id: "me" }, true, "me")).toBe(false);
  });
  it.each(["submitted", "approved"] as const)("marks %s reimbursements needing exec action", (status) => {
    expect(reimbursementNeedsAttention({ status }, true)).toBe(true);
    expect(reimbursementNeedsAttention({ status }, false)).toBe(false);
  });
  it.each(["paid", "denied"] as const)("clears the reimbursement indicator for %s requests", (status) => {
    expect(reimbursementNeedsAttention({ status }, true)).toBe(false);
  });
});