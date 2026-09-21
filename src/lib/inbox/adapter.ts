// Adapter boundary — projection over existing persistence (no new DB tables)
import { CanonicalInteraction, ContactResolutionOutcome } from './types';
export interface SourceAdapter {
  source: string;
  normalize(raw: unknown): CanonicalInteraction;
  resolveContact(raw: unknown): ContactResolutionOutcome;
  idempotencyKey(raw: unknown): string; // source-specific deterministic
}
// Deterministic strategies per source (documented; stable IDs preferred)
export const idempotencyStrategies = {
  evolution_whatsapp: (raw: { evolutionId?: string; messageId?: string; ts?: string }) =>
    raw.evolutionId || raw.messageId || `whatsapp-${raw.ts}`,
  email: (raw: { messageId?: string; emailId?: string }) =>
    raw.messageId || raw.emailId || `email-fallback`,
  social: (raw: { externalId?: string }) => raw.externalId || `social-fallback`,
};
export function resolveContactVerified(contactData: { id?: string; normalized?: string }): ContactResolutionOutcome {
  // Never invent match — only return verified outcomes
  if (contactData.id && contactData.normalized) return { result: 'matched', contact_id: contactData.id, confidence: 'high', method: 'direct' };
  if (contactData.normalized) return { result: 'confident', contact_id: undefined, confidence: 'medium', method: 'normalized_identity' };
  if (contactData.id) return { result: 'unresolved', contact_id: contactData.id, confidence: 'low', method: 'unresolved' };
  return { result: 'ambiguous', confidence: 'low', method: 'ambiguous', resolution_notes: 'Requires human review' };
}
