import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, BookOpen, Check, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import loginDesk from "@/assets/clubledge-login-desk.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — ClubLedge" },
      { name: "description", content: "Track your student club's budget, tasks and receipts in a few taps." },
      { property: "og:title", content: "Sign in — ClubLedge" },
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
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="login-page relative isolate flex min-h-svh flex-col overflow-hidden bg-background">
      <img src={loginDesk} alt="" width={1920} height={1280} fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-background/80 dark:bg-background/95" />
      <header className="flex items-center justify-between gap-3 px-6 py-6 sm:px-10">
        <div className="flex items-center gap-2.5 font-display text-lg font-bold"><BookOpen className="size-5 text-primary" strokeWidth={2.5} />ClubLedge<span className="size-1.5 rounded-full bg-accent" /></div>
        <span className="hidden text-xs font-medium text-muted-foreground sm:block">A little less admin. A lot more club.</span>
      </header>
      <section className="animate-fade-up mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-8 sm:py-12">
        <div className="mb-9 text-center">
          <div className="relative mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
            <BookOpen className="size-7" strokeWidth={1.8} />
          </div>
          <h1 className="font-display text-5xl font-bold leading-none sm:text-6xl">ClubLedge<span className="text-accent">.</span></h1>
          <p className="mt-3 text-sm text-muted-foreground">Club money, minus the headache.</p>
        </div>
        <div className="mb-6 border-t border-border pt-7">
          <h2 className="font-display text-2xl font-bold">{mode === "in" ? "Good to have you back." : mode === "up" ? "Your club starts here." : "Let's get you back in."}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{mode === "in" ? "Sign in to your club's workspace." : mode === "up" ? "Create your account and bring your team together." : "Enter your email and we'll send a reset link."}</p>
        </div>
        {sent ? (
          <div role="status" className="flex gap-3 rounded-xl border border-primary/20 bg-secondary p-5 text-sm leading-relaxed text-secondary-foreground"><Check className="mt-0.5 size-5 shrink-0 text-primary" />{sent}</div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {mode === "up" && <div className="grid gap-5"><Field id="club" label="Club name" placeholder="Your club" value={f.club} onChange={set("club")} /><Field id="name" label="Your name" autoComplete="name" placeholder="First and last name" value={f.name} onChange={set("name")} /></div>}
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-4 size-4 text-muted-foreground" /><Input id="email" required type="email" autoComplete="email" placeholder="you@university.edu" value={f.email} onChange={set("email")} className="h-12 rounded-lg bg-card pl-10" /></div>
            </div>
            {mode !== "forgot" && <div className="space-y-2">
              <div className="flex items-center justify-between"><Label htmlFor="password">Password</Label>{mode === "in" && <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => { setMode("forgot"); setSent(null); }}>Forgot password?</Button>}</div>
              <div className="relative"><LockKeyhole className="pointer-events-none absolute left-3.5 top-4 size-4 text-muted-foreground" /><Input id="password" required type={showPassword ? "text" : "password"} minLength={8} autoComplete={mode === "up" ? "new-password" : "current-password"} placeholder={mode === "up" ? "At least 8 characters" : "Enter your password"} value={f.password} onChange={set("password")} className="h-12 rounded-lg bg-card pl-10 pr-12" /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-10 text-muted-foreground" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div>
            </div>}
            <Button type="submit" className="h-12 w-full rounded-lg text-sm shadow-soft" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}{busy ? "Please wait…" : mode === "in" ? "Sign in" : mode === "up" ? "Create your club" : "Send reset link"}{!busy && <ArrowRight className="ml-auto size-4" />}</Button>
          </form>
        )}
        <div className="mt-6 text-center text-sm">
          {mode === "in" ? <><span className="text-muted-foreground">New to ClubLedge? </span><Button variant="link" className="h-auto p-0 font-semibold" onClick={() => { setMode("up"); setSent(null); }}>Start a club</Button></> : <Button variant="link" className="h-auto p-0" onClick={() => { setMode("in"); setSent(null); }}><ArrowLeft className="size-3.5" />Back to sign in</Button>}
        </div>
      </section>
      <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6 pb-7 pt-5 text-xs text-muted-foreground"><span>Made for the people who make clubs happen.</span><span className="flex items-center gap-1.5"><LockKeyhole className="size-3" />Your club. Your business.</span></footer>
    </main>
  );
}

function Field({ id, label, ...p }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} required className="h-12 rounded-lg bg-card" {...p} />
    </div>
  );
}
