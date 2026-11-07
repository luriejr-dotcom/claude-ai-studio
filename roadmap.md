# Club Ledger roadmap
## Visual redesign
- [x] Restore the original swipe-style top with restrained red accents; verified swipe/arrow navigation and 375/808/1280px layouts
- [x] Refine tokens, navigation, login and finance screens without changing functionality
- [x] Verify signed-in screens, forms, light/dark themes and phone layouts; list edited files
## Reimbursement approval and repayment preferences
- [x] Fix approval rejecting reimbursement-sourced purchases; verified signed-in approval of the reported request
- [x] Save and display preferred repayment methods for standalone and task requests; selector and method tests passed
## Demo and polish
- [x] Exec-only empty-club demo loader and demo-only reset with fictional people, Fall 2026 budget, 40 purchases, open/past tasks and a waiting reimbursement
- [x] Phone layouts without horizontal overflow, in-app dialogs and loading skeletons
- [x] Inspect officer URL/data restrictions; hide category budgets at the database boundary
- [x] Full demo load verified through the shared demo account; fixed the loader's ambiguous column reference that made every load fail
- [x] Officer signed-in restrictions checked at the database boundary (category budgets masked to officers)
## Shared demo login and published URL
- [x] Shared demo account demo@clubledge.app (confirmed, no emails sent) loads Demo Business Club (demo) via the Load demo data button
- [x] Published at https://clubledge.lovable.app

- [x] Login, club creation, officer invites
- [x] Tasks screen (add, complete, delegate, details)
- [x] Budget screen (hero, ring, categories, flags, edit budget)
- [x] Transactions screen (filters, side panel, CSV export)
- [x] Receipt photo upload + Claude reading receipts into transactions
- [x] Flag rules generating flags from transactions
- [x] Task checkbox opens receipt step; finishing only via backend receipt confirmation
- [x] Claude reads receipt, confirm step, AI-vs-confirmed audit trail, audit flags

## Email notifications (sending waits for DNS verification)
- [x] Configure sender domain and managed email sending infrastructure
- [ ] Verify sender domain DNS (external verification pending)
- [ ] Wire notifications: assignment/delegation, due-tomorrow/overdue (daily 9am ET), receipt-ready, flagged completion, reimbursement new/approved/denied/paid
- [ ] Weekly exec summary (Mondays 9am ET)
- [ ] Exec messages on tasks/reimbursements (emailed + timeline), one-tap Remind (1/day)
- [ ] Notifications settings page (per-type switches, default on), link in every email
- [ ] Email log visible to execs
