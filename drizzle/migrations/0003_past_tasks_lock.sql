CREATE OR REPLACE FUNCTION public.task_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if old.status in ('done','cancelled') then
    raise exception 'Past tasks can''t be edited';
  end if;
  if new.assignee_id is distinct from old.assignee_id and old.status = 'receipt_uploaded' then
    raise exception 'This task already has a receipt and can''t be reassigned';
  end if;
  if new.status = 'done' and coalesce(current_setting('app.completing_task', true), '') <> 'on' then
    raise exception 'Tasks can only be finished by confirming a receipt';
  end if;
  if new.status = 'cancelled' and not public.is_exec() then
    raise exception 'Only the President or Treasurer can cancel a task';
  end if;
  if not public.is_exec() then
    if new.title is distinct from old.title or new.notes is distinct from old.notes or new.assignee_id is distinct from old.assignee_id
      or new.limit_cents is distinct from old.limit_cents or new.category_id is distinct from old.category_id
      or new.due_date is distinct from old.due_date or new.semester_id is distinct from old.semester_id or new.club_id is distinct from old.club_id then
      raise exception 'Only the President or Treasurer can change task details';
    end if;
  end if;
  if new.status in ('done','cancelled') then new.completed_at := now(); else new.completed_at := null; end if;
  return new;
end $$;

CREATE POLICY "officer own transactions read" ON public.transactions FOR SELECT TO authenticated
  USING (club_id = public.my_club_id() AND member_id = public.my_member_id());

CREATE POLICY "officer own task flags read" ON public.flags FOR SELECT TO authenticated
  USING (club_id = public.my_club_id() AND task_id IN (SELECT id FROM public.tasks WHERE assignee_id = public.my_member_id()));