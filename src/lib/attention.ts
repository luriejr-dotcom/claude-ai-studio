import type { Task } from "./club";
import type { Reimb } from "./reimb";

export function taskNeedsAttention(task: Pick<Task, "status" | "assignee_id">, exec: boolean, memberId: string) {
  return (task.status === "assigned" || task.status === "receipt_uploaded") && (exec || task.assignee_id === memberId);
}

export function reimbursementNeedsAttention(request: Pick<Reimb, "status">, exec: boolean) {
  return exec && (request.status === "submitted" || request.status === "approved");
}