import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fetchMe, isExecRole, meQuery, tasksQuery } from "@/lib/club";
import { TasksScreen } from "@/components/club/TasksScreen";
import { BudgetScreen } from "@/components/club/BudgetScreen";
import { TransactionsScreen } from "@/components/club/TransactionsScreen";
import { TeamSheet } from "@/components/club/TeamSheet";
import { ReimbursementsScreen, reimbQuery } from "@/components/club/Reimbursements";
import { AttentionDot } from "@/components/club/AttentionDot";
import { reimbursementNeedsAttention, taskNeedsAttention } from "@/lib/attention";
import { cn } from "@/lib/utils";
import { DemoControls } from '@/components/club/DemoControls';
import { LoadingRows } from '@/components/club/LoadingRows';

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
  validateSearch: (s: Record<string, unknown>): { dup?: string | undefined } => ({ dup: typeof s["dup"] === "string" ? s["dup"] : undefined }),
  component: AppPage,
});

const SCREENS = ["Tasks", "Budget", "Transactions", "Reimbursements"] as const;

function AppPage() {
  const { data: me, isLoading } = useQuery(meQuery);
  if (isLoading) return <div className="mx-auto max-w-4xl p-4"><LoadingRows /></div>;
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
  const { dup } = Route.useSearch();
  const navigate = Route.useNavigate();
  const exec = isExecRole(me.role);
  const { data: attentionTasks = [] } = useQuery({ ...tasksQuery, refetchInterval: 30_000 });
  const { data: attentionRequests = [] } = useQuery({ ...reimbQuery, refetchInterval: 30_000 });
  const tasksAttention = attentionTasks.some((task) => taskNeedsAttention(task, exec, me.id));
  const requestsAttention = attentionRequests.some((request) => reimbursementNeedsAttention(request, exec));
  const [idx, setIdx] = useState(1);
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

  useEffect(() => {
    if (exec) void supabase.rpc("flag_stale_reimbursements");
  }, [exec]);

  const clubName = (me.clubs as { name: string } | null)?.name ?? "Your club";
  const screen = exec ? SCREENS[idx] : "Tasks";

  return (
    <div
      className="club-workspace mx-auto min-h-screen max-w-[1200px] px-4 pb-16 sm:px-8"
      onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        if (!exec || touch.current == null) return;
        const end = e.changedTouches[0];
        if (!end) return;
        const dx = end.clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 60) go(idx + (dx < 0 ? 1 : -1));
      }}
    >
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-5">
        <div className="min-w-0 border-l-2 border-primary pl-3">
          <div className="font-display text-lg font-bold break-words">{clubName}</div>
          <div className="text-xs text-muted-foreground">{me.name} · {me.title || me.role}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          {exec && (
            <Button variant="ghost" size="sm" onClick={() => setTeam(true)}><Users /> Team</Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => supabase.auth.signOut()}><LogOut /></Button>
        </div>
      </header>

      {exec && <DemoControls name={clubName} isDemo={(me.clubs as { is_demo?: boolean } | null)?.is_demo ?? false} />}
      {!exec && clubName.includes('(demo)') && <p className="mb-4 text-sm text-primary">Fictional demo — no real purchases or payments.</p>}

      {exec ? (
        <nav className="swipe-navigation mb-8 flex flex-col items-center border-b border-border pb-6 pt-4" aria-label="Screens">
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:justify-center sm:gap-6">
            {SCREENS.map((s, i) => (
              <Button variant="ghost"
                key={s}
                onClick={() => go(i)}
                aria-current={i === idx ? "page" : undefined}
                className={cn(
                  "font-display h-12 min-w-0 gap-1 px-1 whitespace-nowrap transition-colors sm:gap-2 sm:px-4",
                  i === idx ? "text-base sm:text-3xl font-bold text-foreground" : "text-sm sm:text-lg text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
                {((s === "Tasks" && tasksAttention) || (s === "Reimbursements" && requestsAttention)) && <AttentionDot />}
              </Button>
            ))}
          </div>
          <div className="mt-3 flex h-2 items-center gap-1.5" aria-hidden>
            {SCREENS.map((s, i) => (
              <span key={s} className={cn("h-1.5 rounded-full transition-all duration-200", i === idx ? "w-6 bg-primary" : "w-1.5 bg-border")} />
            ))}
          </div>
        </nav>
      ) : (
        <h1 className="mb-6 text-3xl font-bold">Your tasks</h1>
      )}

      <div key={screen} className={dir === 1 ? "animate-slide-right" : "animate-slide-left"}>
        {screen === "Reimbursements" && <ReimbursementsScreen exec clubId={me.club_id} />}
        {screen === "Tasks" && <TasksScreen me={me} exec={exec} dupId={dup} onDupUsed={() => navigate({ search: { dup: undefined }, replace: true })} />}
        {screen === "Tasks" && !exec && <div className="mt-8"><ReimbursementsScreen exec={false} clubId={me.club_id} /></div>}
        {screen === "Budget" && <BudgetScreen onOpenReimbursements={() => go(3)} />}
        {screen === "Transactions" && <TransactionsScreen />}
      </div>

      {exec && <TeamSheet open={team} onOpenChange={setTeam} />}
    </div>
  );
}
