import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, HandCoins, Receipt, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, membersQuery } from "@/lib/club";
import { formatCents } from "@/lib/money";
import { EMPTY_REIMB, filterReimb, isRepaymentMethod, METHOD_LABEL, reimbSummary, STATUS_LABEL, type PayMethod, type Reimb, type ReimbFilters, type ReimbStatus } from "@/lib/reimb";
import { ReceiptStep } from "./ReceiptStep";
import { Avatar, Empty } from "./bits";
import { cn } from "@/lib/utils";
import { LoadingRows } from './LoadingRows';

export const reimbQuery = {
  queryKey: ["reimbursements"],
  queryFn: async () => {
    const { data, error } = await supabase.from("reimbursements").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const sel = "h-9 min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-sm";
const TONE: Record<ReimbStatus, string> = {
  submitted: "bg-warning/25 text-foreground",
  approved: "bg-secondary text-secondary-foreground",
  denied: "bg-destructive/15 text-destructive",
  paid: "bg-success/20 text-success",
};

export function ReimbBadge({ status }: { status: ReimbStatus }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TONE[status])}>{STATUS_LABEL[status]}</span>;
}

export function RequestReimbursementSheet({ open, onOpenChange, clubId }: { open: boolean; onOpenChange: (o: boolean) => void; clubId: string }) {
  const { data: cats = [] } = useQuery(categoriesQuery);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Request reimbursement</SheetTitle>
          <p className="text-sm text-muted-foreground">For a club purchase you paid for yourself that wasn't part of a task.</p>
        </SheetHeader>
        {open && <ReceiptStep clubId={clubId} cats={cats} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

export function ReimbCard({ onOpen }: { onOpen?: (() => void) | undefined }) {
  const { data = [] } = useQuery(reimbQuery);
  const s = reimbSummary(data);
  return (
    <section className="surface p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold"><HandCoins className="size-5 text-primary" /> Reimbursements</h2>
        {onOpen && <Button variant="ghost" size="sm" onClick={onOpen}>Open list</Button>}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 min-[400px]:grid-cols-3 text-sm">
        <Stat k="Owed to members" v={formatCents(s.owedCents)} />
        <Stat k="Waiting for approval" v={String(s.waitingCount)} />
        <Stat k="Oldest waiting" v={s.oldestWaiting ? fmt(s.oldestWaiting) : "—"} />
      </div>
    </section>
  );
}
function Stat({ k, v }: { k: string; v: string }) {
  return <div><div className="font-display text-xl font-bold tabular-nums">{v}</div><div className="text-xs text-muted-foreground">{k}</div></div>;
}

export function ReimbursementsScreen({ exec, clubId }: { exec: boolean; clubId: string }) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery(reimbQuery);
  const { data: members = [] } = useQuery(membersQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [f, setF] = useState<ReimbFilters>(EMPTY_REIMB);
  const [open, setOpen] = useState<Reimb | null>(null);
  const [deny, setDeny] = useState<Reimb | null>(null);
  const [pay, setPay] = useState<Reimb | null>(null);
  const [asking, setAsking] = useState(false);
  const mName = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);
  const cName = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c.name])), [cats]);
  const rows = filterReimb(data, f);
  const set = (k: keyof ReimbFilters) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const dirty = JSON.stringify(f) !== JSON.stringify(EMPTY_REIMB);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["reimbursements"] });
    qc.invalidateQueries({ queryKey: ["budget"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["past"] });
  };
  const decide = useMutation({
    mutationFn: async ({ r, approve, note }: { r: Reimb; approve: boolean; note?: string }) => {
      const { error } = await supabase.rpc("decide_reimbursement", { _id: r.id, _approve: approve, _note: note ?? "" });
      if (error) throw error;
      return approve;
    },
    onSuccess: (approve) => { toast.success(approve ? "Approved" : "Denied"); setDeny(null); setOpen(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const markPaid = useMutation({
    mutationFn: async ({ r, method, ref }: { r: Reimb; method: PayMethod; ref: string }) => {
      const { error } = await supabase.rpc("mark_reimbursement_paid", { _id: r.id, _method: method, _reference: ref });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marked as paid"); setPay(null); setOpen(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <h2 className="text-xl font-bold">{exec ? "Reimbursements" : "My reimbursements"}</h2>
        <Button className="justify-self-start sm:justify-self-end" size="sm" onClick={() => setAsking(true)}><Receipt /> Request reimbursement</Button>
      </div>
      {exec && (
        <div className="surface grid min-w-0 grid-cols-2 items-center gap-2 p-4 sm:flex sm:flex-wrap">
          <select className={sel} value={f.status} onChange={set("status")} aria-label="Status">
            <option value="">Any status</option>
            {(Object.keys(STATUS_LABEL) as ReimbStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select className={sel} value={f.member} onChange={set("member")} aria-label="Person">
            <option value="">Everyone</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <Input type="date" className="h-9 min-w-0 w-full sm:w-auto" value={f.from} onChange={set("from")} aria-label="From date" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" className="h-9 min-w-0 w-full sm:w-auto" value={f.to} onChange={set("to")} aria-label="To date" />
          {dirty && <Button variant="ghost" size="sm" onClick={() => setF(EMPTY_REIMB)}><X /> Clear</Button>}
        </div>
      )}

      <div className="surface overflow-hidden">
        {isLoading ? <LoadingRows /> : rows.length === 0 ? (
          <Empty title={dirty ? "No matches" : "No reimbursement requests"} line={dirty ? "Try loosening the filters." : "Paid for something yourself? Request it back here."} />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="grid min-w-0 gap-3 px-4 py-3 hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_auto]">
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setOpen(r)}>
                  <Avatar id={r.member_id} name={mName[r.member_id] ?? "?"} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2"><span className="truncate font-medium">{r.merchant || "Purchase"}</span><ReimbBadge status={r.status} /></span>
                    <span className="block truncate text-xs text-muted-foreground">{exec && `${mName[r.member_id] ?? "—"} · `}{fmt(r.created_at)} · {r.reason}</span>
                    {r.preferred_method && isRepaymentMethod(r.preferred_method) && <span className="block text-xs text-muted-foreground">Requested via {METHOD_LABEL[r.preferred_method]}</span>}
                  </span>
                  <span className="font-display font-semibold tabular-nums">{formatCents(r.amount_cents)}</span>
                </button>
                {exec && r.status === "submitted" && (
                  <div className="flex gap-1">
                    <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ r, approve: true })}><Check /> Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => setDeny(r)}>Deny</Button>
                  </div>
                )}
                {exec && r.status === "approved" && <Button size="sm" variant="outline" onClick={() => setPay(r)}><HandCoins /> Mark as paid</Button>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <DetailSheet r={open} onClose={() => setOpen(null)} exec={exec} mName={mName} cName={cName}
        onApprove={(r, note) => decide.mutate({ r, approve: true, note })} onDeny={setDeny} onPay={setPay} />
      <DenyDialog r={deny} onClose={() => setDeny(null)} busy={decide.isPending} onDeny={(r, note) => decide.mutate({ r, approve: false, note })} />
      <PayDialog r={pay} onClose={() => setPay(null)} busy={markPaid.isPending} onPay={(r, method, ref) => markPaid.mutate({ r, method, ref })} />
      <RequestReimbursementSheet open={asking} onOpenChange={setAsking} clubId={clubId} />
    </div>
  );
}

function DetailSheet({ r, onClose, exec, mName, cName, onApprove, onDeny, onPay }: {
  r: Reimb | null; onClose: () => void; exec: boolean; mName: Record<string, string>; cName: Record<string, string>;
  onApprove: (r: Reimb, note: string) => void; onDeny: (r: Reimb) => void; onPay: (r: Reimb) => void;
}) {
  const [note, setNote] = useState("");
  const { data: url } = useQuery({
    queryKey: ["reimbursements", "receipt", r?.receipt_path],
    enabled: !!r,
    queryFn: async () => {
      if (!r) return null;
      if (r.receipt_path === 'demo/receipt.svg') return '/demo/receipt.svg';
      return (await supabase.storage.from("receipts").createSignedUrl(r.receipt_path, 3600)).data?.signedUrl ?? null;
    },
  });
  const { data: flags = [] } = useQuery({
    queryKey: ["reimbursements", "flags", r?.id],
    enabled: !!r,
    queryFn: async () => r ? (await supabase.from("flags").select("*").eq("reimbursement_id", r.id)).data ?? [] : [],
  });
  return (
    <Sheet open={!!r} onOpenChange={(o) => { if (!o) { onClose(); setNote(""); } }}>
      <SheetContent className="overflow-y-auto">
        {r && (
          <>
            <SheetHeader>
              <SheetTitle className="font-display text-2xl">{r.merchant || "Purchase"}</SheetTitle>
              <div><ReimbBadge status={r.status} /></div>
            </SheetHeader>
            <div className="mt-2 px-4 font-display text-4xl font-bold">{formatCents(r.amount_cents)}</div>
            <dl className="mt-5 space-y-3 px-4 text-sm">
              <KV k="Person" v={mName[r.member_id] ?? "—"} />
              <KV k="Reason" v={r.reason} />
              <KV k="Preferred repayment" v={r.preferred_method && isRepaymentMethod(r.preferred_method) ? METHOD_LABEL[r.preferred_method] : "Not specified"} />
              <KV k="Category" v={cName[r.category_id ?? ""] ?? "—"} />
              <KV k="Purchase date" v={r.purchase_date} />
              <KV k="Requested" v={fmt(r.created_at)} />
              {r.ai_total_cents != null && <KV k="Receipt total (AI read)" v={formatCents(r.ai_total_cents)} />}
              {r.decided_at && <KV k={r.status === "denied" ? "Denied" : "Approved"} v={`${fmt(r.decided_at)} · ${mName[r.decided_by ?? ""] ?? "—"}`} />}
              {r.decision_note && <KV k="Note" v={r.decision_note} />}
              {r.paid_at && <KV k="Paid" v={`${fmt(r.paid_at)} · ${mName[r.paid_by ?? ""] ?? "—"}`} />}
              {r.paid_method && <KV k="Paid by" v={METHOD_LABEL[r.paid_method]} />}
              {r.paid_reference && <KV k="Reference" v={r.paid_reference} />}
            </dl>
            {url && <a href={url} target="_blank" rel="noreferrer" className="mx-4 mt-5 block overflow-hidden rounded-xl border border-border"><img src={url} alt="Receipt" className="max-h-96 w-full bg-muted object-contain" /></a>}
            {flags.length > 0 && (
              <div className="mt-5 space-y-2 px-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Flags</div>
                {flags.map((fl) => <div key={fl.id} className={cn("rounded-xl border p-3 text-xs", fl.severity === "high" ? "border-destructive/40 bg-destructive/10" : "border-border bg-muted/50")}>{fl.detail}</div>)}
              </div>
            )}
            {exec && r.status === "submitted" && (
              <div className="space-y-2 px-4 pb-6 pt-5">
                <Label htmlFor="rb-note">Note (optional for approval)</Label>
                <Textarea id="rb-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={() => onApprove(r, note)}><Check /> Approve</Button>
                  <Button variant="outline" onClick={() => onDeny(r)}>Deny</Button>
                </div>
              </div>
            )}
            {exec && r.status === "approved" && <div className="px-4 pb-6 pt-5"><Button onClick={() => onPay(r)}><HandCoins /> Mark as paid</Button></div>}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DenyDialog({ r, onClose, onDeny, busy }: { r: Reimb | null; onClose: () => void; onDeny: (r: Reimb, note: string) => void; busy: boolean }) {
  const [note, setNote] = useState("");
  return (
    <Dialog open={!!r} onOpenChange={(o) => { if (!o) { onClose(); setNote(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deny this request?</DialogTitle>
          <DialogDescription>{r && `${r.merchant} · ${formatCents(r.amount_cents)}`}. The person will see your reason.</DialogDescription>
        </DialogHeader>
        <Label htmlFor="deny-why">Reason</Label>
        <Textarea id="deny-why" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Not a club expense" />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Keep it</Button>
          <Button variant="destructive" disabled={!note.trim() || busy} onClick={() => r && onDeny(r, note.trim())}>Deny request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({ r, onClose, onPay, busy }: { r: Reimb | null; onClose: () => void; onPay: (r: Reimb, m: PayMethod, ref: string) => void; busy: boolean }) {
  const [method, setMethod] = useState<PayMethod | "">("");
  const [ref, setRef] = useState("");
  return (
    <Dialog open={!!r} onOpenChange={(o) => { if (!o) { onClose(); setMethod(""); setRef(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as paid</DialogTitle>
          <DialogDescription>Pay {r && formatCents(r.amount_cents)} outside the app first. This only records that it happened.</DialogDescription>
          {r?.preferred_method && isRepaymentMethod(r.preferred_method) && <p className="text-sm">Requested repayment: {METHOD_LABEL[r.preferred_method]}</p>}
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(METHOD_LABEL) as PayMethod[]).map((m) => (
            <Button className="h-auto min-h-9 whitespace-normal" key={m} type="button" variant={method === m ? "default" : "outline"} onClick={() => setMethod(m)}>{METHOD_LABEL[m]}</Button>
          ))}
        </div>
        <Label htmlFor="pay-ref">Reference note (optional)</Label>
        <Input id="pay-ref" maxLength={200} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Venmo note or check #" />
        <p className="text-xs text-muted-foreground">Don't enter bank or card numbers.</p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!method || busy} onClick={() => r && method && onPay(r, method, ref.trim())}>Mark as paid</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words text-right font-medium">{v}</dd></div>;
}
