import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set your password — Club Ledger" },
      { name: "description", content: "Choose a password for your Club Ledger account." },
      { property: "og:title", content: "Set your password — Club Ledger" },
      { property: "og:description", content: "Choose a password for your Club Ledger account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

// Used for both password resets (type=recovery) and officer invites (type=invite).
function ResetPassword() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password saved");
    nav({ to: "/app" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="surface animate-fade-up w-full max-w-sm space-y-4 p-7">
        <h1 className="text-2xl font-bold">Set your password</h1>
        <p className="text-sm text-muted-foreground">At least 8 characters.</p>
        <div className="space-y-1.5">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={busy}>Save and continue</Button>
      </form>
    </main>
  );
}
