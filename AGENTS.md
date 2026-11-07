<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Club Ledger rules
- Money is stored and computed as integer cents (helpers in src/lib/money.ts); never floats — avoids rounding errors.
- Club/role access is enforced in Postgres RLS via my_club_id()/is_exec()/my_member_id() security-definer helpers; UI checks are cosmetic only.
- task_guard trigger locks done/cancelled tasks, allows cancel only for execs, and blocks officer detail edits and post-receipt delegation, so rules hold for any client.
- Officer invites go through the inviteOfficer server fn (exec check, then admin invite); invitees land on /reset-password and claim_membership links them by email.

## Receipts
- Receipt reading runs in the readReceipt server fn (src/lib/receipt.functions.ts), not an edge function; AI output is re-validated in code (receipt-check.ts) and failures fall back to manual entry so the app works without AI.
- Audit flags are computed in SQL inside complete_task_with_receipt from confirmed values, so they can't be skipped by a client.
- Reimbursements are written only via security-definer RPCs (submit_reimbursement, complete_task_with_receipt_v2, decide_reimbursement, mark_reimbursement_paid); the table is SELECT-only for clients so status rules and budget transactions can't be bypassed. No bank/card data is ever stored.
- "Waiting >7 days" reimbursement flags are raised by flag_stale_reimbursements(), called when an exec opens the app (no scheduler).

## App emails
- Use the server-only managed sendTemplateEmail helper and React Email registry; delivery, retries, suppression, unsubscribe, and logs are managed by Lovable, so never create an email queue or email tables.
- Preserve /lovable/* middleware bypass and entities v4 aliases (modern decode/encode/escape subpaths before the root alias) so email previews and publishing resolve both modern and legacy parser imports.
