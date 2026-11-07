import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Forward, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, isOverdue, membersQuery, tasksQuery, type Member, type Task } from "@/lib/club";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { ReceiptStep } from "./ReceiptStep";
import { Avatar, CategoryIcon, Empty } from "./bits";
import { cn } from "@/lib/utils";

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function TasksScreen({ me, exec }: { me: Member; exec: boolean }) {
  const qc = useQueryClient();
  const { data: tasks = [] } = useQuery(tasksQuery);
  const { data: members = [] } = useQuery(membersQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [open, setOpen] = useState<Task | null>(null);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const catById = new Map(cats.map((c) => [c.id, c]));

  const log = (action: string, detail: string, task_id: string) =>
    supabase.from("activity_log").insert({ club_id: me.club_id, actor_id: me.id, action, detail, task_id });

  const delegate = useMutation({
    mutationFn: async ({ t, m }: { t: Task; m: Member }) => {
      const { error } = await supabase.from("tasks").update({ assignee_id: m.id }).eq("id", t.id);
      if (error) throw error;
      await log("task_delegated", `${t.title} → ${m.name}`, t.id);
      return m;
    },
    onSuccess: (m) => {
      toast.success(`Sent to ${m.name}`);
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = tasks
    .filter((t) => t.status !== "cancelled")
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  const active = members.filter((m) => m.active);

  return (
    <div className="surface overflow-hidden">
      {visible.length === 0 && (
        <Empty title="All caught up!" line={exec ? "Add a task below to get things moving." : "Nothing on your plate right now."} />
      )}
      <ul className="divide-y divide-border">
        {visible.map((t, i) => {
          const done = t.status === "done";
          const overdue = isOverdue(t);
          const cat = t.category_id ? catById.get(t.category_id) : undefined;
          const who = t.assignee_id ? memberById.get(t.assignee_id) : undefined;
          return (
            <li key={t.id} className="animate-fade-up flex items-center gap-3 px-4 py-3 hover:bg-muted/50" style={{ animationDelay: `${i * 25}ms` }}>
              <button
                aria-label={done ? `${t.title} is done` : `Finish ${t.title} with a receipt`}
                onClick={() => setOpen(t)}
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  done ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary",
                )}
              >
                {done && <Check className="size-3.5" strokeWidth={3} />}
              </button>
              <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(t)}>
                <div className={cn("truncate font-medium", done && "text-muted-foreground line-through")}>{t.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {t.due_date && (
                    <span className={cn(overdue && "font-semibold text-destructive")}>
                      {overdue ? "Overdue · " : "Due "}{fmtDate(t.due_date)}
                    </span>
                  )}
                  {t.limit_cents > 0 && <span>Up to {formatCents(t.limit_cents)}</span>}
                  {cat && <span className="inline-flex items-center gap-1"><CategoryIcon name={cat.name} className="size-3" />{cat.name}</span>}
                  {exec && who && <span className="inline-flex items-center gap-1"><Avatar id={who.id} name={who.name} size={16} />{who.name}</span>}
                  {t.status === "receipt_uploaded" && <span className="text-accent-foreground">Receipt in</span>}
                </div>
              </button>
              {exec && t.status === "assigned" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Delegate ${t.title}`}><Forward /></Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-1">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Send to…</div>
                    {active.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => delegate.mutate({ t, m })}
                        className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", m.id === t.assignee_id && "bg-secondary")}
                      >
                        <Avatar id={m.id} name={m.name} size={24} />
                        <span className="min-w-0 flex-1"><span className="block truncate">{m.name}</span><span className="block truncate text-xs text-muted-foreground">{m.title}</span></span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              )}
            </li>
          );
        })}
      </ul>
      {exec && <AddTask me={me} members={active} cats={cats} onAdded={(id, title) => log("task_created", title, id)} />}

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="overflow-y-auto">
          {open && (
            <>
              <SheetHeader><SheetTitle className="font-display text-2xl">{open.title}</SheetTitle></SheetHeader>
              <dl className="mt-6 space-y-4 px-4 text-sm">
                <Row k="Status" v={{ assigned: "To do", receipt_uploaded: "Receipt uploaded", done: "Done", cancelled: "Cancelled" }[open.status]} />
                <Row k="Spending limit" v={formatCents(open.limit_cents)} />
                <Row k="Due" v={open.due_date ? fmtDate(open.due_date) : "No date"} />
                <Row k="Task type" v={(open.category_id && catById.get(open.category_id)?.name) || "—"} />
                {exec && <Row k="Assigned to" v={(open.assignee_id && memberById.get(open.assignee_id)?.name) || "Nobody"} />}
                {open.notes && <Row k="Notes" v={<span className="whitespace-pre-wrap">{open.notes}</span>} />}
              </dl>
              {open.status !== "done" && open.status !== "cancelled" && (open.assignee_id === me.id
                ? <ReceiptStep task={open} onDone={() => setOpen(null)} />
                : <p className="mt-6 px-4 text-sm text-muted-foreground">Only the person assigned can finish this task by adding its receipt.</p>)}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}

function AddTask({ me, members, cats, onAdded }: {
  me: Member; members: Member[]; cats: { id: string; name: string; semester_id: string }[];
  onAdded: (id: string, title: string) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const empty = { title: "", assignee: "", category: "", limit: "", due: "", notes: "" };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const limit = f.limit ? parseDollarsToCents(f.limit) : 0;
    if (limit === null) { toast.error("Spending limit should look like 25 or 25.50"); return; }
    const cat = cats.find((c) => c.id === f.category) ?? cats[0];
    let semester_id = cat?.semester_id;
    if (!semester_id) {
      const { data } = await supabase.from("semesters").select("id").order("start_date", { ascending: false }).limit(1);
      semester_id = data?.[0]?.id;
    }
    if (!semester_id) { toast.error("Set up a semester first"); return; }
    setBusy(true);
    const { data, error } = await supabase.from("tasks").insert({
      club_id: me.club_id, semester_id, title: f.title.trim(), notes: f.notes,
      assignee_id: f.assignee || null, category_id: f.category || null, created_by: me.id,
      limit_cents: limit, due_date: f.due || null,
    }).select("id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    onAdded(data.id, f.title.trim());
    setF(empty);
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["budget"] });
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left text-muted-foreground hover:bg-muted/50 hover:text-foreground">
        <span className="flex size-6 items-center justify-center rounded-full border-2 border-dashed border-input"><Plus className="size-3.5" /></span>
        Add a task
      </button>
    );

  const sel = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <form onSubmit={submit} className="animate-fade-up grid gap-3 border-t border-border bg-muted/40 p-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="t-title">Task</Label><Input id="t-title" autoFocus required maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Buy pizza for rush night" /></div>
      <div className="space-y-1.5"><Label htmlFor="t-who">Assign to</Label>
        <select id="t-who" className={sel} value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>
          <option value="">Nobody yet</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.title ? ` — ${m.title}` : ""}</option>)}
        </select></div>
      <div className="space-y-1.5"><Label htmlFor="t-cat">Task type</Label>
        <select id="t-cat" className={sel} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          <option value="">Pick one</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></div>
      <div className="space-y-1.5"><Label htmlFor="t-lim">Spending limit ($)</Label><Input id="t-lim" inputMode="decimal" value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value })} placeholder="50.00" /></div>
      <div className="space-y-1.5"><Label htmlFor="t-due">Due date</Label><Input id="t-due" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="t-notes">Notes</Label><Textarea id="t-notes" rows={2} maxLength={2000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      <div className="flex gap-2 sm:col-span-2">
        <Button disabled={busy}>Add task</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
