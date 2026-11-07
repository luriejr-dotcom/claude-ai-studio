import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Copy, ImageOff, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import type { Category, Member, Task } from "@/lib/club";
import { formatCents } from "@/lib/money";
import { EMPTY_PAST, filterPast, finishedDay, spendTone, type PastFilters } from "@/lib/past-tasks";
import { aiChecks } from "./TransactionsScreen";
import { Avatar, CategoryIcon, Empty } from "./bits";
import { cn } from "@/lib/utils";

/** Transactions + flags tied to tasks (RLS: execs see the club, officers their own). */
export const pastExtrasQuery = {
  queryKey: ["past", "extras"],
  queryFn: async () => {
    const [t, f] = await Promise.all([
      supabase.from("transactions").select("*").not("task_id", "is", null),
      supabase.from("flags").select("*").not("task_id", "is", null),
    ]);
    if (t.error) throw t.error;
    return { txns: t.data, flags: f.data ?? [] };
  },
};

function useReceiptUrls(paths: string[]) {
  const key = [...new Set(paths)].sort();
  return useQuery({
    queryKey: ["past", "receipt-urls", key],
    enabled: key.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.storage.from("receipts").createSignedUrls(key, 3600);
      return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
    },
  }).data ?? {};
}

const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

export function StatusBadge({ status }: { status: Task["status"] }) {
  const done = status === "done";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", done ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground")}>
      {done ? "Done" : "Cancelled"}
    </span>
  );
}

export function PastTasksList({ tasks, members, cats, exec, filters = true, limit, onDuplicate }: {
  tasks: Task[]; members: Member[]; cats: Category[]; exec: boolean; filters?: boolean | undefined; limit?: number | undefined;
  onDuplicate?: ((t: Task) => void) | undefined;
}) {
  const { data: extras } = useQuery(pastExtrasQuery);
  const [f, setF] = useState<PastFilters>(EMPTY_PAST);
  const [open, setOpen] = useState<Task | null>(null);
  const mById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const cById = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
  const txnByTask = useMemo(() => new Map((extras?.txns ?? []).map((t) => [t.task_id!, t])), [extras]);
  const all = filterPast(tasks, f);
  const rows = limit ? all.slice(0, limit) : all;
  const urls = useReceiptUrls(rows.map((t) => txnByTask.get(t.id)?.receipt_path).filter((p): p is string => !!p));
  const set = (k: keyof PastFilters) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const dirty = JSON.stringify(f) !== JSON.stringify(EMPTY_PAST);

  const openTxn = open ? txnByTask.get(open.id) : undefined;
  const openUrl = useReceiptUrls(openTxn?.receipt_path ? [openTxn.receipt_path] : []);
  const openFlags = open ? (extras?.flags ?? []).filter((x) => x.task_id === open.id) : [];

  return (
    <div className="space-y-3">
      {filters && (
        <div className="surface space-y-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by title" value={f.q} onChange={set("q")} aria-label="Search by title" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {exec && (
              <select className={sel} value={f.member} onChange={set("member")} aria-label="Person">
                <option value="">Everyone</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
            <select className={sel} value={f.category} onChange={set("category")} aria-label="Category">
              <option value="">All types</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={sel} value={f.status} onChange={set("status")} aria-label="Status">
              <option value="">Done & cancelled</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Input type="date" className="h-9 w-auto" value={f.from} onChange={set("from")} aria-label="From date" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" className="h-9 w-auto" value={f.to} onChange={set("to")} aria-label="To date" />
            {dirty && <Button variant="ghost" size="sm" onClick={() => setF(EMPTY_PAST)}><X /> Clear</Button>}
          </div>
        </div>
      )}

      <div className={cn(filters && "surface overflow-hidden")}>
        {rows.length === 0 ? (
          <Empty title={dirty ? "No matches" : "No past tasks yet"} line={dirty ? "Try loosening the filters." : "Finished and cancelled tasks will collect here."} />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((t) => {
              const txn = txnByTask.get(t.id);
              const who = t.assignee_id ? mById.get(t.assignee_id) : undefined;
              const cat = t.category_id ? cById.get(t.category_id) : undefined;
              const url = txn?.receipt_path ? urls[txn.receipt_path] : undefined;
              const spent = txn?.amount_cents ?? 0;
              return (
                <li key={t.id}>
                  <button onClick={() => setOpen(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50">
                    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                      {url ? <img src={url} alt="" className="size-full object-cover" loading="lazy" /> : <ImageOff className="size-4 text-muted-foreground" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className="truncate font-medium">{t.title}</span><StatusBadge status={t.status} /></span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{fmtDay(finishedDay(t))}</span>
                        {who && <span className="inline-flex items-center gap-1"><Avatar id={who.id} name={who.name} size={16} />{who.name}</span>}
                        {cat && <span className="inline-flex items-center gap-1"><CategoryIcon name={cat.name} className="size-3" />{cat.name}</span>}
                      </span>
                    </span>
                    {t.status === "done" && (
                      <span className="shrink-0 text-right text-xs">
                        <span className={cn("block font-display text-sm font-semibold tabular-nums", spendTone(spent, t.limit_cents) === "over" ? "text-destructive" : "text-primary")}>
                          {formatCents(spent)}
                        </span>
                        <span className="text-muted-foreground">of {formatCents(t.limit_cents)}</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="overflow-y-auto">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-2xl">{open.title}</SheetTitle>
                <div><StatusBadge status={open.status} /></div>
              </SheetHeader>
              <dl className="mt-4 space-y-3 px-4 text-sm">
                <KV k={open.status === "done" ? "Finished" : "Cancelled"} v={fmtDay(finishedDay(open))} />
                <KV k="Done by" v={(open.assignee_id && mById.get(open.assignee_id)?.name) || "Nobody"} />
                <KV k="Task type" v={(open.category_id && cById.get(open.category_id)?.name) || "—"} />
                <KV k="Spending limit" v={formatCents(open.limit_cents)} />
                {openTxn && (
                  <KV k="Spent" v={<span className={spendTone(openTxn.amount_cents, open.limit_cents) === "over" ? "text-destructive" : "text-primary"}>{formatCents(openTxn.amount_cents)}</span>} />
                )}
                {openTxn && <KV k="Store" v={openTxn.merchant || "—"} />}
                {open.notes && <KV k="Notes" v={<span className="whitespace-pre-wrap">{open.notes}</span>} />}
              </dl>
              {openTxn?.receipt_path && openUrl[openTxn.receipt_path] && (
                <a href={openUrl[openTxn.receipt_path]} target="_blank" rel="noreferrer" className="mx-4 mt-5 block overflow-hidden rounded-xl border border-border">
                  <img src={openUrl[openTxn.receipt_path]} alt={`Receipt for ${open.title}`} className="max-h-96 w-full object-contain bg-muted" />
                </a>
              )}
              {openTxn?.source === "receipt" && (
                <div className="mt-5 space-y-2 px-4 text-sm">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">AI check</div>
                  {aiChecks(openTxn).map((c) => <KV key={c.k} k={c.k} v={c.v} />)}
                  {openTxn.ai_note && <p className="rounded-xl bg-accent/20 p-3 text-xs">{openTxn.ai_note}</p>}
                </div>
              )}
              {openFlags.length > 0 && (
                <div className="mt-5 space-y-2 px-4 text-sm">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Flags</div>
                  {openFlags.map((fl) => (
                    <div key={fl.id} className={cn("rounded-xl border p-3 text-xs", fl.severity === "high" ? "border-destructive/40 bg-destructive/10" : "border-border bg-muted/50")}>
                      <div className="font-semibold">{fl.detail}</div>
                      <div className="mt-0.5 text-muted-foreground">{fl.severity} · {fl.status === "reviewed" ? "reviewed" : "open"}</div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-5 px-4 text-xs text-muted-foreground">Past tasks are read-only.</p>
              {exec && onDuplicate && (
                <div className="px-4 pb-6 pt-3">
                  <Button variant="outline" onClick={() => { onDuplicate(open); setOpen(null); }}><Copy /> Duplicate as new task</Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;
}
