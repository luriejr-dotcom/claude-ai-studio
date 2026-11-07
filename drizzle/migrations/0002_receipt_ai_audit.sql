alter table public.transactions
  add column ai_merchant text,
  add column ai_date date,
  add column ai_total_cents bigint,
  add column ai_note text not null default '',
  add column receipt_hash text,
  add column confirmed_by uuid references public.members(id),
  add column confirmed_at timestamptz;

drop function if exists public.complete_task_with_receipt(uuid,text,date,bigint,text);

create or replace function public.complete_task_with_receipt(
  _task_id uuid, _merchant text, _purchase_date date, _amount_cents bigint, _receipt_path text,
  _ai_merchant text default null, _ai_date date default null, _ai_total_cents bigint default null,
  _ai_note text default '', _receipt_hash text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.tasks; s public.semesters; c public.categories; me uuid := public.my_member_id(); tx uuid;
  spent bigint; m text := trim(_merchant); unread text[] := '{}';
  fl jsonb := '[]'::jsonb;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select * into t from public.tasks where id = _task_id and club_id = public.my_club_id() for update;
  if t.id is null then raise exception 'Task not found'; end if;
  if t.assignee_id is distinct from me then raise exception 'Only the person assigned can finish this task'; end if;
  if t.status in ('done','cancelled') then raise exception 'This task is already closed'; end if;
  if coalesce(m,'') = '' then raise exception 'Store is required'; end if;
  if _purchase_date is null then raise exception 'Date is required'; end if;
  if _amount_cents is null or _amount_cents <= 0 then raise exception 'Total must be more than $0.00'; end if;
  if _receipt_path is null or split_part(_receipt_path,'/',1) <> t.club_id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = _receipt_path and o.owner = auth.uid()) then
    raise exception 'Upload the receipt photo first';
  end if;

  insert into public.transactions(club_id, semester_id, category_id, task_id, receipt_path, member_id, merchant, purchase_date, amount_cents, source,
      ai_merchant, ai_date, ai_total_cents, ai_note, receipt_hash, confirmed_by, confirmed_at, ai_corrected)
    values (t.club_id, t.semester_id, t.category_id, t.id, _receipt_path, me, m, _purchase_date, _amount_cents, 'receipt',
      nullif(trim(_ai_merchant),''), _ai_date, _ai_total_cents, coalesce(_ai_note,''), nullif(_receipt_hash,''), me, now(),
      (nullif(trim(_ai_merchant),'') is not null and lower(trim(_ai_merchant)) <> lower(m))
        or (_ai_date is not null and _ai_date <> _purchase_date)
        or (_ai_total_cents is not null and _ai_total_cents <> _amount_cents))
    returning id into tx;

  perform set_config('app.completing_task', 'on', true);
  update public.tasks set status = 'done' where id = t.id;
  perform set_config('app.completing_task', '', true);
  insert into public.activity_log(club_id, actor_id, action, detail, task_id) values (t.club_id, me, 'task_completed', t.title, t.id);

  -- audit checks on the confirmed values
  select * into s from public.semesters where id = t.semester_id;
  if t.limit_cents > 0 and _amount_cents > t.limit_cents then
    fl := fl || jsonb_build_object('rule','over_task_limit','severity','high','amount',_amount_cents - t.limit_cents,
      'detail', 'Spent more than the task limit');
  end if;
  if t.category_id is not null then
    select * into c from public.categories where id = t.category_id;
    select coalesce(sum(amount_cents),0) into spent from public.transactions where category_id = t.category_id;
    if c.budget_cents > 0 and spent > c.budget_cents then
      fl := fl || jsonb_build_object('rule','over_category_budget','severity','high','amount',spent - c.budget_cents,
        'detail', c.name || ' spending is over its budget');
    end if;
  end if;
  select coalesce(sum(amount_cents),0) into spent from public.transactions where semester_id = t.semester_id;
  if s.total_budget_cents > 0 and spent > s.total_budget_cents then
    fl := fl || jsonb_build_object('rule','over_semester_budget','severity','high','amount',spent - s.total_budget_cents,
      'detail', 'Semester spending is over budget');
  end if;
  if nullif(_receipt_hash,'') is not null and exists (select 1 from public.transactions where receipt_hash = _receipt_hash and id <> tx and task_id is distinct from t.id) then
    fl := fl || jsonb_build_object('rule','duplicate_receipt_photo','severity','high','detail','This exact photo was already used on another task');
  end if;
  if exists (select 1 from public.transactions where id <> tx and club_id = t.club_id and lower(merchant) = lower(m)
      and purchase_date = _purchase_date and amount_cents = _amount_cents) then
    fl := fl || jsonb_build_object('rule','possible_duplicate_purchase','severity','medium','detail','Another purchase has the same store, date and amount');
  end if;
  if _purchase_date < t.created_at::date then
    fl := fl || jsonb_build_object('rule','date_before_task','severity','medium','detail','Receipt is dated before the task was assigned');
  end if;
  if _purchase_date > current_date then
    fl := fl || jsonb_build_object('rule','date_in_future','severity','medium','detail','Receipt date is in the future');
  end if;
  if _purchase_date < s.start_date or _purchase_date > s.end_date then
    fl := fl || jsonb_build_object('rule','outside_semester','severity','low','detail','Receipt date is outside the semester');
  end if;
  if _ai_total_cents is not null and _ai_total_cents <> _amount_cents then
    fl := fl || jsonb_build_object('rule','ai_total_corrected','severity','medium','ai',_ai_total_cents,'confirmed',_amount_cents,'detail','Total was corrected by the member');
  end if;
  if nullif(trim(_ai_merchant),'') is not null and lower(trim(_ai_merchant)) <> lower(m) then
    fl := fl || jsonb_build_object('rule','ai_merchant_corrected','severity','low',
      'detail', format('AI read store as "%s", member entered "%s"', trim(_ai_merchant), m));
  end if;
  if _ai_date is not null and _ai_date <> _purchase_date then
    fl := fl || jsonb_build_object('rule','ai_date_corrected','severity','low',
      'detail', format('AI read date as %s, member entered %s', _ai_date, _purchase_date));
  end if;
  if nullif(trim(_ai_merchant),'') is null then unread := unread || 'store'; end if;
  if _ai_date is null then unread := unread || 'date'; end if;
  if _ai_total_cents is null then unread := unread || 'total'; end if;
  if cardinality(unread) > 0 then
    fl := fl || jsonb_build_object('rule','ai_field_unreadable','severity','low',
      'detail', 'AI couldn''t read the ' || array_to_string(unread, ', ') || '; the member typed it');
  end if;

  insert into public.flags(club_id, transaction_id, task_id, rule, severity, detail)
    select t.club_id, tx, t.id, f->>'rule', (f->>'severity')::flag_severity,
      case when f ? 'ai' then format('AI read total as $%s, member entered $%s',
             to_char((f->>'ai')::bigint / 100.0, 'FM999,999,990.00'), to_char((f->>'confirmed')::bigint / 100.0, 'FM999,999,990.00'))
           when f ? 'amount' then (f->>'detail') || format(' by $%s', to_char((f->>'amount')::bigint / 100.0, 'FM999,999,990.00'))
           else f->>'detail' end
    from jsonb_array_elements(fl) f;

  return jsonb_build_object('transaction_id', tx, 'flags',
    coalesce((select jsonb_agg(jsonb_build_object('rule', rule, 'severity', severity, 'detail', detail)) from public.flags where transaction_id = tx), '[]'::jsonb));
end $$;
revoke execute on function public.complete_task_with_receipt(uuid,text,date,bigint,text,text,date,bigint,text,text) from public, anon;
grant execute on function public.complete_task_with_receipt(uuid,text,date,bigint,text,text,date,bigint,text,text) to authenticated;