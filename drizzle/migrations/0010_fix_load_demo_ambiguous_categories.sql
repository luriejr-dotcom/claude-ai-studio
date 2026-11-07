CREATE OR REPLACE FUNCTION public.load_demo(_reset boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cid uuid:=public.my_club_id(); me uuid:=public.my_member_id(); sid uuid; person uuid; cat uuid; task1 uuid:=gen_random_uuid(); task2 uuid:=gen_random_uuid(); tx1 uuid; tx2 uuid; role_now public.member_role; cname text; demo boolean; k int; i int; amt bigint; cat_names text[]:=ARRAY['Food','Venue','Travel','Supplies']; amounts bigint[][]:=ARRAY[ARRAY[1400,2200,3500,4600,5800,6200,7400,8500,9200,11000],ARRAY[1400,3200,57000,6000,8000,9000,10000,11000,13000,14000],ARRAY[1400,2800,4200,5600,7000,8400,9800,11200,12600,28000],ARRAY[1400,2200,3400,4200,5100,6200,7300,8800,9600,12800]];
BEGIN
 IF me IS NULL OR NOT public.is_exec() THEN RAISE EXCEPTION 'Only execs can load or reset demo data'; END IF;
 SELECT name,is_demo INTO cname,demo FROM public.clubs WHERE id=cid FOR UPDATE;
 IF _reset THEN
   IF NOT demo OR position('(demo)' in cname)=0 THEN RAISE EXCEPTION 'Reset only works on a club named (demo)'; END IF;
 ELSE
   IF NOT public.demo_available() THEN RAISE EXCEPTION 'Demo data can only be loaded into an empty club'; END IF;
 END IF;
 SELECT role INTO role_now FROM public.members WHERE id=me;
 DELETE FROM public.flags WHERE club_id=cid;
 DELETE FROM public.reimbursements WHERE club_id=cid;
 DELETE FROM public.transactions WHERE club_id=cid;
 DELETE FROM public.tasks WHERE club_id=cid;
 DELETE FROM public.activity_log WHERE club_id=cid;
 DELETE FROM public.categories WHERE club_id=cid;
 DELETE FROM public.semesters WHERE club_id=cid;
 DELETE FROM public.members WHERE club_id=cid AND id<>me AND user_id IS NULL;
 PERFORM set_config('app.loading_demo','on',true); UPDATE public.clubs SET name='Demo Business Club (demo)',is_demo=true WHERE id=cid;
 UPDATE public.members SET name=CASE WHEN role_now='treasurer' THEN 'Avery Kim' ELSE 'Jordan Patel' END,title=CASE WHEN role_now='treasurer' THEN 'Treasurer' ELSE 'President' END,email=CASE WHEN role_now='treasurer' THEN 'avery.kim@example.com' ELSE 'jordan.patel@example.com' END WHERE id=me;
 INSERT INTO public.members(club_id,name,title,role,email) SELECT cid,n,t,r::public.member_role,e FROM (VALUES ('Jordan Patel','President','president','jordan.patel@example.com'),('Avery Kim','Treasurer','treasurer','avery.kim@example.com'),('Sam Rivera','VP of Events','officer','sam.rivera@example.com'),('Riley Chen','VP of External Relations','officer','riley.chen@example.com'),('Taylor Brooks','New Member Education','officer','taylor.brooks@example.com'),('Morgan Lee','Social Chair','officer','morgan.lee@example.com')) v(n,t,r,e) WHERE NOT EXISTS(SELECT 1 FROM public.members WHERE club_id=cid AND email=e);
 INSERT INTO public.semesters(club_id,name,start_date,end_date,total_budget_cents) VALUES(cid,'Fall 2026','2026-08-24','2026-12-18',500000) RETURNING id INTO sid;
 INSERT INTO public.categories(club_id,semester_id,name,budget_cents) VALUES(cid,sid,'Food',70000),(cid,sid,'Venue',150000),(cid,sid,'Travel',120000),(cid,sid,'Supplies',60000);
 FOR k IN 1..4 LOOP
 SELECT id INTO cat FROM public.categories WHERE club_id=cid AND name=cat_names[k];
 FOR i IN 1..10 LOOP
 SELECT id INTO person FROM public.members WHERE club_id=cid ORDER BY name OFFSET ((i-1)%6) LIMIT 1;
 amt:=amounts[k][i];
 INSERT INTO public.transactions(club_id,semester_id,category_id,member_id,merchant,purchase_date,amount_cents,source,created_at) VALUES(cid,sid,cat,person,'Fictional '||cat_names[k]||' Shop '||i,'2026-09-01'::date+(i-1)*2,amt,'import',('2026-09-01'::date+(i-1)*2)::timestamptz+interval '12 hours') RETURNING id INTO tx1;
 IF k=1 AND i=1 THEN tx2:=tx1; END IF;
 END LOOP; END LOOP;
 INSERT INTO public.tasks(club_id,semester_id,category_id,title,notes,assignee_id,created_by,limit_cents,due_date,created_at)
 SELECT cid,sid,c.id,v.title,'FICTIONAL DEMO — no real purchase or payment.',m.id,me,v.lim,current_date+v.days,now()-interval '7 days' FROM (VALUES('Print flyers for speaker event','Supplies','Taylor Brooks',4000,-2),('Snacks for general meeting','Food','Riley Chen',6000,1),('Pizza for rush night','Food','Riley Chen',15000,3),('Bus deposit for Chicago trip','Travel','Morgan Lee',40000,5)) v(title,category,person,lim,days) JOIN public.categories c ON c.club_id=cid AND c.name=v.category JOIN public.members m ON m.club_id=cid AND m.name=v.person;
 SELECT id INTO cat FROM public.categories WHERE club_id=cid AND name='Food'; SELECT id INTO person FROM public.members WHERE club_id=cid AND name='Sam Rivera';
 INSERT INTO public.tasks(id,club_id,semester_id,category_id,title,notes,assignee_id,created_by,limit_cents,status,created_at,completed_at) VALUES(task1,cid,sid,cat,'Welcome meeting refreshments','FICTIONAL DEMO — receipt and reimbursement are examples only.',person,me,2000,'done','2026-08-27','2026-09-01');
 UPDATE public.transactions SET task_id=task1,member_id=person,source='receipt',receipt_path='demo/receipt.svg',ai_merchant=merchant,ai_date=purchase_date,ai_total_cents=amount_cents,ai_note='Fictional sample; no AI processing or real payment.',confirmed_by=person,confirmed_at='2026-09-01' WHERE id=tx2;
 INSERT INTO public.reimbursements(club_id,semester_id,member_id,task_id,transaction_id,category_id,merchant,purchase_date,amount_cents,reason,receipt_path,ai_total_cents,created_at) VALUES(cid,sid,person,task1,tx2,cat,'Fictional Food Shop 1','2026-09-01',1400,'FICTIONAL: refreshments paid out of pocket.','demo/receipt.svg',1400,now()-interval '3 days');
 SELECT id INTO cat FROM public.categories WHERE club_id=cid AND name='Supplies'; SELECT id INTO person FROM public.members WHERE club_id=cid AND name='Taylor Brooks';
 INSERT INTO public.tasks(id,club_id,semester_id,category_id,title,notes,assignee_id,created_by,limit_cents,status,created_at,completed_at) VALUES(task2,cid,sid,cat,'Prepare orientation materials','FICTIONAL DEMO — sample completed task.',person,me,15000,'done','2026-09-12','2026-09-19');
 SELECT id INTO tx1 FROM public.transactions WHERE club_id=cid AND category_id=cat AND amount_cents=12800 LIMIT 1;
 UPDATE public.transactions SET task_id=task2,member_id=person,source='receipt',receipt_path='demo/receipt.svg',ai_merchant=merchant,ai_date=purchase_date,ai_total_cents=amount_cents,ai_note='Fictional sample; no real payment.',confirmed_by=person,confirmed_at='2026-09-19' WHERE id=tx1;
 INSERT INTO public.flags(club_id,task_id,transaction_id,rule,severity,detail) VALUES(cid,task2,tx1,'over_category_budget','high','FICTIONAL DEMO: Supplies spending is $610.00 against a $600.00 budget.');
 PERFORM set_config('app.loading_demo','',true); RETURN cid;
END $function$;