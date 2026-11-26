# WhatsApp label read recovery

Date: 2026-11-25 (America/Bogota).

Status: locally implemented, validated and independently reviewed. Not pushed, merged,
deployed or production-verified. Branch: `fix/whatsapp-label-read-recovery`.
Base: `4146af4ecca70a0fea46b43a2e9475a251727045`; remote master was rechecked on
November 25 and still matches that base.

## Confirmed defects and correction

- On narrow screens the selected conversation hides the sidebar containing the
  only label controls; returning to the list clears selection. A compact,
  mobile-only conversation panel now shares the existing hook/state/catalog.
  Desktop retains one visible label menu. No extra polling or provider writes
  are introduced.
- Unknown membership previously rendered the catalog with disabled unchecked
  assignment boxes. Unknown membership now has explicit guidance and catalog
  names without assignment checkboxes; a verified empty array still means no
  labels.
- The provider-read boundary now returns a bounded reason enum for missing exact
  chat, absent label data, identity mismatch, invalid response, timeout, limits
  and provider failure. Only exact provider JSON null means missing chat. Reasons
  carry no provider payload, message bodies, raw errors or credentials. The hook
  rejects unrecognized reasons and reasons attached to verified memberships.

## Preserved controls

Owner/manager authentication, exact requested conversation validation, bounded
reads/cache/response size, provider-origin and instance scope, mutation activation
gate, fresh pre-read, exact identity preflight, acknowledgement/readback and
uncertain-outcome safeguards are unchanged. Unknown memberships remain null and
cannot authorize a label mutation. No phone-number/name guessing, identity
auto-merging, staff assignment or alias-based label write was added. No migration,
environment-variable or hosted-setting change is required.

## Validation

- Affected suite: **79/79 PASS**, three files; includes labels, authorization,
  unread, inbox search, attachment and page regressions.
- Isolated API suite: **51/51 PASS**; overlaps the affected suite, not 51
  additional tests.
- TypeScript: **PASS** (`tsc --noEmit`, exit 0).
- Full suite: **465/465 PASS**, 29 files, serial run exit 0 (114.93 seconds).
- Production build: **PASS**, exit 0; 2,786 modules, 34.36 seconds.
- Rendered browser acceptance: **2/2 PASS** at mobile 390×844 and desktop
  1366×768. The expanded mobile label panel kept the composer bottom at 835 px
  within 844 px, with positive independently scrollable history height. Exact
  selected-chat forced read, unknown-without-checkboxes, open/close unsent-draft
  preservation, mobile back navigation and one visible desktop menu passed.
  Every API was intercepted; external network requests were blocked; no provider
  label write or phone read receipt occurred. These checks use synthetic data.
- Logs/results: workspace `artifacts/label-recovery/{targeted-tests.log,
  inbox-tests.log,full-tests.log,build.log,browser-run.log,browser-results.json}`;
  screenshots `mobile.png` and `desktop.png`. The artifact runner imports the
  committed browser assertions and reuses the existing synthetic F1 fixture.
- `git diff --check`: PASS.
- Independent QA: **PASS** on the final source and browser assertions; the
  expanded-panel geometry test gap was corrected before the passing browser run.
- Independent security: **PASS**, no blocking finding on the final application
  diff. Authorization, exact-target scope, sanitized reasons and fail-closed
  unknown/mutation behavior remain intact.

The implementation worker executed the test/build/browser commands; independent
reviewers reviewed the source, assertions and reported evidence. The counts above
are not a claim that reviewers separately reran every command.

Initial sandbox test startup was blocked by trusted esbuild child-process
`spawn EPERM`; the permitted local rerun outside that process sandbox ran the
synthetic tests. A parallel full run was interrupted without a valid final
summary. It is not test evidence and is superseded by the completed 465-test
serial pass. Cold jsdom initialization took 125 seconds in the completed affected
run. Build and browser validation then ran sequentially to avoid contention.

GitNexus impact for `WhatsApp` returned LOW, zero indexed upstream callers or
processes. The index could not resolve the newer label symbols; manual review
covered the inbox dispatcher, label handler/hook and page/component callers.
This is an index-coverage limitation, not proof of no impact.

## Live limitations and owner action

Earlier authorized read-only checks found no exact provider chat record for the
owner-specified PN identity or its explicit message-key alternate identity.
Missing stored memberships cannot safely be repaired by inferring a label from
a name or phone number. The phone-side remove-and-restore label resync test
remains unperformed; owner currently has no access to the business phone.

On November 25, the lead separately verified that the existing provider session
is closed with a logged-out/device-removed conflict reason, while the saved
callback remains configured. This patch does not repair a logged-out WhatsApp
session. Re-pairing needs the business phone and separately verified successful
delivery. Do not attribute removal to a particular actor without evidence.

No live customer label, contact, message, provider configuration or pairing was
changed by implementation/testing. Synthetic browser checks block external
requests and intercept every API response; they are not live-provider acceptance.

## Release and rollback

Retain a scoped local commit for owner review after the lead's final scope check.
Publication, merge and deployment need separate release
authorization. Production acceptance must verify mobile selected-chat controls,
read-only membership against the phone, no changes to other labels, exact target
identity, unread/search/history/composer behavior and fresh message delivery.
Any uncertain label write must stop further writes until phone/provider readback
is reconciled.

Rollback is a revert of this application-only patch; it needs no database or
provider rollback. It restores the earlier mobile-control limitation and less
specific unknown-state display. Never weaken identity or authorization guards
to make a provider lookup appear successful.
