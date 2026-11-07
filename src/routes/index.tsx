import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Club Ledger — club money, minus the headache" },
      { name: "description", content: "Track your student club's budget, tasks and receipts in a few taps." },
      { property: "og:title", content: "Club Ledger — club money, minus the headache" },
      { property: "og:description", content: "Track your student club's budget, tasks and receipts in a few taps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [f, setF] = useState({ email: "", password: "", name: "", club: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/app" });
    });
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
        if (error) throw error;
        nav({ to: "/app" });
      } else if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email: f.email,
          password: f.password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { pending_club: f.club.trim(), full_name: f.name.trim() },
          },
        });
        if (error) throw error;
        setSent("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(f.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="bg-hero hidden flex-col justify-between p-12 text-primary-foreground lg:flex">
        <div className="font-display text-xl font-bold">Club Ledger</div>
        <div>
          <h1 className="font-display text-5xl font-bold leading-tight">
            Club money,
            <br />
            minus the headache.
          </h1>
          <p className="mt-4 max-w-md text-lg opacity-80">
            Hand out spending tasks, snap receipts, and always know what's left to spend.
          </p>
        </div>
        <p className="text-sm opacity-60">Made for business clubs, fraternities and sororities.</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="surface animate-fade-up w-full max-w-sm p-7">
          <h2 className="text-2xl font-bold">
            {mode === "in" ? "Welcome back" : mode === "up" ? "Start your club" : "Reset password"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "up"
              ? "You'll be the President. Invite your officers after."
              : mode === "in"
                ? "Officers: use the email your exec invited."
                : "We'll email you a link."}
          </p>
          {sent ? (
            <p className="mt-6 rounded-lg bg-secondary p-4 text-sm text-secondary-foreground">{sent}</p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "up" && (
                <>
                  <Field id="club" label="Club name" value={f.club} onChange={set("club")} />
                  <Field id="name" label="Your name" value={f.name} onChange={set("name")} />
                </>
              )}
              <Field id="email" label="Email" type="email" value={f.email} onChange={set("email")} />
              {mode !== "forgot" && (
                <Field id="password" label="Password" type="password" value={f.password} onChange={set("password")} minLength={8} />
              )}
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {mode === "in" ? "Sign in" : mode === "up" ? "Create club" : "Send link"}
              </Button>
            </form>
          )}
          <div className="mt-5 flex flex-col gap-1 text-sm">
            {mode !== "in" && (
              <button className="text-primary hover:underline" onClick={() => { setMode("in"); setSent(null); }}>
                I already have an account
              </button>
            )}
            {mode === "in" && (
              <>
                <button className="text-primary hover:underline" onClick={() => setMode("up")}>
                  New here? Start a club
                </button>
                <button className="text-muted-foreground hover:underline" onClick={() => setMode("forgot")}>
                  Forgot password?
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({ id, label, ...p }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} required {...p} />
    </div>
  );
}
