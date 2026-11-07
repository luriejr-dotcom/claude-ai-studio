import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Camera, Check, Loader2, PartyPopper, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { Category, Task } from "@/lib/club";
import { Textarea } from "@/components/ui/textarea";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { readReceipt } from "@/lib/receipt.functions";
import { cn } from "@/lib/utils";
import { isRepaymentMethod, METHOD_LABEL, type PayMethod } from "@/lib/reimb";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX = 5 * 1024 * 1024;

async function shrink(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file;
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  if (scale === 1 && file.size < 1_500_000) return file;
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const context = c.getContext("2d");
  if (!context) return file;
  context.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
}

type Field = { ai: string; value: string; confirmed: boolean; editing: boolean };
const fresh = (ai: string): Field => ({ ai, value: ai, confirmed: false, editing: ai === "" });
type FlagOut = { rule: string; severity: string; detail: string };

/**
 * Receipt photo → AI read → "is everything correct?" confirm.
 * With a task: finishes the task (and asks how it was paid). Without: standalone reimbursement request.
 */
export function ReceiptStep({ task, clubId, cats = [], onDone }: { task?: Task | undefined; clubId?: string; cats?: Category[]; onDone: () => void }) {
  const standalone = !task;
  const [paidOwn, setPaidOwn] = useState<boolean | null>(standalone ? true : null);
  const [category, setCategory] = useState("");
  const [why, setWhy] = useState("");
  const [preferredMethod, setPreferredMethod] = useState<PayMethod | "">("");
  const qc = useQueryClient();
  const read = useServerFn(readReceipt);
  const [path, setPath] = useState<string | null>(null);
  const [hash, setHash] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "upload" | "read">("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [f, setF] = useState<{ merchant: Field; date: Field; total: Field } | null>(null);
  const [done, setDone] = useState<FlagOut[] | null>(null);

  async function pick(file?: File): Promise<void> {
    if (!file) return;
    if (!TYPES.includes(file.type)) { toast.error("Use a JPEG, PNG, WebP or GIF photo"); return; }
    if (file.size > MAX) { toast.error("That photo is over 5 MB"); return; }
    setBusy("upload");
    try {
      const blob = await shrink(file);
      const ext = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() ?? "img");
      const p = task ? `${task.club_id}/${task.id}/${crypto.randomUUID()}.${ext}` : `${clubId}/reimbursements/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("receipts").upload(p, blob, { contentType: blob.type });
      if (error) throw error;
      if (path) await supabase.storage.from("receipts").remove([path]);
      setPath(p);
      setPreview(URL.createObjectURL(blob));
      setBusy("read");
      setReason(""); setNote("");
      let ai = { merchant: "", date: "", total: "" };
      try {
        const r = await read({ data: { path: p } });
        setHash(r.hash);
        if (r.ok) {
          ai = { merchant: r.reading.merchant, date: r.reading.date, total: r.reading.totalCents ? formatCents(r.reading.totalCents) : "" };
          setNote(r.reading.note);
        } else setReason(r.reason);
      } catch {
        setReason("The receipt reader is unavailable right now.");
      }
      setF({ merchant: fresh(ai.merchant), date: fresh(ai.date), total: fresh(ai.total) });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const set = (k: "merchant" | "date" | "total", patch: Partial<Field>) => setF((p) => (p ? { ...p, [k]: { ...p[k], ...patch } } : p));
  const ok = (x: Field, valid: boolean) => valid && (x.confirmed || x.editing);
  const cents = f ? parseDollarsToCents(f.total.value) : null;
  const left = f ? [ok(f.merchant, !!f.merchant.value.trim()), ok(f.date, !!f.date.value), ok(f.total, !!cents && cents > 0), paidOwn !== null,
    ...(paidOwn ? [isRepaymentMethod(preferredMethod)] : []),
    ...(standalone ? [!!category, !!why.trim()] : [])].filter((v) => !v).length : 3;

  const finish = useMutation({
    mutationFn: async () => {
      if (!f || cents === null || cents <= 0 || !path || paidOwn === null) throw new Error("Confirm the receipt details first");
      if (paidOwn && !isRepaymentMethod(preferredMethod)) throw new Error("Choose how you want to be reimbursed");
      const aiTotal = f.total.ai ? parseDollarsToCents(f.total.ai) : null;
      const ai = { _ai_merchant: f.merchant.ai, ...(f.date.ai ? { _ai_date: f.date.ai } : {}), ...(aiTotal !== null ? { _ai_total_cents: aiTotal } : {}), _ai_note: note, _receipt_hash: hash };
      if (!task) {
        const { error } = await supabase.rpc("submit_reimbursement_v2", {
          _merchant: f.merchant.value, _purchase_date: f.date.value, _amount_cents: cents, _receipt_path: path, _category_id: category, _reason: why.trim(), _preferred_method: preferredMethod, ...ai,
        });
        if (error) throw error;
        return [] as FlagOut[];
      }
      const { data, error } = await supabase.rpc("complete_task_with_receipt_v3", {
        _paid_own: paidOwn, _task_id: task.id, _merchant: f.merchant.value, _purchase_date: f.date.value, _amount_cents: cents, _receipt_path: path,
        ...(paidOwn ? { _preferred_method: preferredMethod } : {}), ...ai,
      });
      if (error) throw error;
      return ((data as { flags?: FlagOut[] } | null)?.flags ?? []);
    },
    onSuccess: (flags) => { setDone(flags); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (done) {
    return (
      <div className="animate-fade-up mt-6 space-y-4 px-4">
        <div className="flex items-center gap-2 font-display text-2xl font-bold"><PartyPopper className="size-6 text-primary" /> Done</div>
        <p className="text-sm text-muted-foreground">
          {standalone ? "Your reimbursement request was sent to the President and Treasurer." : paidOwn ? "The purchase was added and your reimbursement request was sent." : "The receipt is saved and the purchase was added."}
        </p>
        {done.length > 0 && (
          <div className="rounded-2xl border border-border bg-secondary/50 p-4">
            <div className="font-semibold">Heads up for the treasurer</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {done.map((x, i) => <li key={i} className="flex gap-2"><span className={cn("mt-1.5 size-2 shrink-0 rounded-full", x.severity === "high" ? "bg-destructive" : x.severity === "medium" ? "bg-accent" : "bg-muted-foreground")} />{x.detail}</li>)}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Flags are for review, not accusations.</p>
          </div>
        )}
        <Button className="w-full" onClick={onDone}>Close</Button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4 px-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 1 · Receipt</div>
      <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-input text-center hover:border-primary", preview ? "p-3" : "p-8")}>
        {preview ? <img src={preview} alt="Receipt" className="max-h-56 rounded-lg object-contain" /> : <Camera className="size-8 text-muted-foreground" />}
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy === "upload" ? "Uploading…" : busy === "read" ? "Reading the receipt…" : preview ? "Use a different photo" : "Snap or upload the receipt"}
        </span>
        <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={!!busy || finish.isPending} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>

      {f && !busy && (
        <>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 2 · Is everything correct?</div>
          {reason && <p className="text-sm text-muted-foreground">{reason} Please type the details in.</p>}
          {note && <div className="flex gap-2 rounded-xl bg-accent/20 p-3 text-sm"><Sparkles className="mt-0.5 size-4 shrink-0" />{note}</div>}
          <ConfirmField label="Store" f={f.merchant} onChange={(p) => set("merchant", p)} />
          <ConfirmField label="Date" type="date" f={f.date} onChange={(p) => set("date", p)} />
          <ConfirmField label="Total paid" f={f.total} onChange={(p) => set("total", p)} />
          {standalone ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="rb-cat">Category</Label>
                <select id="rb-cat" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Pick one</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rb-why">Reason</Label>
                <Textarea id="rb-why" rows={2} maxLength={300} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Bought extra ice for the formal" />
              </div>
            </>
          ) : (
            <fieldset className="rounded-xl border border-border p-3">
              <legend className="px-1 text-xs uppercase tracking-wide text-muted-foreground">How was this paid?</legend>
              <div className="grid gap-2">
                {([[false, "Club card / club funds"], [true, "My own money (request reimbursement)"]] as const).map(([v, l]) => (
                  <Button key={l} type="button" variant={paidOwn === v ? "default" : "outline"} className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => setPaidOwn(v)}>{l}</Button>
                ))}
              </div>
            </fieldset>
          )}
          {paidOwn && (
            <div className="space-y-1.5">
              <Label htmlFor="rb-method">How would you like to be reimbursed?</Label>
              <select id="rb-method" className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={preferredMethod} onChange={(e) => { const value = e.target.value; setPreferredMethod(isRepaymentMethod(value) ? value : ""); }}>
                <option value="">Pick a method</option>
                {Object.entries(METHOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Club Ledger only tracks reimbursements. Never enter bank or card details.</p>
          <Button className="w-full" size="lg" disabled={left > 0 || finish.isPending} onClick={() => finish.mutate()}>
            {left > 0 ? `${left} more to go` : finish.isPending ? "Saving…" : standalone ? "Send request" : "Mark done"}
          </Button>
        </>
      )}
    </div>
  );
}

function ConfirmField({ label, f, onChange, type = "text" }: { label: string; f: Field; onChange: (p: Partial<Field>) => void; type?: string }) {
  const id = `cf-${label}`;
  return (
    <div className={cn("rounded-xl border p-3 transition-colors", f.confirmed ? "border-primary bg-primary/5" : "border-border")}>
      <Label htmlFor={id} className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {f.editing ? (
        <Input id={id} type={type} inputMode={label === "Total paid" ? "decimal" : undefined} placeholder={label === "Total paid" ? "$0.00" : undefined}
          className="mt-1" value={f.value} autoFocus={f.ai !== ""} onChange={(e) => onChange({ value: e.target.value })} />
      ) : (
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="font-medium">{f.value}</span>
          <div className="flex gap-1">
            <Button size="sm" variant={f.confirmed ? "default" : "outline"} onClick={() => onChange({ confirmed: !f.confirmed })}><Check /> Correct</Button>
            <Button size="sm" variant="ghost" onClick={() => onChange({ editing: true, confirmed: false })}><Pencil /> Fix it</Button>
          </div>
        </div>
      )}
    </div>
  );
}
