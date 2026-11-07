import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { membersQuery } from "@/lib/club";
import { inviteOfficer } from "@/lib/invite.functions";
import { Avatar } from "./bits";
import { LoadingRows } from './LoadingRows';

export function TeamSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useQuery(membersQuery);
  const empty = { name: "", email: "", title: "", role: "officer" as "officer" | "treasurer" };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await inviteOfficer({ data: { ...f, origin: window.location.origin } });
      if (r.warning) toast.warning(r.warning);
      else toast.success(`Invite sent to ${f.name}`);
      setF(empty);
      qc.invalidateQueries({ queryKey: ["members"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send invite");
    } finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle className="font-display text-2xl">Your team</SheetTitle></SheetHeader>
        {isLoading && <div className="px-4"><LoadingRows /></div>}
        <ul className="mt-4 space-y-2 px-4">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <Avatar id={m.id} name={m.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.name}</div>
                <div className="truncate text-xs text-muted-foreground">{m.title || m.role}{!m.user_id && " · invite pending"}</div>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={submit} className="mt-6 space-y-3 border-t border-border px-4 pt-5">
          <div className="font-semibold">Invite an officer</div>
          <div className="space-y-1.5"><Label htmlFor="i-name">Name</Label><Input id="i-name" required maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="i-email">Email</Label><Input id="i-email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="i-title">Title</Label><Input id="i-title" maxLength={100} placeholder="VP of Events" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="i-role">Role</Label>
            <select id="i-role" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as "officer" | "treasurer" })}>
              <option value="officer">Officer — sees only their tasks</option>
              <option value="treasurer">Treasurer — sees everything</option>
            </select></div>
          <Button className="w-full" disabled={busy}>Send invite</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
