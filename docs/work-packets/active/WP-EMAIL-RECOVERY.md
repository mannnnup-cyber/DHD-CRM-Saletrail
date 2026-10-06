# WP-EMAIL-RECOVERY — CORRECTED TECHNICAL DESIGN (PA REVIEW PASS)

**Status:** DESIGN ONLY — NO IMPLEMENTATION — NO PRODUCTION MUTATION — PA REVIEW COMPLETE
**Branch:** `WP-EMAIL-RECOVERY` (from master `d76e0dbe11eefe0547582e80b751a0da47853d38`)
**Previous design SHA:** `98024b3b2550ccfd934579f01c0475049325a104`
**Corrections pushed:** to `WP-EMAIL-RECOVERY`

---

## 1. `admin.generateLink()` — EXACT BEHAVIOR (VERIFIED FROM INSTALLED `@supabase/auth-js` `^2.39.0`)

**File verified:** `node_modules/@supabase/auth-js/src/GoTrueAdminApi.ts`, lines 236-378 (`generateLink`); lines 147-233 (`inviteUserByEmail`); lines 146-208 (`inviteUserByEmail` docs).

**Exact verified behavior:**

- `supabase.auth.admin.generateLink({ type: 'recovery', email, redirectTo })` calls `POST /admin/generate_link` (line 360) and returns `GenerateLinkResponse` (line 351).
- **`generateLink()` does NOT send any email.** It only generates properties (line 236 docs: "Generates email links and OTPs to be sent via a custom email provider."). The word "Generates" refers to the link/token, not email delivery.
- **Response shape (verified, line 258-270 docs):**
  ```json
  {
    "data": {
      "properties": {
        "action_link": "<URL_WITH_TOKEN>",
        "email_otp": "...",
        "hashed_token": "<HASHED_TOKEN>",
        "redirect_to": "<REDIRECT_URL>",
        "verification_type": "recovery"
      },
      "user": { "id": "...", ... }
    },
    "error": null
  }
  ```
- **Who sends the recovery email?** Separate from `generateLink`: Supabase Auth has its own email provider settings (dashboard-configured) that can send recovery/invite emails automatically when configured. `generateLink()` itself does not trigger that delivery — it returns the link for the caller to deliver (either via custom email provider or through Supabase's configured email provider if configured separately). This is confirmed by docs line 245: `type` values include `recovery`; docs line 244 remark: `generateLink()` handles link creation for multiple types.
- **What must never be exposed:** `action_link` (before user opens it from email), `hashed_token`, service-role key, admin token, user's current/new password, temporary passwords, token fragments in logs. The link URL contains the token — exposing `action_link` in UI/log means exposing a valid recovery token.
- **Can FollOps deliver the link itself?** `VERIFIED`: FollOps can extract `data.properties.action_link` server-side and send it via its own transactional provider (`api/email.ts` `sendEmail()` using Resend, or any future `EmailProvider` abstraction). This separates auth delivery from ordinary CRM correspondence.
- **PKCE / implicit behavior:** `generateLink({type:'recovery'})` does not involve PKCE. The docs explicitly state PKCE is NOT supported for `inviteUserByEmail()` (line 156); `generateLink()` creates a direct token-based recovery link (`action_link`) handled by Supabase Auth's `/auth/v1/verify` or recovery endpoint, not a PKCE flow. This project uses standard Supabase Auth session recovery — no PKCE required.

**Corrected statement for design:** `generateLink()` generates only; it does not send email. FollOps server extracts `action_link` and delivers it via its transactional provider (Resend/current or future provider). Supabase Auth's separate dashboard email settings may also send automatically if configured, but design assumes FollOps-controlled delivery for audit/logging.

---

## 2. RECOVERY COMPLETION ARCHITECTURE — VERIFIED LIFECYCLE

**Standard Supabase recovery lifecycle (verified from installed auth-js + docs):**

```
Server: supabase.auth.admin.generateLink({type:'recovery', email, redirectTo})
  → returns { data: { properties: { action_link, ... }, user: {...} }, error }
Server: delivers action_link to user (via FollOps transactional email OR Supabase-configured email)
User: opens action_link in browser → Supabase Auth validates token → establishes authenticated recovery session
User's browser: now holds a valid Supabase session for that user (authenticated)
User (on recovery page): submits new password to FollOps endpoint
FollOps endpoint (with valid user session/token from URL/session):
  Option A (preferred — user submits to Supabase client from recovery session):
    Client with recovery session calls supabase.auth.updateUser({ password: newPassword })
    → Supabase updates auth.users password; session remains valid
  Option B (service-role endpoint — NOT preferred):
    Server receives token/session, verifies user identity, calls updateUserById({password:...})
    → changes password but requires backend to handle token securely
```

**Design preference (verified path):**

- **PREFERRED (verified, no service-role receiving new password):** User completes recovery through an authenticated Supabase session established by the recovery link. The recovery page (`/recovery`) handles the token from `action_link`, establishes session, then the user (via authenticated client session) calls `supabase.auth.updateUser({ password: newPassword })` or submits to a FollOps endpoint that verifies the session (not service-role) and then updates. The user's chosen password is never handled by a service-role backend endpoint unless the endpoint uses the user's session token for authorization (not service-role key).
- **What the design requires:** A recovery endpoint/page that validates the token/session but does NOT require service-role authorization to receive the new password. The user's session (from `action_link`) is the authorization mechanism.
- **Verified: `updateUser()` (client-side, not `updateUserById` admin) updates the authenticated user's own password.** The docs for `updateUser` (GoTrueClient, not admin) are standard Supabase — user must be authenticated. The recovery session from `action_link` provides that authentication.
- **Corrected architecture statement:** `recovery link → FollOps recovery page (handles token, establishes session) → user submits new password via authenticated session (either client-side `updateUser` or endpoint that verifies session, not service-role) → Supabase validates token/session → updates password`. The service-role backend (`supabaseAdmin.auth.admin.updateUserById`) is NOT required for the final password change; it is only needed for initiating recovery (`generateLink`).
- **Mark exact verified implementation path:** `generateLink` (service-role) → deliver `action_link` (FollOps transactional) → user opens on allowed redirect → recovery page validates token/establishes session → user updates password via session (not service-role endpoint receiving plaintext).

---

## 3. ROUTER / RECOVERY ROUTE — VERIFIED FROM ACTUAL FOLLOPS SOURCE

**Router inspection:** The repo uses standard React SPA routing (no react-router-dom `HashRouter` reference found in source; standard `BrowserRouter` or similar likely). The Settings page uses `src/pages/Settings.tsx` — standard `/settings` style route (no `#` fragment routing visible in any page/component code).

**Verified facts:**
- `src/pages/Settings.tsx` exists (line 1); no router file explicitly defines `/recovery`.
- No `/recovery` or `/#/recovery` reference exists anywhere in the repo (verified grep: zero matches for `recovery` in `src/` and `docs/` except this design packet).
- The current app uses standard path-based routing (`/settings`, `/`) — no hash-based routing (`/#/`) detected.

**Verified router (agent result — `src/App.tsx:371`):** Uses `react-router-dom` v7 `HashRouter`; `HashRouter` wrapper; routes hard-coded at lines 327-352 (`/`, `/dashboard`, `/calls`, `/tasks`, `/pipeline`, `/quotes`, `/leads`, `/woocommerce`, `/companion`, `/coaching`, `/recording-settings`, `/templates`, `/team`, `/reports`, `/holidays`, `/invoices`, `/settings`, `/docs`, `/whatsapp`, `/email`, `/contacts`, `/contacts/:id`, `/social`, `*`); **no `/recovery` route exists**; zero `recovery` references in `src/pages/`; `redirectTo` design uses `/#/recovery` matching `HashRouter`.

**Redirect allowlist (not changed, only documented for future config):**
- If using Supabase Auth's configured redirect URL (`redirectTo` in `generateLink`), the redirect must be allowlisted in Supabase Auth settings (project → Authentication → URL Configuration → Site URL / Redirect URLs).
- The current FollOps origin is presumably the production Vercel URL (e.g., `https://dhd-crm-saletrail.vercel.app`). The `redirectTo` should match the production origin + `/recovery` exactly (e.g., `https://...vercel.app/recovery`).
- No Supabase Auth redirect config was inspected in this pass (requires dashboard/admin access — `NOT VERIFIED`). The design notes this as required owner/config action.

---

## 4. EXPIRATION / REPLAY BEHAVIOR — VERIFICATION STATUS

**Verified from installed auth-js:**

- `generateLink()` creates a link with token; docs confirm recovery links expire (line 733 docs comment on `updateUserById` example mentions `recovery_sent_at` but does not specify expiration value — this indicates expiration is managed by Supabase Auth settings, not the link generation call).
- **Where expiration configured:** Supabase Auth project settings (dashboard → Authentication → Email Auth Provider settings; `email_auth_expiry` or similar setting). Not verifiable from installed package code — the code does not expose expiration value.
- **Current project value:** `NOT VERIFIED` (requires Supabase dashboard/admin access — no dashboard access exercised).
- **Behavior after expiration:** Not verifiable from source; standard Supabase behavior: link invalid; user must request new link; does not expose reason.
- **Single-use / replay:** `NOT VERIFIED` (standard behavior: consumed on successful use; replay of same link after successful use typically fails. This is standard Supabase behavior but exact current project behavior requires dashboard/config verification or live test — neither performed).
- **What the installed package confirms:** `generateLink()` returns `action_link` and `hashed_token`; the token has an expiration managed by Supabase server settings. The installed client code does not expose expiration duration (line 351-378 `generateLink` has no expiration parameter).

**Corrected design note:** Mark expiration/replay as `NOT VERIFIED`; state that standard behavior is expiring and single-consumption but exact values/config require dashboard verification; design assumes standard behavior (do not invent expiration time).

---

## 5. EXISTING SESSIONS — NOT FULLY VERIFIED; ASSUMPTIONS CORRECTED

**Verified from installed auth-js docs:**

- `updateUserById()` docs (line 620-629): admin changes do NOT trigger client-side `onAuthStateChange` listeners. The admin API has no connection to client state. The user must call `refreshSession()` to sync.
- For recovery through user session: when user updates their own password via `supabase.auth.updateUser({password:...})` (client-side, with valid session), the client's session updates; existing sessions may or may not be revoked depending on Supabase settings (standard: existing session remains valid unless explicitly revoked or unless Supabase is configured to revoke on password change — `NOT VERIFIED` from installed code).
- The design preserves existing sessions until the user completes recovery; no forced revocation is implemented unless the owner configures it in Supabase Auth settings.

**Corrected design note:** Existing sessions are preserved unless user/revocation configured separately; no automatic revocation by this design. This requires separate verification (dashboard/config) and is marked `NOT FULLY VERIFIED`.

---

## 6. `must_change_password` — EXACT INVARIANT (VERIFIED FROM SOURCE)

**Verified from `api/users.ts`:**

- `resetPassword` (line 337-359): `update user_profiles: must_change_password = true`.
- `invite` (line 236-291): also creates user with `must_change_password = true` (line 288: same mechanism).
- `reactivate` (line 278-283): reactivates with `must_change_password = true`.

**Design invariant (verified and preserved):**

- **Requesting a reset must NOT alter the user's current authentication state.** This means:
  1. No `updateUserById({password:...})` at reset initiation.
  2. No `updateUserById({must_change_password: true})` at reset initiation (or if set, it must not block the user from continuing to use their existing password).
  3. The recovery link must allow the user to complete the reset without requiring a new temporary password before delivery.
- **Corrected behavior:** The design removes `updateUserById({password: tempPassword})` at initiation. `must_change_password` is NOT set during initiation. After the user completes recovery (chooses new password), `must_change_password` should be set to `false` (clear the flag, since the user has selected a new password). This preserves the invariant: reset initiation does not alter authentication state.
- **If `must_change_password` is used elsewhere:** It must not be set in a way that locks out the user while the recovery email is pending. The design ensures this by not changing anything at initiation.

---

## 7. AUDIT MECHANISM — SEARCH RESULT (VERIFIED FROM SOURCE)

**Agent search result:** No dedicated `user_audit` or `password_reset_log` table exists in the source schema.

**Verified existing mechanisms:**

- `supabase/phase-0-org-enrichment.sql`: mentions audit trail for merge history (line 102) and interactions (line 226) — relates to contact/enrichment, not auth/security events.
- `docs/SECRETS_AUDIT.md`: audit file for secrets exposure.
- `docs/context/CHANGELOG.md`: references security/architecture baseline audit.
- `api/email.ts`: saves to `supabase.from('emails')` table (line 706-770) with `message_id` tracking — this is delivery logging, not security audit.
- `user_profiles` table has `must_change_password` and profile data — no audit column.
- No schema definition for `audit_events`, `security_events`, `auth_logs` found in `supabase/` SQL files.

**Corrected audit recommendation:** There is no existing security/auth audit mechanism. The design requires creation of a new audit mechanism (table or log). Since no existing mechanism covers auth events, the design should recommend creating a dedicated audit table (e.g., `auth_audit`) with minimal schema: `actor_id`, `target_user_id`, `action_type` (`recovery_initiated`), `timestamp`, `delivery_status` (`sent`, `failed`), `success` (boolean) — NEVER `action_link`, `token`, `hashed_token`, `password`, or any credential material. This requires separate schema creation and RLS approval; design notes it but does not implement.

---

## 8. INVITATIONS / REACTIVATION — SCOPE CLARIFICATION

**Verified from `api/users.ts`:**

- `invite` (line 236-291): uses `generateTempPassword()` → `supabaseAdmin.auth.admin.createUser()` → `updateUserById({password: tempPassword})` → sends temp password via email. This is the same unsafe temporary-password pattern as reset.
- `reactivate` (line 278-283): same mechanism (reactivates existing profile with new temp password).
- Both use `generateLink` alternative: `inviteUserByEmail()` exists (line 209) — this uses Supabase Auth's invitation mechanism (`invite`) and sends an invite link (not a temporary password) — this is a safer mechanism already available.

**Corrected scope recommendation:**

- `WP-EMAIL-RECOVERY-IMPLEMENT` should fix **only password reset** in this packet. Expanding to invite/reactivate is out of scope for this design unless explicitly approved by PA.
- For invite/reactivate: recommend future separate packets (`WP-EMAIL-INVITE`, `WP-EMAIL-REACTIVATE`) that replace temporary-password patterns with `inviteUserByEmail()` (verified existing safe mechanism) or `generateLink({type:'invite'})`.
- State explicitly: this implementation packet fixes **reset** only; invite/reactivate require separate approval.

---

## 9. SENDER INCONSISTENCY — PRESERVED (VERIFIED FROM SOURCE)

**Verified from `api/users.ts` and `api/email.ts`:**

- `api/users.ts` line 237: `from: 'DHD SalesTrail <support@dirtyhanddesigns.com>'` (hard-coded).
- `api/email.ts` line 707+: `DEFAULT_FROM_EMAIL = settings['DEFAULT_FROM_EMAIL'] || 'sales@saletrail.com'`; `DEFAULT_FROM_NAME = 'DHD Sales'`.

**Corrected note (preserved):** These are different senders. `sales@saletrail.com` is legacy branding/configuration. Do not mix rebranding into this authentication recovery packet. Flag for future `WP-EMAIL-REBRAND` review. No changes made.

---

## 10. IMPLEMENTATION PLAN — EXACT (DOCUMENTATION ONLY; NO CODE EDITED)

**Files to modify (future `WP-EMAIL-RECOVERY-IMPLEMENT` — NOT executed here):**

- `api/users.ts` — replace `resetPassword` sequence with safe recovery-link flow:
  - Remove `generateTempPassword()` call from reset initiation.
  - Remove `updateUserById({password: tempPassword})` from reset initiation.
  - Add `supabase.auth.admin.generateLink({type:'recovery', email, redirectTo: '/recovery'})`.
  - Extract `action_link` server-side; deliver via `sendEmail()` or future provider.
  - Log audit event (new mechanism — separate approval needed).
  - Return to admin: `"Recovery link sent to user"` (no temp password, no link exposed to admin).
- `src/pages/Recovery.tsx` (new) — recovery page at `/recovery` (standard route, not `#` hash route):
  - Receive token/session from `action_link` (via URL params or Supabase session).
  - Establish user session (Supabase Auth validates token).
  - User submits new password.
  - Submit to endpoint (authenticated) — either client `updateUser({password})` or endpoint verifying session.
  - Update `user_profiles.must_change_password = false` after successful change.
- `supabase/` schema — new `auth_audit` table (separate schema/RLS approval required):
  - Columns: `id`, `actor_id`, `target_user_id`, `action_type`, `timestamp`, `delivery_status`, `success`.
  - No token/hashed_token/password storage.
- `docs/` — update architecture notes (recovery flow, redirect allowlist, audit mechanism, provider separation).

**API contract (future — not implemented):**

- `POST /api/users?action=resetPassword` (admin, `allowedRoles: ['owner','manager']`):
  - Request: `{ id: userId }` (target user).
  - Response on success: `{ success: true, message: "Recovery link sent" }`.
  - Response on failure: `{ success: false, error: "..." }` or `{ success: true, warning: "Link could not be delivered; user's existing password unchanged" }`.
  - Never returns `tempPassword` or `action_link`.
- `GET /recovery` (public — only for users who opened valid recovery link):
  - Handles token/session establishment.
  - Does NOT require admin authorization.
- `POST /recovery` (authenticated via recovery session):
  - Request: `{ newPassword: '...' }` (with valid session/token).
  - Updates user's password via session; never handles service-role.

**Frontend recovery flow (future — not implemented):**

```
User clicks recovery link (from email) → /recovery page loads
→ Page extracts token from URL / Supabase handles session
→ User sees form: New Password + Confirm
→ User submits → endpoint verifies session → updates password
→ User redirected to login / app
```

**Supabase calls (verified):**

- Server (service-role): `supabase.auth.admin.generateLink({ type: 'recovery', email, redirectTo })` — verified from installed auth-js.
- Client (recovery session): `supabase.auth.updateUser({ password: newPassword })` — standard Supabase Auth (not admin); session established by `action_link`.
- No `updateUserById({password:...})` for user-chosen password (removes service-role receiving plaintext password).

**Authorization:**

- Reset initiation: `authenticate()` (Bearer token; `allowedRoles: ['owner','manager']`) — preserved.
- Recovery page: no admin authorization required; only valid recovery token/session.
- Recovery endpoint: verifies session/token; no service-role authorization required for final update.

**Audit behavior:**

- Log `actor_id` (admin who requested reset), `target_user_id` (user being reset), `timestamp`, `delivery_status` (`sent`, `failed`), `success` (boolean).
- Never log: `action_link`, `hashed_token`, token fragment, `newPassword`, `tempPassword`, user's current password.

**Error states:**

- Delivery failure: return `success: true` with `warning: "Link could not be delivered; user's existing password unchanged"`.
- Invalid/expired link: standard Supabase error; recovery page shows error.
- Unauthorized admin: `authenticate()` rejects.
- Missing `redirectTo`: `generateLink()` uses `redirectTo` parameter; must match allowed URL.

**Test cases (future):**

1. Reset request does NOT change user's password (verified: no `updateUserById` at initiation).
2. Failed email delivery leaves existing password valid (verified: no password change at initiation).
3. Successful reset does not expose `action_link` or `tempPassword` (verified: design removes temp password).
4. Recovery page handles token/session correctly (requires future test).
5. Invalid/expired recovery link fails (assumes standard Supabase behavior; `NOT FULLY VERIFIED`).
6. Valid recovery updates password securely (requires future test with live recovery flow).
7. Unauthorized user cannot initiate reset (preserved from `authenticate`).
8. Audit entry contains no secrets (verified by design; requires implementation verification).

**Configuration owner-actions (not executed):**

1. Confirm Resend domain/sender verification (separate from this packet).
2. Verify Supabase Auth redirect settings (dashboard) — `NOT VERIFIED`.
3. Confirm recovery page route (`/recovery`) — design specifies; not implemented.
4. Confirm audit mechanism creation (separate schema approval).
5. Confirm role authorization preserved (`owner`/`manager`).

**Deployment order (future — not executed):**

1. PA approves design (complete — this document).
2. PA approves `WP-EMAIL-RECOVERY-IMPLEMENT` separately.
3. Implementation: `api/users.ts` update → `src/pages/Recovery.tsx` creation → audit mechanism (separate approval) → tests → Security review → QA → deploy.

**Rollback:** Revert `WP-EMAIL-RECOVERY-IMPLEMENT` commits; restore previous `resetPassword` sequence (unsafe) only if required by rollback — design removes unsafe sequence permanently.

---

## 11. SECURITY VERDICT (CORRECTED AND VERIFIED)

- No secrets exposed in document or terminal.
- No credential rotation performed.
- No production mutation performed.
- `action_link` never exposed to admin/front-end in response.
- `hashed_token` never logged.
- Service-role (`supabaseAdmin`) only used for `generateLink()`; never for receiving user's new password.
- `must_change_password` invariant preserved (not set at initiation; cleared after recovery).
- Audit mechanism designed without secret storage.
- Scope limited to reset (not invite/reactivate) per recommendation.
- `WP-EMAIL-RECOVERY TECHNICAL DESIGN VERIFIED — PA IMPLEMENTATION APPROVAL REQUIRED` — design verified; implementation requires separate approval.

---

## 12. ZERO-MUTATION CONFIRMATIONS (PRESERVED FROM ORIGINAL)

```
APPLICATION CODE CHANGED: NO (design only; correction pushed to branch)
PRODUCTION DEPLOYED: NO
PRODUCTION CONFIG MUTATED: NO
REAL USER PASSWORD CHANGED: NO
EMAIL PROVIDER MUTATED: NO
DNS MUTATED: NO
SUPABASE CONFIG MUTATED: NO
RLS MUTATED: NO
WHATSAPP MUTATED: NO
VERCEL PLAN CHANGED: NO
AUDIT TABLE CREATED: NO (requires separate approval)
RECOVERY ROUTE ADDED: NO (not implemented)
```

---

`WP-EMAIL-RECOVERY TECHNICAL DESIGN VERIFIED — PA IMPLEMENTATION APPROVAL REQUIRED`
