import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fetchMe, isExecRole, meQuery } from "@/lib/club";
import { TasksScreen } from "@/components/club/TasksScreen";
import { BudgetScreen } from "@/components/club/BudgetScreen";
import { TeamSheet } from "@/components/club/TeamSheet";
import { Empty } from "@/components/club/bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Your club — Club Ledger" },
      { name: "description", content: "Tasks, budget and transactions for your club." },
      { property: "og:title", content: "Your club — Club Ledger" },
      { property: "og:description", content: "Tasks, budget and transactions for your club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppPage,
});

const SCREENS = ["Tasks", "Budget", "Transactions"] as const;

function AppPage() {
  const { data: me, isLoading } = useQuery(meQuery);
  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!me) return <CreateClub />;
  return <Shell me={me} />;
}

function CreateClub() {
  const qc = useQueryClient();
  const [club, setClub] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);

  // Auto-create from details given at sign up.
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    supabase.auth.getUser().then(async ({ data }) => {
      const md = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      const pc = md["pending_club"], fn = md["full_name"];
      if (typeof pc === "string" && pc && typeof fn === "string" && fn) {
        const { error } = await supabase.rpc("create_club", { _club_name: pc, _name: fn });
        if (!error) qc.invalidateQueries();
      }
    });
  }, [qc]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("create_club", { _club_name: club, _name: name });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries();
  }
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="surface animate-fade-up w-full max-w-sm space-y-4 p-7">
        <h1 className="text-2xl font-bold">Set up your club</h1>
        <p className="text-sm text-muted-foreground">You'll be the President.</p>
        <div className="space-y-1.5"><Label htmlFor="c">Club name</Label><Input id="c" required value={club} onChange={(e) => setClub(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="n">Your name</Label><Input id="n" required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <Button className="w-full" size="lg" disabled={busy}>Create club</Button>
        <button type="button" className="w-full text-sm text-muted-foreground hover:underline" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </form>
    </main>
  );
}

type Me = NonNullable<Awaited<ReturnType<typeof fetchMe>>>;

function Shell({ me }: { me: Me }) {
  const exec = isExecRole(me.role);
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [team, setTeam] = useState(false);
  const touch = useRef<number | null>(null);

  const go = useCallback((n: number) => {
    const next = Math.max(0, Math.min(SCREENS.length - 1, n));
    setIdx((cur) => {
      setDir(next >= cur ? 1 : -1);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!exec) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select,[contenteditable],[role=dialog]")) return;
      if (e.key === "ArrowRight") go(idx + 1);
      if (e.key === "ArrowLeft") go(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exec, idx, go]);

  const clubName = (me.clubs as { name: string } | null)?.name ?? "Your club";
  const screen = exec ? SCREENS[idx] : "Tasks";

  return (
    <div
      className="mx-auto min-h-screen max-w-4xl px-4 pb-20 sm:px-6"
      onTouchStart={(e) => (touch.current = e.touches[0]!.clientX)}
      onTouchEnd={(e) => {
        if (!exec || touch.current == null) return;
        const dx = e.changedTouches[0]!.clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 60) go(idx + (dx < 0 ? 1 : -1));
      }}
    >
      <header className="flex items-center justify-between py-5">
        <div>
          <div className="font-display text-lg font-bold">{clubName}</div>
          <div className="text-xs text-muted-foreground">{me.name} · {me.title || me.role}</div>
        </div>
        <div className="flex gap-1">
          {exec && (
            <Button variant="ghost" size="sm" onClick={() => setTeam(true)}><Users /> Team</Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => supabase.auth.signOut()}><LogOut /></Button>
        </div>
      </header>

      {exec ? (
        <nav className="mb-6 flex flex-col items-center" aria-label="Screens">
          <div className="flex items-baseline gap-6 overflow-x-auto">
            {SCREENS.map((s, i) => (
              <button
                key={s}
                onClick={() => go(i)}
                aria-current={i === idx ? "page" : undefined}
                className={cn(
                  "font-display whitespace-nowrap transition-all",
                  i === idx ? "text-3xl font-bold text-foreground" : "text-lg text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5" aria-hidden>
            {SCREENS.map((s, i) => (
              <span key={s} className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-5 bg-primary" : "w-1.5 bg-border")} />
            ))}
          </div>
        </nav>
      ) : (
        <h1 className="mb-6 text-3xl font-bold">Your tasks</h1>
      )}

      <div key={screen} className={dir === 1 ? "animate-slide-right" : "animate-slide-left"}>
        {screen === "Tasks" && <TasksScreen me={me} exec={exec} />}
        {screen === "Budget" && <BudgetScreen />}
        {screen === "Transactions" && (
          <div className="surface"><Empty title="Transactions are next" line="Receipt reading with Claude lands here soon." /></div>
        )}
      </div>

      {exec && <TeamSheet open={team} onOpenChange={setTeam} />}
    </div>
  );
}
