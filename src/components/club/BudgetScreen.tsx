import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { budgetQuery, categoriesQuery, isOverdue, meQuery, tasksQuery, type Category, type Semester } from "@/lib/club";
import { budgetHealth, formatCents, HEALTH_LABEL, parseDollarsToCents, percentUsed, splitCents, type Health } from "@/lib/money";
import { CategoryIcon, Empty } from "./bits";
import { cn } from "@/lib/utils";

const PILL: Record<Health, string> = {
  green: "bg-success/20 text-success",
  yellow: "bg-warning/25 text-foreground",
  red: "bg-destructive/15 text-destructive",
};
const BAR: Record<Health, string> = { green: "bg-success", yellow: "bg-warning", red: "bg-destructive" };
const SEV = { high: 0, medium: 1, low: 2 } as const;

export function BudgetScreen() {
  const { data } = useQuery(budgetQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: tasks = [] } = useQuery(tasksQuery);
  const [edit, setEdit] = useState(false);
  if (!data) return null;
  const { semester, txns, flags } = data;
  if (!semester) return <div className="surface"><Empty title="No semester yet" line="Create one to start budgeting." /></div>;

  const semCats = cats.filter((c) => c.semester_id === semester.id);
  const semTasks = tasks.filter((t) => t.semester_id === semester.id);
  const semTxns = txns.filter((t) => t.semester_id === semester.id);
  const spent = semTxns.reduce((s, t) => s + t.amount_cents, 0);
  const promised = semTasks.filter((t) => t.status === "assigned").reduce((s, t) => s + t.limit_cents, 0);
  const total = semester.total_budget_cents;
  const left = total - spent;
  const health = budgetHealth(spent, promised, total);
  const pct = percentUsed(spent, total);
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  const daysLeft = Math.max(0, Math.round((new Date(semester.end_date + "T00:00:00").getTime() - today.getTime()) / 86400000));
  const { dollars, cents } = splitCents(left);
  const seg = (v: number) => (total > 0 ? `${Math.min(100, (Math.max(0, v) * 100) / total)}%` : "0%");
  const assigned = semCats.reduce((s, c) => s + c.budget_cents, 0);

  const openTasks = semTasks.filter((t) => t.status === "assigned" || t.status === "receipt_uploaded");
  const overdue = semTasks.filter(isOverdue).length;
  const waiting = semTasks.filter((t) => t.status === "receipt_uploaded").length;
  const sortedFlags = [...flags].sort((a, b) => SEV[a.severity] - SEV[b.severity]);

  return (
    <div className="space-y-5">
      <section className="bg-hero animate-fade-up relative overflow-hidden rounded-2xl p-6 text-primary-foreground shadow-lift sm:p-8">
        <div className="flex flex-col-reverse items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="text-sm opacity-80">Left to spend · {semester.name}</div>
            <div className="font-display mt-1 font-bold leading-none">
              <span className="text-6xl sm:text-7xl">{dollars}</span>
              <span className="text-3xl opacity-70">{cents}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className={cn("rounded-full bg-card px-3 py-1 font-semibold", PILL[health])}>{HEALTH_LABEL[health]}</span>
              <span className="opacity-80">{daysLeft} days left</span>
              <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => setEdit(true)}>
                <Pencil /> Edit budget
              </Button>
            </div>
          </div>
          <Ring pct={pct} />
        </div>
        <div className="mt-6">
          <div className="flex h-3 overflow-hidden rounded-full bg-primary-foreground/15">
            <div className="bg-accent" style={{ width: seg(spent) }} />
            <div className="bg-warning/80" style={{ width: seg(Math.min(promised, total - spent)) }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs opacity-90">
            <Legend cls="bg-accent" label={`Spent ${formatCents(spent)}`} />
            <Legend cls="bg-warning/80" label={`Promised ${formatCents(promised)}`} />
            <Legend cls="bg-primary-foreground/30" label={`Remaining ${formatCents(Math.max(0, total - spent - promised))}`} />
          </div>
        </div>
      </section>
      <p className="px-1 text-xs text-muted-foreground">
        Red if spent is over budget. Yellow at 80% spent, or if spent plus promised tasks would go over. Otherwise green.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <Stat n={openTasks.length} label="Open tasks" />
        <Stat n={overdue} label="Overdue" warn={overdue > 0} />
        <Stat n={waiting} label="Receipts to check" />
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        {semCats.map((c, i) => {
          const cs = semTxns.filter((t) => t.category_id === c.id).reduce((s, t) => s + t.amount_cents, 0);
          const cp = semTasks.filter((t) => t.category_id === c.id && t.status === "assigned").reduce((s, t) => s + t.limit_cents, 0);
          const h = budgetHealth(cs, cp, c.budget_cents);
          const diff = c.budget_cents - cs;
          return (
            <div key={c.id} className="surface animate-fade-up p-4" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><CategoryIcon name={c.name} /></span>
                <span className="font-semibold">{c.name}</span>
                <span className="ml-auto text-sm text-muted-foreground">{formatCents(cs)} / {formatCents(c.budget_cents)}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", BAR[h])} style={{ width: `${Math.min(100, percentUsed(cs, c.budget_cents))}%` }} />
              </div>
              <div className={cn("mt-2 text-sm", diff < 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>
                {diff < 0 ? `${formatCents(-diff)} over budget` : `${formatCents(diff)} left`}
              </div>
            </div>
          );
        })}
        {total - assigned > 0 && (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">Not assigned to a task type</div>
            {formatCents(total - assigned)}
          </div>
        )}
      </section>

      <section className="surface">
        <h2 className="border-b border-border px-4 py-3 text-lg font-bold">Needs attention</h2>
        {sortedFlags.length === 0 ? (
          <Empty title="Nothing to review" line="Your club's spending looks clean." />
        ) : (
          <ul className="divide-y divide-border">{sortedFlags.map((f) => <FlagRow key={f.id} flag={f} />)}</ul>
        )}
      </section>

      <EditBudget open={edit} onOpenChange={setEdit} semester={semester} cats={semCats} />
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 42, c = 2 * Math.PI * r;
  const shown = Math.min(100, pct);
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-primary-foreground/15" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" className="stroke-accent transition-[stroke-dashoffset] duration-700"
          strokeDasharray={c} strokeDashoffset={c - (c * shown) / 100} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold">{pct}%</span>
        <span className="text-[10px] uppercase tracking-wide opacity-70">used</span>
      </div>
    </div>
  );
}

const Legend = ({ cls, label }: { cls: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-full", cls)} />{label}</span>
);

const Stat = ({ n, label, warn }: { n: number; label: string; warn?: boolean }) => (
  <div className="surface p-4 text-center">
    <div className={cn("font-display text-3xl font-bold", warn && "text-destructive")}>{n}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

function FlagRow({ flag }: { flag: { id: string; severity: "high" | "medium" | "low"; detail: string; rule: string } }) {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("flags").update({ status: "reviewed", reviewed_by: me?.id, review_note: note || null }).eq("id", flag.id);
      if (error) throw error;
      if (me) await supabase.from("activity_log").insert({ club_id: me.club_id, actor_id: me.id, action: "flag_reviewed", detail: flag.rule });
    },
    onSuccess: () => { toast.success("Marked reviewed"); qc.invalidateQueries({ queryKey: ["budget"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const sev = { high: "bg-destructive/15 text-destructive", medium: "bg-warning/25", low: "bg-muted text-muted-foreground" }[flag.severity];
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className={cn("mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold capitalize", sev)}>{flag.severity}</span>
      <p className="flex-1 text-sm">{flag.detail}</p>
      <Popover>
        <PopoverTrigger asChild><Button size="sm" variant="outline">Mark reviewed</Button></PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-2">
          <Label htmlFor={`n-${flag.id}`}>Note (optional)</Label>
          <Textarea id={`n-${flag.id}`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" className="w-full" disabled={m.isPending} onClick={() => m.mutate()}>Done</Button>
        </PopoverContent>
      </Popover>
    </li>
  );
}

function EditBudget({ open, onOpenChange, semester, cats }: { open: boolean; onOpenChange: (o: boolean) => void; semester: Semester; cats: Category[] }) {
  const qc = useQueryClient();
  const [s, setS] = useState({ name: semester.name, start: semester.start_date, end: semester.end_date, total: (semester.total_budget_cents / 100).toFixed(2) });
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(cats.map((c) => [c.id, (c.budget_cents / 100).toFixed(2)])));
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);

  const total = parseDollarsToCents(s.total);
  const catCents = cats.map((c) => parseDollarsToCents(vals[c.id] ?? "0"));
  const sum = catCents.reduce<number>((a, v) => a + (v ?? 0), 0);
  const invalid = total === null || catCents.some((v) => v === null);

  async function save() {
    if (invalid || total === null) return toast.error("Amounts should look like 500 or 500.00");
    if (sum > total) return toast.error("Task type budgets add up to more than the semester total");
    setBusy(true);
    try {
      // Lower categories first so the running total never exceeds the semester budget.
      const { error } = await supabase.from("semesters").update({ name: s.name, start_date: s.start, end_date: s.end, total_budget_cents: total }).eq("id", semester.id);
      if (error) throw error;
      const order = cats.map((c, i) => ({ c, v: catCents[i]! })).sort((a, b) => (a.v - a.c.budget_cents) - (b.v - b.c.budget_cents));
      for (const { c, v } of order) {
        if (v === c.budget_cents) continue;
        const { error: e } = await supabase.from("categories").update({ budget_cents: v }).eq("id", c.id);
        if (e) throw e;
      }
      qc.invalidateQueries();
      onOpenChange(false);
      toast.success("Budget saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally { setBusy(false); }
  }

  async function addCat() {
    if (!newCat.trim()) return;
    const { error } = await supabase.from("categories").insert({ club_id: semester.club_id, semester_id: semester.id, name: newCat.trim(), budget_cents: 0 });
    if (error) return toast.error(error.message);
    setNewCat("");
    qc.invalidateQueries({ queryKey: ["categories"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit budget</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label htmlFor="s-name">Semester</Label><Input id="s-name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="s-start">Starts</Label><Input id="s-start" type="date" value={s.start} onChange={(e) => setS({ ...s, start: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="s-end">Ends</Label><Input id="s-end" type="date" value={s.end} onChange={(e) => setS({ ...s, end: e.target.value })} /></div>
          <div className="col-span-2 space-y-1.5"><Label htmlFor="s-total">Total budget ($)</Label><Input id="s-total" inputMode="decimal" value={s.total} onChange={(e) => setS({ ...s, total: e.target.value })} /></div>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-semibold">Task type budgets</div>
          {cats.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <CategoryIcon name={c.name} className="text-muted-foreground" />
              <span className="flex-1 text-sm">{c.name}</span>
              <Input aria-label={`${c.name} budget`} className="w-32" inputMode="decimal" value={vals[c.id] ?? ""} onChange={(e) => setVals({ ...vals, [c.id]: e.target.value })} />
            </div>
          ))}
          <div className="flex gap-2">
            <Input placeholder="Add a task type" value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={50} />
            <Button type="button" variant="outline" size="icon" aria-label="Add task type" onClick={addCat}><Plus /></Button>
          </div>
          <p className={cn("text-sm", total !== null && sum > total ? "text-destructive" : "text-muted-foreground")}>
            {total !== null && (sum > total ? `${formatCents(sum - total)} more than the semester total` : `${formatCents(total - sum)} not assigned yet`)}
          </p>
        </div>
        <Button onClick={save} disabled={busy}>Save</Button>
      </DialogContent>
    </Dialog>
  );
}
