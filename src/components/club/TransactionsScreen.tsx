import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, membersQuery, tasksQuery, type Txn } from "@/lib/club";
import { formatCents } from "@/lib/money";
import { EMPTY_FILTERS, filterTxns, txnsToCsv, type TxnFilters } from "@/lib/txns";
import { Avatar, CategoryIcon, Empty } from "./bits";
import { reimbQuery } from "./Reimbursements";
import { STATUS_LABEL } from "@/lib/reimb";
import { LoadingRows } from './LoadingRows';

const txnsQuery = {
  queryKey: ["transactions"],
  queryFn: async () => {
    const { data, error } = await supabase.from("transactions").select("*");
    if (error) throw error;
    return data;
  },
};

const sel = "h-9 min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-sm";

export function TransactionsScreen() {
  const { data: txns = [], isLoading } = useQuery(txnsQuery);
  const { data: members = [] } = useQuery(membersQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: tasks = [] } = useQuery(tasksQuery);
  const { data: reimbs = [] } = useQuery(reimbQuery);
  const reimbByTxn = useMemo(() => Object.fromEntries(reimbs.filter((r) => r.transaction_id).map((r) => [r.transaction_id!, STATUS_LABEL[r.status]])), [reimbs]);
  const [f, setF] = useState<TxnFilters>(EMPTY_FILTERS);
  const [open, setOpen] = useState<Txn | null>(null);

  const mName = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);
  const cName = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c.name])), [cats]);
  const sources = useMemo(() => [...new Set(txns.map((t) => t.source))].sort(), [txns]);
  const rows = useMemo(() => filterTxns(txns, f, mName), [txns, f, mName]);
  const total = rows.reduce((s, t) => s + t.amount_cents, 0);
  const set = (k: keyof TxnFilters) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const dirty = JSON.stringify(f) !== JSON.stringify(EMPTY_FILTERS);

  function exportCsv() {
    const blob = new Blob([txnsToCsv(rows, mName, cName, reimbByTxn)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (isLoading) return <LoadingRows />;
  return (
    <div className="space-y-4">
      <div className="space-y-4 border-y border-border py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search store or person" value={f.q} onChange={set("q")} aria-label="Search" />
        </div>
        <div className="grid min-w-0 grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
          <select className={sel} value={f.member} onChange={set("member")} aria-label="Person">
            <option value="">Everyone</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className={sel} value={f.category} onChange={set("category")} aria-label="Type">
            <option value="">All types</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className={sel} value={f.source} onChange={set("source")} aria-label="Source">
            <option value="">Any source</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Input type="date" className="h-9 min-w-0 w-full sm:w-auto" value={f.from} onChange={set("from")} aria-label="From date" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" className="h-9 min-w-0 w-full sm:w-auto" value={f.to} onChange={set("to")} aria-label="To date" />
          {dirty && <Button variant="ghost" size="sm" onClick={() => setF(EMPTY_FILTERS)}><X /> Clear</Button>}
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="text-sm text-muted-foreground">{rows.length} shown · <span className="font-semibold text-foreground">{formatCents(total)}</span></div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download /> Export CSV</Button>
      </div>

      <div className="divide-y divide-border overflow-hidden border-y border-border">
        {rows.length === 0 ? (
          <Empty title={txns.length ? "No matches" : "No purchases yet"} line={txns.length ? "Try loosening the filters." : "Purchases will show up here as they're added."} />
        ) : rows.map((t) => (
          <button key={t.id} onClick={() => setOpen(t)} className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/50">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary"><CategoryIcon name={cName[t.category_id ?? ""] ?? null} /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{t.merchant || "Unknown store"}</div>
              <div className="break-words text-xs text-muted-foreground">{t.purchase_date} · {mName[t.member_id ?? ""] ?? "—"} · {t.source}</div>
            </div>
            <div className="shrink-0 text-right font-display text-sm font-semibold tabular-nums">{formatCents(t.amount_cents)}</div>
          </button>
        ))}
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="overflow-y-auto">
          {open && (
            <>
              <SheetHeader><SheetTitle className="font-display text-2xl">{open.merchant || "Unknown store"}</SheetTitle></SheetHeader>
              <div className="mt-2 px-4 font-display text-4xl font-bold">{formatCents(open.amount_cents)}</div>
              <dl className="mt-6 space-y-3 px-4 text-sm">
                <Row k="Date" v={open.purchase_date} />
                <Row k="Type" v={cName[open.category_id ?? ""] ?? "Uncategorized"} />
                <Row k="Person" v={open.member_id ? <span className="inline-flex items-center gap-2"><Avatar id={open.member_id} name={mName[open.member_id] ?? "?"} size={22} />{mName[open.member_id] ?? "—"}</span> : "—"} />
                <Row k="Task" v={tasks.find((x) => x.id === open.task_id)?.title ?? "—"} />
                <Row k="Source" v={open.source} />
                {reimbByTxn[open.id] && <Row k="Reimbursement" v={reimbByTxn[open.id]} />}
                <Row k="Added" v={new Date(open.created_at).toLocaleString()} />
                {open.ai_corrected && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="size-3.5" /> Details read from the receipt were corrected by hand.</p>}
              </dl>
              {open.source === "receipt" && (
                <div className="mt-6 space-y-2 px-4 text-sm">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">AI check</Label>
                  {aiChecks(open).map((c) => <Row key={c.k} k={c.k} v={c.v} />)}
                  {open.confirmed_by && <p className="text-xs text-muted-foreground">Confirmed by {mName[open.confirmed_by] ?? "—"}{open.confirmed_at && ` · ${new Date(open.confirmed_at).toLocaleString()}`}</p>}
                  {open.ai_note && <p className="rounded-lg bg-muted p-3 text-xs">{open.ai_note}</p>}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function verdict(ai: string | null, confirmed: string, same: boolean) {
  if (ai == null || ai === "") return "Typed by the member";
  return same ? "AI read it correctly" : `Fixed by the member (AI read ${ai} → confirmed ${confirmed})`;
}
export function aiChecks(t: Txn) {
  return [
    { k: "Store", v: verdict(t.ai_merchant, t.merchant, (t.ai_merchant ?? "").toLowerCase() === t.merchant.toLowerCase()) },
    { k: "Date", v: verdict(t.ai_date, t.purchase_date, t.ai_date === t.purchase_date) },
    { k: "Total", v: verdict(t.ai_total_cents == null ? null : formatCents(t.ai_total_cents), formatCents(t.amount_cents), t.ai_total_cents === t.amount_cents) },
  ];
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words text-right font-medium">{v}</dd></div>;
}
