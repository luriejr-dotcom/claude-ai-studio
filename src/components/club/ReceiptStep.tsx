import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/lib/club";
import { parseDollarsToCents } from "@/lib/money";

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
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
}

export function ReceiptStep({ task, onDone }: { task: Task; onDone: () => void }) {
  const qc = useQueryClient();
  const [path, setPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState("");
  const [total, setTotal] = useState("");

  async function pick(file?: File) {
    if (!file) return;
    if (!TYPES.includes(file.type)) { toast.error("Use a JPEG, PNG, WebP or GIF photo"); return; }
    if (file.size > MAX) { toast.error("That photo is over 5 MB"); return; }
    setUploading(true);
    try {
      const blob = await shrink(file);
      const ext = blob.type === "image/jpeg" ? "jpg" : file.name.split(".").pop() ?? "img";
      const p = `${task.club_id}/${task.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("receipts").upload(p, blob, { contentType: blob.type });
      if (error) throw error;
      if (path) await supabase.storage.from("receipts").remove([path]);
      setPath(p);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const cents = parseDollarsToCents(total);
  const missing = [!path, !merchant.trim(), !date, !cents].filter(Boolean).length;

  const finish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("complete_task_with_receipt", {
        _task_id: task.id, _merchant: merchant, _purchase_date: date, _amount_cents: cents!, _receipt_path: path!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Done — receipt saved");
      qc.invalidateQueries();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-6 space-y-4 px-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 1 · Receipt</div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-input p-6 text-center hover:border-primary">
        {preview ? <img src={preview} alt="Receipt" className="max-h-56 rounded-lg object-contain" /> : <Camera className="size-8 text-muted-foreground" />}
        <span className="text-sm font-medium">{uploading ? "Uploading…" : preview ? "Use a different photo" : "Snap or upload the receipt"}</span>
        <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={uploading} onChange={(e) => pick(e.target.files?.[0])} />
      </label>

      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 2 · Details</div>
      <div className="space-y-1.5"><Label htmlFor="rm">Store</Label><Input id="rm" value={merchant} onChange={(e) => setMerchant(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="rd">Date</Label><Input id="rd" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="rt">Total paid</Label><Input id="rt" inputMode="decimal" placeholder="$0.00" value={total} onChange={(e) => setTotal(e.target.value)} /></div>

      <Button className="w-full" size="lg" disabled={missing > 0 || finish.isPending} onClick={() => finish.mutate()}>
        {missing > 0 ? `Check ${missing} more to finish` : "Mark done"}
      </Button>
    </div>
  );
}
