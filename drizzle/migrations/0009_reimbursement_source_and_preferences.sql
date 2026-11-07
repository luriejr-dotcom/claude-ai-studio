ALTER TABLE public.transactions DROP CONSTRAINT transactions_source_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_source_check CHECK (source IN ('receipt', 'import', 'reimbursement'));
ALTER TYPE public.pay_method ADD VALUE IF NOT EXISTS 'wire';
ALTER TYPE public.pay_method ADD VALUE IF NOT EXISTS 'paypal';
ALTER TABLE public.reimbursements ADD COLUMN preferred_method text CHECK (preferred_method IN ('wire','venmo','paypal','zelle','cash','check','club_card_refund','other'));

CREATE FUNCTION public.submit_reimbursement_v2(_merchant text, _purchase_date date, _amount_cents bigint, _receipt_path text, _category_id uuid, _reason text, _preferred_method text,
 _ai_merchant text DEFAULT NULL, _ai_date date DEFAULT NULL, _ai_total_cents bigint DEFAULT NULL, _ai_note text DEFAULT '', _receipt_hash text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
 IF _preferred_method IS NULL OR _preferred_method NOT IN ('wire','venmo','paypal','zelle','cash','check','club_card_refund','other') THEN RAISE EXCEPTION 'Choose how you want to be reimbursed'; END IF;
 rid := public.submit_reimbursement(_merchant,_purchase_date,_amount_cents,_receipt_path,_category_id,_reason,_ai_merchant,_ai_date,_ai_total_cents,_ai_note,_receipt_hash);
 UPDATE public.reimbursements SET preferred_method=_preferred_method WHERE id=rid;
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.submit_reimbursement_v2 FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_reimbursement_v2 TO authenticated;

CREATE FUNCTION public.complete_task_with_receipt_v3(_task_id uuid, _merchant text, _purchase_date date, _amount_cents bigint, _receipt_path text,
 _ai_merchant text DEFAULT NULL, _ai_date date DEFAULT NULL, _ai_total_cents bigint DEFAULT NULL, _ai_note text DEFAULT '', _receipt_hash text DEFAULT NULL,
 _paid_own boolean DEFAULT NULL, _preferred_method text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
 IF _paid_own AND (_preferred_method IS NULL OR _preferred_method NOT IN ('wire','venmo','paypal','zelle','cash','check','club_card_refund','other')) THEN RAISE EXCEPTION 'Choose how you want to be reimbursed'; END IF;
 res := public.complete_task_with_receipt_v2(_task_id,_merchant,_purchase_date,_amount_cents,_receipt_path,_ai_merchant,_ai_date,_ai_total_cents,_ai_note,_receipt_hash,_paid_own);
 IF _paid_own THEN UPDATE public.reimbursements SET preferred_method=_preferred_method WHERE id=(res->>'reimbursement_id')::uuid; END IF;
 RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.complete_task_with_receipt_v3 FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_task_with_receipt_v3 TO authenticated;