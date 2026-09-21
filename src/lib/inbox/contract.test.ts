import { CanonicalInteraction, ContactResolutionOutcome } from './types';
import { resolveContactVerified, idempotencyStrategies } from './adapter';
describe('Contact Resolution (no invented match)', () => {
  it('returns matched when id + normalized present', () => {
    const r = resolveContactVerified({ id: 'c1', normalized: 'email@test' });
    expect(r.result).toBe('matched'); expect(r.contact_id).toBe('c1');
  });
  it('returns ambiguous when nothing verifiable', () => {
    const r = resolveContactVerified({});
    expect(r.result).toBe('ambiguous'); expect(r.method).toBe('ambiguous');
  });
});
describe('Idempotency (source-specific)', () => {
  it('uses evolutionId when stable', () => {
    expect(idempotencyStrategies.evolution_whatsapp({ evolutionId: 'e99' })).toBe('e99');
  });
  it('falls back only when stable absent', () => {
    expect(idempotencyStrategies.evolution_whatsapp({ ts: '2026-01-01' })).toContain('whatsapp-');
  });
});
