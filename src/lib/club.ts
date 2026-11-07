import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];
export type Member = T["members"]["Row"];
export type Semester = T["semesters"]["Row"];
export type Category = T["categories"]["Row"];
export type Task = T["tasks"]["Row"];
export type Txn = T["transactions"]["Row"];
export type Flag = T["flags"]["Row"];

export const isExecRole = (r?: string | null) => r === "president" || r === "treasurer";

export async function fetchMe() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    await supabase.rpc("claim_membership");
    const { data } = await supabase
      .from("members")
      .select("*, clubs(name)")
      .eq("user_id", u.user.id)
      .eq("active", true)
      .maybeSingle();
    return data;
}

export const meQuery = queryOptions({ queryKey: ["me"], queryFn: fetchMe });

export const membersQuery = queryOptions({
  queryKey: ["members"],
  queryFn: async () => {
    const { data, error } = await supabase.from("members").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("list_categories");
    if (error) throw error;
    return data;
  },
});

export const tasksQuery = queryOptions({
  queryKey: ["tasks"],
  queryFn: async () => {
    const { data, error } = await supabase.from("tasks").select("*").order("created_at");
    if (error) throw error;
    return data;
  },
});

export const budgetQuery = queryOptions({
  queryKey: ["budget"],
  queryFn: async () => {
    const [s, t, f] = await Promise.all([
      supabase.from("semesters").select("*").order("start_date", { ascending: false }).limit(1),
      supabase.from("transactions").select("*"),
      supabase.from("flags").select("*").eq("status", "open"),
    ]);
    if (s.error) throw s.error;
    if (t.error) throw t.error;
    if (f.error) throw f.error;
    return { semester: s.data[0] ?? null, txns: t.data ?? [], flags: f.data ?? [] };
  },
});

const AVATAR_HUES = [160, 40, 75, 230, 340, 15, 280, 120];
export function avatarHue(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}
export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

export function isOverdue(t: Pick<Task, "due_date" | "status">) {
  if (!t.due_date || t.status === "done" || t.status === "cancelled") return false;
  return t.due_date < new Date().toISOString().slice(0, 10);
}
