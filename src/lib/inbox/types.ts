export type InteractionDirection = 'inbound' | 'outbound';
export type InteractionType = 'message' | 'call' | 'email' | 'task' | 'deal' | 'note';
export type ContactResolution = 'matched' | 'confident' | 'unresolved' | 'ambiguous';
export interface CanonicalInteraction {
  source: string;
  provider: string;
  provider_external_id?: string;
  contact_id?: string;
  direction: InteractionDirection;
  type: InteractionType;
  occurred_at: string;
  received_at?: string;
  content_ref?: string;
  media_refs?: string[];
  related_entity_type?: string;
  related_entity_id?: string;
  raw_source_ref?: string;
  metadata?: Record<string, unknown>;
  processing_state: 'pending' | 'normalized' | 'resolved' | 'rejected';
  idempotency_key: string;
  audit_ref?: string;
}
export interface ContactResolutionOutcome {
  result: ContactResolution;
  contact_id?: string;
  confidence?: 'high' | 'medium' | 'low';
  method: string;
  resolution_notes?: string;
  evidence?: { verifiedContactId?: string; normalizedIdentity?: string; candidateIds: string[] };
}
export interface IdempotencyResult { key: string | null; source: string; derivedFrom: string[]; safe: boolean; }
