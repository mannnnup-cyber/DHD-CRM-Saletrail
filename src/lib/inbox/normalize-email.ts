import type { CanonicalInteraction, ContactResolutionOutcome } from './types';
import { resolveContactCorrected } from './adapter';
import { messagingIdentity } from './email';
export type InboxEvent = { kind: 'message'; channel: 'email'; interaction: CanonicalInteraction; resolution: ContactResolutionOutcome }
  | { kind: 'business'; type: 'call' | 'task' | 'deal' | 'note'; entityId: string };
export function normalizeEmailMessage(input: unknown): { ok: true; event: InboxEvent } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Invalid email fixture.' };
  const row = input as Record<string, any>;
  const identity = messagingIdentity(row);
  if (!identity || row.type !== 'email' || !['inbound', 'outbound'].includes(row.direction) || typeof row.occurredAt !== 'string' || row.occurredAt.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(row.occurredAt) || !Number.isFinite(Date.parse(row.occurredAt))) return { ok: false, error: 'Email identity, direction, type and timestamp are required.' };
  const evidence = row.evidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || !Array.isArray(evidence.candidateIds) || evidence.candidateIds.length > 20 || evidence.candidateIds.some((id: unknown) => typeof id !== 'string' || !id || id.length > 128) ||
      (evidence.verifiedContactId !== undefined && (typeof evidence.verifiedContactId !== 'string' || !evidence.verifiedContactId.trim() || evidence.verifiedContactId.length > 128 || /[\x00-\x1f\x7f]/.test(evidence.verifiedContactId))) ||
      (evidence.normalizedIdentity !== undefined && (typeof evidence.normalizedIdentity !== 'string' || !evidence.normalizedIdentity.trim() || evidence.normalizedIdentity.length > 500 || /[\x00-\x1f\x7f]/.test(evidence.normalizedIdentity)))) return { ok: false, error: 'Authoritative resolution evidence is required.' };
  const resolution = resolveContactCorrected({ candidateIds: [...new Set<string>(evidence.candidateIds)], verifiedContactId: evidence.verifiedContactId, normalizedIdentity: evidence.normalizedIdentity });
  return { ok: true, event: { kind: 'message', channel: 'email', resolution, interaction: {
    source: 'email', provider: row.provider, provider_external_id: row.externalId, direction: row.direction, type: 'email', occurred_at: new Date(row.occurredAt).toISOString(),
    idempotency_key: identity, processing_state: resolution.contact_id ? 'resolved' : 'normalized', ...(resolution.contact_id ? { contact_id: resolution.contact_id } : {})
  } } };
}
