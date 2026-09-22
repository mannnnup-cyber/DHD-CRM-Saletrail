// Adapter boundary — projection over existing persistence; no new DB tables
import { CanonicalInteraction, ContactResolutionOutcome, IdempotencyResult } from './types';
export interface SourceAdapter {
  source: string;
  normalize(raw: unknown): CanonicalInteraction;
  resolveContact(raw: unknown): ContactResolutionOutcome;
  idempotencyKey(raw: unknown): IdempotencyResult;
}
// Source-specific deterministic idempotency strategies (documented fallback)
export const idempotencyStrategies: Record<string, (raw: Record<string, unknown>) => IdempotencyResult> = {
  evolution_whatsapp: (raw) => {
    if (raw.evolutionId) return { key: `evolution_whatsapp:${String(raw.evolutionId)}`, source: 'evolution_whatsapp', derivedFrom: ['evolutionId'], safe: true };
    if (raw.messageId && raw.timestamp) return { key: `evolution_whatsapp:wa-${String(raw.messageId)}-${String(raw.timestamp)}`, source: 'evolution_whatsapp', derivedFrom: ['messageId','timestamp'], safe: true };
    return { key: null, source: 'evolution_whatsapp', derivedFrom: [], safe: false };
  },
  email: (raw) => {
    if (raw.messageId) return { key: `email:${String(raw.messageId)}`, source: 'email', derivedFrom: ['messageId'], safe: true };
    return { key: null, source: 'email', derivedFrom: [], safe: false };
  },
  social: (raw) => {
    if (raw.externalId) return { key: `social:${String(raw.externalId)}`, source: 'social', derivedFrom: ['externalId'], safe: true };
    return { key: null, source: 'social', derivedFrom: [], safe: false };
  },
};
export function resolveContactCorrected(evidence: { verifiedContactId?: string; normalizedIdentity?: string; candidateIds?: string[] }): ContactResolutionOutcome {
  const candidates = evidence.candidateIds ?? [];
  if (candidates.length === 0) return { result: 'unresolved', confidence: 'low', method: 'unresolved', evidence: { candidateIds: [] }, resolution_notes: 'No authoritative candidates' };
  if (candidates.length > 1) return { result: 'ambiguous', confidence: 'low', method: 'ambiguous', evidence: { candidateIds: candidates }, resolution_notes: 'Multiple candidates - human review' };
  const c = candidates[0];
  if (evidence.verifiedContactId === c) return { result: 'matched', contact_id: c, confidence: 'high', method: 'direct_verified', evidence: { verifiedContactId: c, candidateIds: [c] } };
  if (evidence.normalizedIdentity && candidates.length === 1) return { result: 'confident', contact_id: c, confidence: 'medium', method: 'unique_normalized_authoritative', evidence: { normalizedIdentity: evidence.normalizedIdentity, candidateIds: [c] } };
  return { result: 'unresolved', confidence: 'low', method: 'unresolved', evidence: { candidateIds: [c] }, resolution_notes: 'Single candidate but identity unverified' };
}
