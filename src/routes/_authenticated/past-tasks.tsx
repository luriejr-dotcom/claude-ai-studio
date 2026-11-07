import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { categoriesQuery, isExecRole, meQuery, membersQuery, tasksQuery } from "@/lib/club";
import { PastTasksList } from "@/components/club/PastTasks";

export const Route = createFileRoute("/_authenticated/past-tasks")({
  head: () => ({
    meta: [
      { title: "Past tasks — Club Ledger" },
      { name: "description", content: "Every finished and cancelled club task, with receipts and checks." },
      { property: "og:title", content: "Past tasks — Club Ledger" },
      { property: "og:description", content: "Every finished and cancelled club task, with receipts and checks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PastTasksPage,
});

function PastTasksPage() {
  const navigate = useNavigate();
  const { data: me } = useQuery(meQuery);
  const { data: tasks = [] } = useQuery(tasksQuery);
  const { data: members = [] } = useQuery(membersQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const exec = isExecRole(me?.role);
  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 pb-20 sm:px-6">
      <header className="py-5">
        <Link to="/app" search={{ dup: undefined }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to tasks</Link>
        <h1 className="mt-3 text-3xl font-bold">Past tasks</h1>
        <p className="text-sm text-muted-foreground">{exec ? "Everything the club has finished or cancelled." : "Tasks you've finished, plus any that were cancelled."}</p>
      </header>
      <PastTasksList
        tasks={tasks} members={members} cats={cats} exec={exec}
        onDuplicate={(t) => navigate({ to: "/app", search: { dup: t.id } })}
      />
    </div>
  );
}
