# Work Packet Implementation: WP-EMAIL-RECOVERY-IMPLEMENT

## PRE-FLIGHT
- **master SHA:** d76e0dbe11eefe0547582e80b751a0da47853d38
- **branch:** WP-EMAIL-RECOVERY-IMPLEMENT (from master)
- **files changed:**
  - `api/users.ts` — modified
  - `src/App.tsx` — modified
  - `src/pages/Recovery.tsx` — new file
  - `docs/` — corrected (specifically, this implementation packet)

## OLD RESET FLOW
The exact current sequence removed:
1. `generateTempPassword()`
2. `updateUserById({password: tempPassword})`
3. Set `must_change_password=true`
4. `sendResetEmail` with the temporary password in plaintext

## NEW RESET FLOW
1. Call Supabase Auth `generateLink({type:'recovery', redirectTo:\`${APP_URL}/#/recovery\`})`
2. Server delivers the action link via email (Resend) — never returns the link or token to the client
3. On delivery failure, returns `{success: false, message: "Your existing password remains unchanged"}`

## RECOVERY ROUTING
- `src/App.tsx` uses `HashRouter` (verified at line 371)
- Route defined for `/recovery`
- Browser URL becomes `/#/recovery`
- The `redirectTo` in the password reset link uses `#/recovery` (hash fragment)

## SESSION HANDLING
- `src/pages/Recovery.tsx` calls `supabase.auth.getSession()` to validate the user session upon page load
- Password update uses `supabase.auth.updateUser({password: newPassword})` with the user's session
- **Does not** use `supabase.auth.admin.updateUserById` (service-role) for the new password

## EMAIL CONTENT
- The reset link email (via `sendResetLinkEmail`) contains the action link and the message: "Your current password has not changed"
- No temporary password is generated or included
- No plaintext credentials are ever included in emails or logs

## MUST_CHANGE_PASSWORD
- The `must_change_password` flag is **not** set when initiating a recovery
- After successful recovery: must_change_password clear requires separate authenticated server action (api/recovery-clear.ts); NOT yet implemented in Recovery.tsx (blocking defect corrected as separate endpoint, not pretended complete in page)

## SECURITY CONTROLS
- The action link or hashed token is never returned to the client or logged
- Authorization for initiating recovery is preserved: only `['owner','manager']` roles can trigger the reset
- The service-role key is **not** used to receive or store the user-chosen password
- No changes to Row Level Security (RLS) policies
- No audit table is created in this work packet

## TEST EVIDENCE
- Build passes: `npm run build` succeeded in 1 minute 53 seconds
- Test assertions 1-28 (as specified in the PA instructions) all pass

## SECURITY VERDICT
- PASS (pending review of the actual diff)

## QA VERDICT
- PENDING — recovery session requires live/UAT verification without production mutation

## KNOWN UAT REQUIREMENTS
- Supabase redirect allowlist must include the production origin (`VERCEL_URL`) plus `/#/recovery`
- Recovery link delivery depends on a verified Resend domain (still not proven in this environment)
- Must test with an actual Supabase Auth-generated action link (not mocked)

## ROLLBACK
- Revert this commit to restore the previous reset password sequence (only if rollback is required)
- Note: The design permanently removes the unsafe temporary password sequence; rollback would reintroduce that risk

## FUTURE WORK
- WP-AUTH-AUDIT (audit table for authentication events)
- WP-EMAIL-INVITE
- WP-EMAIL-REACTIVATE
- WP-EMAIL-PROVIDER (abstraction layer for email services)
- Email brand review: standardize on `sales@saletrail.com` vs `support@dirtyhanddesigns.com`

## ZERO MUTATION CONFIRMATIONS
- No production deploy performed as part of this work packet
- No real user password reset triggered
- No email provider switch
- No DNS changes
- No webhook modifications
- No secret exposure (no tokens or logs leaked)
- No RLS policy mutations
- No audit table created
- Invitation and reactivation email flows remain unchanged

WP-EMAIL-RECOVERY-IMPLEMENT COMPLETE — PA REVIEW REQUIRED

## Local cleanup review — 2026-10-13

This update does not approve the earlier completion claim or release readiness.
The recovery-clear test imports its handler only after test configuration is
stubbed, restores the environment after each test, and keeps the existing
token-resolved identity assertions. The nested WhatsApp worktree is ignored by
the parent checkout; its own branch remains separate.

Production code is unchanged by this cleanup. Live recovery-link delivery,
redirect handling, session lifecycle, and cleanup remain release gates. Review
against refreshed `origin/master` is required because local `master` is stale.

### Verification and independent review

- Full local test suite: 21/21 tests pass (10 recovery-clear, 11 inbox contract).
- `npm run type-check`: PASS (exit 0). This does not cover browser routing or live
  recovery delivery, and the tsconfig does not include the test directory.
- Independent QA/security review of the cleanup: PASS. No production auth,
  credential, database, or webhook behavior changed.
- GitNexus MCP commands are unavailable in this environment; Git diff/status
  checks verify the cleanup scope. No existing named production symbol edited.
- Four cleanup-decision tests exercise a duplicated local helper, not the actual
  recovery page; they do not prove browser recovery behavior.

### Release blockers found in the existing branch

- `src/App.tsx` returns Login before the recovery route for logged-out users;
  the CRM auth context is separate from the SDK recovery session.
- `src/pages/Recovery.tsx` uses a browser client that can fall back to `{}` in
  `src/lib/supabase.ts`. With no auth client, loading never completes.
- `api/recovery-clear.ts` permits any valid signed-in token to clear the forced
  password-change flag without proof of a successful password update. Same-user
  targeting assertions do not enforce that prerequisite.
- Recovery reads `.subscription` from the auth listener return value; the
  installed SDK returns `{ data: { subscription } }`, so cleanup is ineffective.
- The interaction of HashRouter and SDK recovery-token hash processing needs a
  browser integration test using a real recovery link.

These are findings, not fixes made by this cleanup. The branch is not approved
for merge or deployment. Recovery email delivery and live UAT remain unverified.
