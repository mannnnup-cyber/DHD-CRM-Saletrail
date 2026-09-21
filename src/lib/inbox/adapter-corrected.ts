// Contact Resolution corrected: identity evidence separated from result
// Never invent match; 0 candidates -> unresolved; 1 verified -> matched; 1 unique authoritative normalized -> confident; >1 -> ambiguous
export interface IdentityEvidence { verifiedContactId?: string; normalizedIdentity?: string; candidateIds: string[]; }
export interface ContactResolutionOutcome { result: 'matched'|'confident'|'unresolved'|'ambiguous'; contact_id?: string; confidence?: 'high'|'medium'|'low'; method: string; evidence: IdentityEvidence; }
export function resolveContactCorrected(evidence: IdentityEvidence): ContactResolutionOutcome {
  if (evidence.candidateIds.length === 0) return { result: 'unresolved', confidence: 'low', method: 'unresolved', evidence };
  if (evidence.candidateIds.length > 1) return { result: 'ambiguous', confidence: 'low', method: 'ambiguous', evidence, resolution_notes: 'Multiple candidates - human review' };
  const c = evidence.candidateIds[0];
  if (evidence.verifiedContactId === c) return { result: 'matched', contact_id: c, confidence: 'high', method: 'direct_verified', evidence };
  if (evidence.normalizedIdentity && evidence.candidateIds.length === 1) return { result: 'confident', contact_id: c, confidence: 'medium', method: 'unique_normalized_authoritative', evidence };
  return { result: 'unresolved', confidence: 'low', method: 'unresolved', evidence };
}
