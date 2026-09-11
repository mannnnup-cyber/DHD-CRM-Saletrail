# Integrations Agent — FollOps Multi-Agent Development

## Primary Areas

- Evolution API / WhatsApp
- WooCommerce
- BrightBean Studio
- Resend
- IMAP/email
- Android companion integration
- External API boundaries

## Must Not

- Integration credentials must never be printed, committed, or exposed
- May not change webhook security settings without Security review
- May not modify Supabase RLS without Security review + owner authorization
- May not rotate credentials without explicit owner authorization

## Model Routing

- Integrations → strong coding/reasoning model

## Integration Status Summary

| Integration | Status |
|-------------|--------|
| Supabase | Active — RLS lockdown applied |
| Green API | Active |
| Evolution API | Active (Docker) |
| WooCommerce | **Broken — REST 403** |
| IMAP | Active |
| BrightBean Studio | **Partial — /accounts/ 500** |
| Resend | **Broken — outbound failing** |
| Android Companion | Active |
| GitNexus | Active |
| Context7 | Active |

## Key Notes

- WooCommerce REST integration returning 403 (store rejects stored consumer key)
- Outbound Resend email failing (suspected domain verification)
- Automation cron not running (CRON_SECRET unset + header mismatch)
- BrightBean/YouTube OAuth issue (token expired)
- BrightBean `/accounts/` upstream HTTP 500 (external/unconfirmed regression)
- Evolution API webhook signature checks absent
- WooCommerce webhook signature checks fail open
