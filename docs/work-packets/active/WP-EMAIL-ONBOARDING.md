# Account invitation and reactivation setup links — 2026-10-14

Status: In Progress. Branch: fix/account-setup-email, isolated from origin/master 9502f46.
Owner authorized replacing credential emails and preserving existing recovery behavior.

## Design and scope

Provision new or deleted inactive Auth identities without any password, using a
modern-secret request-scoped admin client. Recreate deleted identities using the
same stored UUID and verify the returned UUID. If an inactive Auth identity still
exists, fail closed instead of reusing an old credential or changing its password.
Managers may invite/reactivate reps only; owners may assign supported roles.
Check both submitted role and stored role before reactivating or retrying a
privileged profile. Never trust user_metadata roles.

Generate a fixed recovery-type one-time token for the identity, verify the
returned user ID, and deliver a custom setup email using the proven configured
sender/key and public canonical origin. Reuse the existing recovery completion
endpoint without accepting a caller-selected OTP type. The setup URL marker
only changes the form presentation; token verification remains recovery.

Active profiles pending must_change_password may receive fresh links on retry;
resending never changes their stored name or role. Delivery failure reports
pending delivery honestly and leaves a recoverable passwordless account.
No plaintext temporary passwords in invitation/reactivation email or response.
Keep existing setup-owner, self-service password change, reset authorization,
private profile linking, and deferred credential-remediation scope unchanged.

## Verification and release gates

Actual handler tests for permissions/role escalation, new invite, duplicate active
account, delivery failure and retry, same UUID reactivation, mismatched Auth/link
identity, provider error redaction, and missing modern secret. Actual recovery
completion replay and UI presentation tests; full tests/type-check/build.
GitNexus impacts before symbol edits. Independent QA and Security mandatory.
No production mutations, email sends, RLS changes, credential rotation, or
deployment during implementation. Parent coordinates release after review.

## Implementation evidence (local)

- New account: Auth identity has no password; pending active CRM profile with
  must_change_password:true; generated recovery hash delivered as setup link.
- Reactivation: recreate deleted Auth user with the historical profile UUID;
  retain that UUID. Existing inactive Auth identity fails closed for support.
- Exact case-insensitive email lookup escapes ILIKE wildcard characters and
  rejects ambiguous/mismatched identity. Managers cannot grant or revive
  privileged roles, including by downgrading the submitted role.
- Retry pending active invitation without changing its stored name/role.
  Response explicitly distinguishes account provisioned from email delivery.
- Approved recovery sender/key configuration intentionally reused for setup;
  onboarding passes its modern-secret request-scoped client for settings reads.
- Public form setup marker is presentation only; fixed recovery OTP contract
  and completion/replay authorization are unchanged.
- Settings shows secure links rather than nonexistent temporary credentials.
- Full local suite: 87 tests pass. Type-check and build passed before the final
  exact-email refinement; final type-check follows. Build source UI unchanged
  by that API-only refinement. No packages added.
- GitNexus fresh index at 9502f46: helper impacts LOW, invite/reactivate helper
  direct callers users.handler; Recovery/Settings indexed caller count zero.
  Handler name ambiguity handled by exact file context. Functional auth risk
  HIGH requires independent QA/Security. detect_changes has no CLI command or
  exposed MCP tool; use reviewed git diff/status and diff-check before commit.
- Rebased onto origin/master d164c14; Inbox documentation merged upstream is
  preserved. Independent reviews, commit, deployment and live onboarding UAT
  remain pending. No production mutations or outbound messages performed.


## Independent verification / release snapshot

Independent QA: PASS. Full 87-test suite, type-check, production build, and
scope/diff checks passed against the final implementation. The only subsequent
UI edit corrects reset confirmation wording: sending a reset link leaves the
existing password unchanged until the recipient uses it.

Parent hosted synthetic verification: PASS. A dedicated passwordless Auth user
created with an explicit UUID completed a real generated recovery token through
the already deployed, unchanged completion endpoint; replay was rejected and
login/profile flag verified. Deleting Auth and recreating the same historical
UUID also passed completion/replay/login. Dedicated temporary Auth and profile
records were removed and removal verified by the parent. This proves hosted
passwordless/recovery compatibility; it does not exercise the new invitation
handler, actual setup-email delivery, or owner/manager button.

Independent Security review remains pending at this snapshot. No invitation
emails or new handler deployment performed. Live invite/reactivate button,
delivery and recipient completion remain release verification gates.
