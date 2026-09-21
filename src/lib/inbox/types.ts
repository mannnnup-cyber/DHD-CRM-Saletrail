// Canonical Interaction/Event Contract — WP-INBOX-CONTRACT (design/implementation; no DB change)
export type InteractionDirection = 'inbound' | 'outbound';
export type InteractionType = 'message' | 'call' | 'email' | 'task' | 'deal' | 'note';
export type ContactResolution = 'matched' | 'confident' | 'unresolved' | 'ambiguous';
export interface CanonicalInteraction {
  source: string;               // channel/source identifier
  provider: string;             // provider name (Evolution, Email, Social, etc.)
  provider_external_id?: string;
  contact_id?: string;          // nullable — resolved via Contact Resolution service
  direction: InteractionDirection;
  type: InteractionType;
  occurred_at: string;          // ISO datetime
  received_at?: string;
  content_ref?: string;         // reference to content storage (not raw content embedded)
  media_refs?: string[];
  related_entity_type?: string;
  related_entity_id?: string;
  raw_source_ref?: string;
  metadata?: Record<string, unknown>;
  processing_state: 'pending' | 'normalized' | 'resolved' | 'rejected';
  idempotency_key: string;      // source-specific deterministic key
  audit_ref?: string;           // provenance hash only (privacy-aware)
}
export interface ContactResolutionOutcome {
  result: ContactResolution;
  contact_id?: string;
  confidence?: 'high' | 'medium' | 'low';
  method: 'direct' | 'normalized_identity' | 'unresolved' | 'ambiguous';
  resolution_notes?: string;    // for ambiguous/human-review
}
