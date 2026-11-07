create or replace function public.task_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is distinct from old.assignee_id and old.status in ('receipt_uploaded','done') then
    raise exception 'This task already has a receipt and can''t be reassigned';
  end if;
  if new.status = 'done' and old.status <> 'done' and coalesce(current_setting('app.completing_task', true), '') <> 'on' then
    raise exception 'Tasks can only be finished by confirming a receipt';
  end if;
  if old.status = 'done' and new.status <> 'done' and not public.is_exec() then
    raise exception 'Only the President or Treasurer can reopen a finished task';
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

create or replace function public.complete_task_with_receipt(
  _task_id uuid, _merchant text, _purchase_date date, _amount_cents bigint, _receipt_path text
) returns uuid language plpgsql security definer set search_path = public as $$
declare t public.tasks; me uuid := public.my_member_id(); tx uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select * into t from public.tasks where id = _task_id and club_id = public.my_club_id() for update;
  if t.id is null then raise exception 'Task not found'; end if;
  if t.assignee_id is distinct from me then raise exception 'Only the person assigned can finish this task'; end if;
  if t.status in ('done','cancelled') then raise exception 'This task is already closed'; end if;
  if coalesce(trim(_merchant),'') = '' then raise exception 'Store is required'; end if;
  if _purchase_date is null then raise exception 'Date is required'; end if;
  if _amount_cents is null or _amount_cents <= 0 then raise exception 'Total must be more than $0.00'; end if;
  if _receipt_path is null or split_part(_receipt_path,'/',1) <> t.club_id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = _receipt_path and o.owner = auth.uid()) then
    raise exception 'Upload the receipt photo first';
  end if;
  insert into public.transactions(club_id, semester_id, category_id, task_id, receipt_path, member_id, merchant, purchase_date, amount_cents, source)
    values (t.club_id, t.semester_id, t.category_id, t.id, _receipt_path, me, trim(_merchant), _purchase_date, _amount_cents, 'receipt')
    returning id into tx;
  perform set_config('app.completing_task', 'on', true);
  update public.tasks set status = 'done' where id = t.id;
  perform set_config('app.completing_task', '', true);
  insert into public.activity_log(club_id, actor_id, action, detail, task_id) values (t.club_id, me, 'task_completed', t.title, t.id);
  return tx;
end $$;
revoke execute on function public.complete_task_with_receipt(uuid,text,date,bigint,text) from public, anon;
grant execute on function public.complete_task_with_receipt(uuid,text,date,bigint,text) to authenticated;

create policy "receipts upload own club" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and split_part(name,'/',1) = public.my_club_id()::text);
create policy "receipts read uploader or exec" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (owner = auth.uid() or (public.is_exec() and split_part(name,'/',1) = public.my_club_id()::text)));
create policy "receipts delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and owner = auth.uid());