
create type public.member_role as enum ('president','treasurer','officer');
create type public.task_status as enum ('assigned','receipt_uploaded','done','cancelled');
create type public.flag_severity as enum ('high','medium','low');
create type public.flag_status as enum ('open','reviewed');

create table public.clubs (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table public.members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid unique,
  name text not null, title text not null default '', role public.member_role not null default 'officer',
  email text not null, active boolean not null default true, created_at timestamptz not null default now(),
  unique (club_id, email)
);
create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null, start_date date not null, end_date date not null,
  total_budget_cents bigint not null default 0 check (total_budget_cents >= 0),
  created_at timestamptz not null default now(), check (end_date >= start_date)
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  name text not null, budget_cents bigint not null default 0 check (budget_cents >= 0),
  created_at timestamptz not null default now()
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null, notes text not null default '',
  assignee_id uuid references public.members(id) on delete set null,
  created_by uuid references public.members(id) on delete set null,
  limit_cents bigint not null default 0 check (limit_cents >= 0),
  due_date date, status public.task_status not null default 'assigned',
  created_at timestamptz not null default now(), completed_at timestamptz
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  receipt_path text, member_id uuid references public.members(id) on delete set null,
  merchant text not null default '', purchase_date date not null default current_date,
  amount_cents bigint not null check (amount_cents >= 0),
  source text not null default 'receipt' check (source in ('receipt','import')),
  ai_corrected boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.flags (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  rule text not null, severity public.flag_severity not null, detail text not null,
  status public.flag_status not null default 'open',
  reviewed_by uuid references public.members(id) on delete set null, review_note text,
  created_at timestamptz not null default now()
);
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  actor_id uuid references public.members(id) on delete set null,
  action text not null, detail text not null default '', task_id uuid,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.clubs, public.members, public.semesters, public.categories, public.tasks, public.transactions, public.flags, public.activity_log to authenticated;
grant all on public.clubs, public.members, public.semesters, public.categories, public.tasks, public.transactions, public.flags, public.activity_log to service_role;

-- helpers
create or replace function public.my_member_id() returns uuid language sql stable security definer set search_path = public as
$$ select id from public.members where user_id = auth.uid() and active limit 1 $$;
create or replace function public.my_club_id() returns uuid language sql stable security definer set search_path = public as
$$ select club_id from public.members where user_id = auth.uid() and active limit 1 $$;
create or replace function public.is_exec() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.members where user_id = auth.uid() and active and role in ('president','treasurer')) $$;

alter table public.clubs enable row level security;
alter table public.members enable row level security;
alter table public.semesters enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.transactions enable row level security;
alter table public.flags enable row level security;
alter table public.activity_log enable row level security;

create policy "own club read" on public.clubs for select to authenticated using (id = public.my_club_id());
create policy "exec update club" on public.clubs for update to authenticated using (id = public.my_club_id() and public.is_exec());

create policy "club members read" on public.members for select to authenticated using (club_id = public.my_club_id());
create policy "exec insert members" on public.members for insert to authenticated with check (club_id = public.my_club_id() and public.is_exec());
create policy "exec update members" on public.members for update to authenticated using (club_id = public.my_club_id() and public.is_exec());

-- semesters: everyone in club may see name/dates (needed for task scoping); budgets are on categories+semester total. Officers only read via tasks; restrict semesters to execs too.
create policy "exec semesters" on public.semesters for all to authenticated using (club_id = public.my_club_id() and public.is_exec()) with check (club_id = public.my_club_id() and public.is_exec());
create policy "club categories read" on public.categories for select to authenticated using (club_id = public.my_club_id());
create policy "exec categories write" on public.categories for insert to authenticated with check (club_id = public.my_club_id() and public.is_exec());
create policy "exec categories update" on public.categories for update to authenticated using (club_id = public.my_club_id() and public.is_exec());
create policy "exec categories delete" on public.categories for delete to authenticated using (club_id = public.my_club_id() and public.is_exec());

create policy "tasks read" on public.tasks for select to authenticated using (club_id = public.my_club_id() and (public.is_exec() or assignee_id = public.my_member_id()));
create policy "exec tasks insert" on public.tasks for insert to authenticated with check (club_id = public.my_club_id() and public.is_exec());
create policy "tasks update" on public.tasks for update to authenticated using (club_id = public.my_club_id() and (public.is_exec() or assignee_id = public.my_member_id()));
create policy "exec tasks delete" on public.tasks for delete to authenticated using (club_id = public.my_club_id() and public.is_exec());

create policy "exec transactions" on public.transactions for all to authenticated using (club_id = public.my_club_id() and public.is_exec()) with check (club_id = public.my_club_id() and public.is_exec());
create policy "exec flags" on public.flags for all to authenticated using (club_id = public.my_club_id() and public.is_exec()) with check (club_id = public.my_club_id() and public.is_exec());
create policy "exec activity read" on public.activity_log for select to authenticated using (club_id = public.my_club_id() and public.is_exec());
create policy "club activity insert" on public.activity_log for insert to authenticated with check (club_id = public.my_club_id() and actor_id = public.my_member_id());

-- task guard: officers may only change status/completed_at; no delegation after receipt
create or replace function public.task_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is distinct from old.assignee_id and old.status in ('receipt_uploaded','done') then
    raise exception 'This task already has a receipt and can''t be reassigned';
  end if;
  if not public.is_exec() then
    if new.title is distinct from old.title or new.notes is distinct from old.notes or new.assignee_id is distinct from old.assignee_id
      or new.limit_cents is distinct from old.limit_cents or new.category_id is distinct from old.category_id
      or new.due_date is distinct from old.due_date or new.semester_id is distinct from old.semester_id or new.club_id is distinct from old.club_id
      or new.status = 'cancelled' then
      raise exception 'Only the President or Treasurer can change task details';
    end if;
  end if;
  if new.status = 'done' and old.status <> 'done' then new.completed_at := now(); end if;
  if new.status <> 'done' then new.completed_at := null; end if;
  return new;
end $$;
create trigger task_guard before update on public.tasks for each row execute function public.task_guard();

-- category budgets can't exceed semester total
create or replace function public.category_budget_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare total bigint; used bigint;
begin
  select total_budget_cents into total from public.semesters where id = new.semester_id;
  select coalesce(sum(budget_cents),0) into used from public.categories where semester_id = new.semester_id and id <> new.id;
  if used + new.budget_cents > total then
    raise exception 'Task type budgets would add up to more than the semester budget';
  end if;
  return new;
end $$;
create trigger category_budget_guard before insert or update on public.categories for each row execute function public.category_budget_guard();

-- create a club for a brand-new user (becomes President) with a starter semester
create or replace function public.create_club(_club_name text, _name text) returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; sid uuid; em text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists(select 1 from public.members where user_id = auth.uid()) then raise exception 'You already belong to a club'; end if;
  select email into em from auth.users where id = auth.uid();
  insert into public.clubs(name) values (trim(_club_name)) returning id into cid;
  insert into public.members(club_id,user_id,name,title,role,email) values (cid, auth.uid(), trim(_name), 'President', 'president', em);
  insert into public.semesters(club_id,name,start_date,end_date,total_budget_cents)
    values (cid, case when extract(month from now()) >= 7 then 'Fall ' else 'Spring ' end || extract(year from now())::int,
      current_date, current_date + 120, 0) returning id into sid;
  insert into public.categories(club_id, semester_id, name, budget_cents) values
    (cid,sid,'Food',0),(cid,sid,'Venue',0),(cid,sid,'Travel',0),(cid,sid,'Supplies',0);
  return cid;
end $$;
grant execute on function public.create_club(text,text) to authenticated;

-- link an invited user's account to their member row on sign in
create or replace function public.claim_membership() returns void language plpgsql security definer set search_path = public as $$
declare em text;
begin
  select email into em from auth.users where id = auth.uid();
  update public.members set user_id = auth.uid() where lower(email) = lower(em) and user_id is null and active;
end $$;
grant execute on function public.claim_membership() to authenticated;
