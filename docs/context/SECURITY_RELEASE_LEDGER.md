# Open security incidents and release blockers

Current2026-11-02. This public ledger intentionally omits credential values, private payloads and operational exploit recipes. Detailed restricted evidence is retained outside Git in the task's local audit artifacts.

| ID | State | Evidence boundary / next action |
|---|---|---|
| INC-001 historical credential disclosure/retention | OPEN / urgent | Historical disclosure path confirmed by source; current validity, access history and full old-deployment coverage unknown. Current raw-response projection/redaction retained. Restricted backup/archive metadata exists; a current recovery point and coordinated response require approval. |
| SEC-COMMS anonymous legacy communications | OPEN | Current source still has wider browser/message/media and machine endpoints outside the released settings/redaction boundaries. Establish legitimate staff scope before additional guards; no public customer payload tests. |
| SECURITY001C forwarding | LOCAL REVIEWED; published review-only | bb6bcbe implementation;4405878 publication guard.403tests/type/build and scoped independent review PASS. No merge/deploy or live command test. |
| Callback enforcement | BLOCKED | Dedicated provider header/registry delivery must be configured and verified before fail-closed release. Do not reuse provider keys or assume rejected events retry. |
| GSM authentication | BLOCKED | Compatible clients, authoritative device/user/organization/phone mapping and server command/ACK design needed. No bindings changed. |
| Call reliability | BLOCKED | Server duplicate-side-effect/ACK contract, native Gradle validation, backup/reinstall/uncertain outcome recovery and controlled device tests unresolved. Local receipts do not prove exactly-once external effects. |
| CONTACT view security | PENDING APPROVAL/VALIDATION | Prepared20261023205637_contact_review_view_security.sql not verified applied; fresh views lack intended invoker option. Current backup/restore and consumer/role acceptance must precede hosted change. |
| Content Studio database/publishing | BLOCKED | Required13tables/6functions absent in fresh catalog; write/AI gates remain default-off code policy, not a claim about hosted env inspection. |
| Woo repair release | BLOCKED | Draft conflict/schema/API/signed webhook and shared-identifier policy gates. Existing legacy tables are not proof repair migration exists. |

Do not drop these entries during functionality-first work. Closing an incident needs evidence beyond a code commit or CI success. No credential/provider/data/permission mutation was performed for reconciliation.
