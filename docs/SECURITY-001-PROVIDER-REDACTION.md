# SECURITY-001 independent redaction slice

Date: 2026-11-01 (America/Bogota). **Local verification COMPLETE; selected redaction candidate READY for owner review only.**

Branch fix/security-001-provider-redaction, isolated from production544ac0ed669dd7a5e1a9eea99cbcf49f6d329916. This independently testable slice prevents future provider control-plane credentials from being stored in raw envelope fields and removes private variable log/error details. It deliberately does not activate new callback, companion or recording authorization gates.

## Boundary

Provider webhook envelopes in pinned Evolution2.3.7 include admin apikey alongside event/data. Read-only hosted aggregates found recent raw rows containing that field, without selecting values. A pure bounded projection removes named credential/header/cookie and unsafe prototype keys recursively before new raw persistence, retaining the intended event/message data. Actual message content is not scrubbed for arbitrary strings. Existing historical rows, contacts, identities and relationships are not rewritten.

WhatsApp/recording log and error projections become fixed credential-free events/messages instead of raw provider/database exceptions or customer payloads. Returned success shapes and existing ingestion/send/media/machine/recording operational contracts otherwise remain the production baseline. Existing001A settings authorization, secret masking, bounded saves, caller token behavior and administrative-key forwarding protection remain unchanged.

No environment variable, credential registry, callback header, device/client update, organization binding, Storage provisioning, SQL, dependency or deployment-configuration change is required by this redaction slice. No callback or command/machine guard from the prerequisite-dependent branch is imported.

## Residual risk

This is not full SECURITY-001 containment: legacy anonymous browser communications and callback/companion/recording routes remain. Historical raw credential exposure and currently stored error records are not repaired. Credential rotation and forensic/usage review remain separately authorized work. No replay ledger, durable delivery lifecycle, PN/LID/contact resolution fix or production media initialization repair is claimed.

Redaction here covers future provider envelope fields, variable logs and selected immediate error responses. Baseline transcription processing can still persist raw err.message in recording/transcription error metadata, and the legacy public recording list selects complete rows. This slice does not certify those historical/future error fields or private recording data as safe. The blocked enforcement packet separately redacts future transcription-error persistence and guards browser recording routes. The baseline anonymous500MiB recording parser also remains unchanged here; no recording security/recovery completion is claimed.

## Future release and acceptance

Owner/PA reviews the exact local commit and independent QA/security evidence before any push. Reconcile current master; verify webhook641005278 inactive and native master production integration; publish via reviewed PR and native Git build only after separate authorization. Existing callback/device settings must remain unchanged. Use controlled synthetic handler tests for positive ingestion/error paths, never real customer payloads, test sends or fake live callbacks.

After separately authorized deployment, verify exact production commit,001A anonymous/lower-role denial, owner settings presentation, provider open plus passive fresh reception/persistence and genuine device activity. Compare only redacted metadata. Validate that newly stored synthetic envelope fields omit secrets in an authorized isolated fixture. A passive sample does not certify every provider/device path.

For regression, retain001A guards and favor a narrowly reviewed forward fix. Reverting this slice to544ac0e retains001A but restores verbose logs/future raw-envelope credentials; it is not the preferred security rollback. Do not promote the older uncontained b3b55c8. No database migration exists to undo. No credential/provider/device/Storage change is part of this slice.

## Evidence

Frozen source passed 375 tests, including actual-handler sentinel, native emitted runtime, scope and integration regression checks. TypeScript and production build PASS. Independent QA and security source reviews PASS; normalized source/test hashes match the final review manifest. Application files are api/whatsapp.ts, api/recordings.ts and src/lib/integrations/provider-projection.ts. Tests are provider-redaction.test.ts, provider-redaction-runtime.test.ts and settings-scope.test.ts. Documentation/context files complete the patch. Secret/scope and staged-file checks precede the local commit; its identity is reported in the final handoff. Local readiness never establishes full communications recovery or authorizes deployment. See the separate SECURITY-001-FINAL-READINESS.md on the blocked full branch for enrollment requirements and live read-only findings.
