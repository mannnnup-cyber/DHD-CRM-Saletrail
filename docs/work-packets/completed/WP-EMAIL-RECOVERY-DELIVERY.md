# Recovery email delivery repair — 2026-10-13

Status: Done. Branch: `fix/recovery-email-delivery`, from production merge
`3eea633`. Owner authorized deployment and real recovery email verification;
sender choice explicitly approved: `FollOps <no-reply@pickupja.com>`.

## Evidence

- Production reset request reaches token generation but reports delivery failure.
- Real recovery-token/password completion and login already verified on a
  dedicated normal test profile; existing users untouched.
- Stored Resend credential has only `pickupja.com` verified.
- Recovery mail currently hardcodes `support@dirtyhanddesigns.com` and reads
  only an environment key, unlike the existing email service's DB fallback.

## Authorized scope

- Recovery-only sender via `RECOVERY_FROM_EMAIL`, env first and app_settings
  fallback; configure the approved verified sender in that one setting.
- Recovery-only Resend key resolution: env first, saved app_settings fallback.
  Never rotate/change keys or alter unrelated send/invite/reactivate handlers.
- Sanitize delivery failure categories (missing config, invalid credentials,
  unverified sender, rejected/rate-limited/unavailable provider). Never log or
  return raw provider bodies, tokens, passwords, or keys.
- Preserve reset owner/manager permissions, token-hash construction, active
  target selection, and the already verified recovery completion contract.
- Recovery links must use the public canonical production origin, not the
  automatically generated `VERCEL_URL`, which may be protected by SSO. Use a
  trusted `RECOVERY_APP_URL` override with the known public app origin as default.
  Validate HTTPS and do not trust request Host/Origin or caller redirects.
- Tests for DB fallback, env precedence, approved sender, validation, failure
  redaction, role checks, and unchanged-password behavior.
- Tests/type-check/build + independent QA/Security before release through PR.
- Verify real delivery to the owner-approved test mailbox, then the existing
  temporary account's recovery flow. No extra privileged test account, RLS/DNS
  changes, credential mutation, or unrelated email behavior change.

## Implementation / verification

Implemented recovery-only key/sender resolution, sender validation, 15-second
provider timeout, safe failure categories, and trusted public recovery origin.
Other email helpers, keys, and global senders remain unchanged.

- Approved `RECOVERY_FROM_EMAIL` saved and read back successfully; only that
  nonsecret setting changed. Existing row state captured for scoped rollback.
- GitNexus refresh completed; helper has one API-handler caller (LOW indexed
  fanout); exact handler context inspected. MCP change detection unavailable;
  Git diff/status and independent review verify scope.
- Full suite: 65/65 PASS (30 delivery/initiation, 15 completion, 9 UI, 11 inbox).
- Type-check and production build PASS.
- Independent QA: PASS. Independent Security: PASS.
- Authorized direct-provider verification email: accepted (HTTP 200) with
  approved sender and canonical public app link. No link/token/password saved
  in reports, logs, or commits. This tests the provider, not the deployed
  application initiation route; user receipt/interaction is still pending.

Release through PR, then confirm the actual app's reset action and receipt.
Do not claim complete application email delivery from provider acceptance alone.

## Release closeout — 2026-10-13

- PR #4 merged; production merge `8661d7b` deployed successfully and CI passed.
- Owner received the direct provider verification email and confirmed its
  public-link password form completed recovery successfully.
- After deployment, owner retried the actual CRM Reset Password action and
  received its success message. A distinct provider record confirms the actual
  application email template delivered, with the approved sender and public
  CRM recovery link.
- Core release `3eea633` already passed live real-token completion, replay
  rejection, same-user flag cleanup, new-password login, and old-password denial.
- Temporary normal auth account/profile removed; absence verified. No existing
  user passwords/roles changed. Credentials, DNS, RLS, and global senders untouched.
- Full evidence is saved in the local user-facing password-recovery release
  report; no private test mailbox, token, or password is committed.
