# Club Ledger roadmap
## Demo and polish
- [ ] Exec-only empty-club demo loader and demo-only reset with fictional people, Fall 2026 budget, 40 purchases, open/past tasks and a waiting reimbursement
- [ ] Phone layouts without horizontal overflow, in-app dialogs and loading skeletons
- [ ] Verify officer URL/data restrictions and demo flow

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
- [ ] Assignment/delegation, due-tomorrow/overdue (daily 9am ET), receipt-ready, flagged completion, reimbursement new/approved/denied/paid emails
- [ ] Weekly exec summary (Mondays 9am ET)
- [ ] Exec messages on tasks/reimbursements (emailed + timeline), one-tap Remind (1/day)
- [ ] Notifications settings page (per-type switches, default on), link in every email
- [ ] Email log visible to execs
