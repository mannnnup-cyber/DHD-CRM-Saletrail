# Work-packet state index —2026-11-02

Folder placement and old Done/Review labels are historical evidence, not a production acceptance state. Current authority: context/TASK_BOARD.md, context/INTEGRATION_STATUS.md and STATE-RECONCILIATION-2026-11-02.md. No packet or useful branch was deleted to tidy this inventory.

| Existing active packet | Reconciled interpretation |
|---|---|
| WP-WHATSAPP-LABELS-UNREAD | Source merged PR16; personal receipts/label behavior has bounded evidence. Production-wide label coverage and phone unread are not certified. Do not reimplement. |
| WP-WHATSAPP-UNREAD-IDENTIFIERS | Source merged PR17. Follow-up acceptance is separate; unsupported identities retain unknown state. |
| WP-WHATSAPP-SHARED-LABELS | Source merged PR18/19 including LID follow-up. Demand-read/gated writes are not all-conversation association proof. |
| WP-INBOX-FOUNDATION | Email and Social Inbox foundation code merged; full omnichannel and automatic mailbox collection remain separate. Reuse current APIs/UI. |
| WP-SEC-FOUNDATION | Historical authentication foundation exists; open incidents/legacy routes remain. No blanket security completion. |
| WP-MAINTENANCE-BASELINE | Historical implementation/baseline in master history; use current exact-source tests rather than assuming old checks apply. |
| WP-REBRAND | Historical implementation in master; live branding consistency not reverified. Do not infer a fresh feature release from folder status. |
| WP-ARCHITECTURE-REVIEW | Retain earlier planning evidence; current source/deployment reconciliation supersedes old status assumptions. |
| WP-001-whatsapp-webhook-failure | Historical diagnosis, not a current repair/deployment. Provider/host and authentication context changed; preserve as incident reference. |

New release candidates remain branch-qualified: forwarding001C in review/security-001c-forwarding, CONTACT001A in feat/contact-001a-secure-review, Content Studio in its feature branch, Woo in draftPR14, Android in the separate Companion local branch. Their local completed work-packet files do not authorize a merge, schema change, publication or device installation.
