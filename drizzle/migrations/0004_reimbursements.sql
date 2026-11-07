CREATE TYPE public.reimb_status AS ENUM ('submitted','approved','denied','paid');
CREATE TYPE public.pay_method AS ENUM ('venmo','zelle','cash','check','club_card_refund','other');

CREATE TABLE public.reimbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id),
  semester_id uuid NOT NULL REFERENCES public.semesters(id),
  member_id uuid NOT NULL REFERENCES public.members(id),
  task_id uuid REFERENCES public.tasks(id),
  transaction_id uuid REFERENCES public.transactions(id),
  category_id uuid REFERENCES public.categories(id),
  merchant text NOT NULL DEFAULT '',
  purchase_date date NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  reason text NOT NULL DEFAULT '',
  receipt_path text NOT NULL,
  receipt_hash text,
  ai_merchant text, ai_date date, ai_total_cents bigint, ai_note text NOT NULL DEFAULT '',
  status public.reimb_status NOT NULL DEFAULT 'submitted',
  decided_by uuid REFERENCES public.members(id), decided_at timestamptz, decision_note text,
  paid_by uuid REFERENCES public.members(id), paid_at timestamptz, paid_method public.pay_method, paid_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reimbursements TO authenticated;
GRANT ALL ON public.reimbursements TO service_role;
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reimb read own or exec" ON public.reimbursements FOR SELECT TO authenticated
  USING (club_id = public.my_club_id() AND (public.is_exec() OR member_id = public.my_member_id()));

ALTER TABLE public.flags ADD COLUMN reimbursement_id uuid REFERENCES public.reimbursements(id);
CREATE POLICY "officer own reimb flags read" ON public.flags FOR SELECT TO authenticated
  USING (club_id = public.my_club_id() AND reimbursement_id IN (SELECT id FROM public.reimbursements WHERE member_id = public.my_member_id()));

-- own-money flag helper
CREATE OR REPLACE FUNCTION public._reimb_over_flag(r public.reimbursements) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if r.ai_total_cents is not null and r.amount_cents > r.ai_total_cents then
    insert into public.flags(club_id, reimbursement_id, task_id, transaction_id, rule, severity, detail)
    values (r.club_id, r.id, r.task_id, r.transaction_id, 'reimb_over_receipt', 'high',
      format('Reimbursement asks for $%s but the receipt total is $%s',
        to_char(r.amount_cents/100.0,'FM999,999,990.00'), to_char(r.ai_total_cents/100.0,'FM999,999,990.00')));
  end if;
end $$;
REVOKE EXECUTE ON FUNCTION public._reimb_over_flag(public.reimbursements) FROM PUBLIC, anon, authenticated;

-- task completion: optional own-money reimbursement
CREATE OR REPLACE FUNCTION public.complete_task_with_receipt_v2(_task_id uuid, _merchant text, _purchase_date date, _amount_cents bigint, _receipt_path text,
  _ai_merchant text DEFAULT NULL, _ai_date date DEFAULT NULL, _ai_total_cents bigint DEFAULT NULL, _ai_note text DEFAULT '', _receipt_hash text DEFAULT NULL,
  _paid_own boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare res jsonb; t public.tasks; r public.reimbursements;
begin
  if _paid_own is null then raise exception 'Say how this was paid'; end if;
  res := public.complete_task_with_receipt(_task_id, _merchant, _purchase_date, _amount_cents, _receipt_path, _ai_merchant, _ai_date, _ai_total_cents, _ai_note, _receipt_hash);
  if _paid_own then
    select * into t from public.tasks where id = _task_id;
    insert into public.reimbursements(club_id, semester_id, member_id, task_id, transaction_id, category_id, merchant, purchase_date, amount_cents,
        reason, receipt_path, receipt_hash, ai_merchant, ai_date, ai_total_cents, ai_note)
      values (t.club_id, t.semester_id, public.my_member_id(), t.id, (res->>'transaction_id')::uuid, t.category_id, trim(_merchant), _purchase_date, _amount_cents,
        'Task: ' || t.title, _receipt_path, nullif(_receipt_hash,''), nullif(trim(_ai_merchant),''), _ai_date, _ai_total_cents, coalesce(_ai_note,''))
      returning * into r;
    perform public._reimb_over_flag(r);
    insert into public.activity_log(club_id, actor_id, action, detail, task_id) values (t.club_id, r.member_id, 'reimbursement_requested', t.title, t.id);
    res := res || jsonb_build_object('reimbursement_id', r.id);
  end if;
  return res;
end $$;
GRANT EXECUTE ON FUNCTION public.complete_task_with_receipt_v2 TO authenticated;

-- standalone request
CREATE OR REPLACE FUNCTION public.submit_reimbursement(_merchant text, _purchase_date date, _amount_cents bigint, _receipt_path text, _category_id uuid, _reason text,
  _ai_merchant text DEFAULT NULL, _ai_date date DEFAULT NULL, _ai_total_cents bigint DEFAULT NULL, _ai_note text DEFAULT '', _receipt_hash text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare me uuid := public.my_member_id(); club uuid := public.my_club_id(); c public.categories; sem uuid; r public.reimbursements;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if coalesce(trim(_merchant),'') = '' then raise exception 'Store is required'; end if;
  if _purchase_date is null then raise exception 'Date is required'; end if;
  if _amount_cents is null or _amount_cents <= 0 then raise exception 'Total must be more than $0.00'; end if;
  if coalesce(trim(_reason),'') = '' then raise exception 'Add a short reason'; end if;
  if length(_reason) > 300 then raise exception 'Keep the reason under 300 characters'; end if;
  select * into c from public.categories where id = _category_id and club_id = club;
  if c.id is null then raise exception 'Pick a category'; end if;
  sem := c.semester_id;
  if _receipt_path is null or split_part(_receipt_path,'/',1) <> club::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = _receipt_path and o.owner = auth.uid()) then
    raise exception 'Upload the receipt photo first';
  end if;
  insert into public.reimbursements(club_id, semester_id, member_id, category_id, merchant, purchase_date, amount_cents, reason, receipt_path, receipt_hash,
      ai_merchant, ai_date, ai_total_cents, ai_note)
    values (club, sem, me, c.id, trim(_merchant), _purchase_date, _amount_cents, trim(_reason), _receipt_path, nullif(_receipt_hash,''),
      nullif(trim(_ai_merchant),''), _ai_date, _ai_total_cents, coalesce(_ai_note,''))
    returning * into r;
  perform public._reimb_over_flag(r);
  insert into public.activity_log(club_id, actor_id, action, detail) values (club, me, 'reimbursement_requested', trim(_reason));
  return r.id;
end $$;
GRANT EXECUTE ON FUNCTION public.submit_reimbursement TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_reimbursement(_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare r public.reimbursements; me uuid := public.my_member_id(); tx uuid;
begin
  if not public.is_exec() then raise exception 'Only the President or Treasurer can approve or deny'; end if;
  select * into r from public.reimbursements where id = _id and club_id = public.my_club_id() for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if r.status <> 'submitted' then raise exception 'This request was already decided'; end if;
  if not _approve and coalesce(trim(_note),'') = '' then raise exception 'Give a reason for denying'; end if;
  tx := r.transaction_id;
  if _approve and tx is null then
    insert into public.transactions(club_id, semester_id, category_id, receipt_path, member_id, merchant, purchase_date, amount_cents, source,
        ai_merchant, ai_date, ai_total_cents, ai_note, receipt_hash, confirmed_by, confirmed_at, ai_corrected)
      values (r.club_id, r.semester_id, r.category_id, r.receipt_path, r.member_id, r.merchant, r.purchase_date, r.amount_cents, 'reimbursement',
        r.ai_merchant, r.ai_date, r.ai_total_cents, r.ai_note, r.receipt_hash, r.member_id, r.created_at,
        (r.ai_merchant is not null and lower(r.ai_merchant) <> lower(r.merchant)) or (r.ai_date is not null and r.ai_date <> r.purchase_date)
          or (r.ai_total_cents is not null and r.ai_total_cents <> r.amount_cents))
      returning id into tx;
    update public.flags set transaction_id = tx where reimbursement_id = r.id;
  end if;
  update public.reimbursements set status = case when _approve then 'approved'::reimb_status else 'denied'::reimb_status end,
    decided_by = me, decided_at = now(), decision_note = nullif(trim(_note),''), transaction_id = tx where id = r.id;
  update public.flags set status = 'reviewed', reviewed_by = me where reimbursement_id = r.id and rule = 'reimb_waiting' and status = 'open';
  insert into public.activity_log(club_id, actor_id, action, detail, task_id)
    values (r.club_id, me, case when _approve then 'reimbursement_approved' else 'reimbursement_denied' end, r.merchant || ' ' || to_char(r.amount_cents/100.0,'FM999,999,990.00'), r.task_id);
end $$;
GRANT EXECUTE ON FUNCTION public.decide_reimbursement TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_reimbursement_paid(_id uuid, _method public.pay_method, _reference text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare r public.reimbursements; me uuid := public.my_member_id();
begin
  if not public.is_exec() then raise exception 'Only the President or Treasurer can mark paid'; end if;
  if _method is null then raise exception 'Pick how it was paid'; end if;
  if length(coalesce(_reference,'')) > 200 then raise exception 'Keep the note under 200 characters'; end if;
  select * into r from public.reimbursements where id = _id and club_id = public.my_club_id() for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if r.status <> 'approved' then raise exception 'Only approved requests can be marked paid'; end if;
  update public.reimbursements set status = 'paid', paid_by = me, paid_at = now(), paid_method = _method, paid_reference = nullif(trim(_reference),'') where id = r.id;
  insert into public.activity_log(club_id, actor_id, action, detail, task_id) values (r.club_id, me, 'reimbursement_paid', _method::text, r.task_id);
end $$;
GRANT EXECUTE ON FUNCTION public.mark_reimbursement_paid TO authenticated;

-- raise "waiting > 7 days" flags (idempotent; called when execs open the app)
CREATE OR REPLACE FUNCTION public.flag_stale_reimbursements() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.is_exec() then return; end if;
  insert into public.flags(club_id, reimbursement_id, task_id, transaction_id, rule, severity, detail)
  select r.club_id, r.id, r.task_id, r.transaction_id, 'reimb_waiting', 'medium',
    format('Reimbursement for %s ($%s) has waited over 7 days', r.merchant, to_char(r.amount_cents/100.0,'FM999,999,990.00'))
  from public.reimbursements r
  where r.club_id = public.my_club_id() and r.status = 'submitted' and r.created_at < now() - interval '7 days'
    and not exists (select 1 from public.flags f where f.reimbursement_id = r.id and f.rule = 'reimb_waiting');
end $$;
GRANT EXECUTE ON FUNCTION public.flag_stale_reimbursements TO authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_task_with_receipt(uuid, text, date, bigint, text, text, date, bigint, text, text) FROM PUBLIC, anon, authenticated;