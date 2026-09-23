import { idempotencyStrategies, resolveContactCorrected } from './adapter';
describe('Idempotency', () => {
  it('identical provider event replay -> same key', () => {
    const a = idempotencyStrategies.evolution_whatsapp({ evolutionId: 'e1' });
    const b = idempotencyStrategies.evolution_whatsapp({ evolutionId: 'e1' });
    expect(a.key).toBe('evolution_whatsapp:e1'); expect(a.key).toBe(b.key);
  });
  it('distinct events -> different keys', () => {
    expect(idempotencyStrategies.evolution_whatsapp({ evolutionId: 'e1' }).key).not.toBe(idempotencyStrategies.evolution_whatsapp({ evolutionId: 'e2' }).key);
  });
  it('same timestamp different messages -> different keys', () => {
    const a = idempotencyStrategies.evolution_whatsapp({ messageId: 'm1', timestamp: 't' });
    const b = idempotencyStrategies.evolution_whatsapp({ messageId: 'm2', timestamp: 't' });
    expect(a.key).not.toBe(b.key);
  });
  it('missing stable provider ID with valid deterministic fallback -> safe', () => {
    const r = idempotencyStrategies.evolution_whatsapp({ messageId: 'm1', timestamp: 't' });
    expect(r.safe).toBe(true); expect(r.key).toContain('wa-');
  });
  it('insufficient fallback material -> explicit failure (key null, safe false)', () => {
    const r = idempotencyStrategies.evolution_whatsapp({});
    expect(r.safe).toBe(false); expect(r.key).toBeNull();
  });
  it('same stable external ID X across all three sources -> all keys differ', () => {
    const w = idempotencyStrategies.evolution_whatsapp({ evolutionId: 'X' });
    const e = idempotencyStrategies.email({ messageId: 'X' });
    const s = idempotencyStrategies.social({ externalId: 'X' });
    expect(w.key).not.toBe(e.key);
    expect(e.key).not.toBe(s.key);
    expect(w.key).not.toBe(s.key);
    expect(w.key).toBe('evolution_whatsapp:X');
    expect(e.key).toBe('email:X');
    expect(s.key).toBe('social:X');
  });
});
describe('Contact Resolution', () => {
  it('direct verified contact ID -> matched', () => {
    const r = resolveContactCorrected({ verifiedContactId: 'c1', candidateIds: ['c1'] });
    expect(r.result).toBe('matched'); expect(r.contact_id).toBe('c1');
  });
  it('unique authoritative normalized -> confident', () => {
    const r = resolveContactCorrected({ normalizedIdentity: 'x@y', candidateIds: ['c2'] });
    expect(r.result).toBe('confident'); expect(r.contact_id).toBe('c2');
  });
  it('zero candidates -> unresolved', () => {
    const r = resolveContactCorrected({ candidateIds: [] });
    expect(r.result).toBe('unresolved');
  });
  it('multiple candidates -> ambiguous', () => {
    const r = resolveContactCorrected({ candidateIds: ['c1', 'c2'] });
    expect(r.result).toBe('ambiguous');
  });
  it('malformed/absent candidateIds -> unresolved (no throw)', () => {
    const r = resolveContactCorrected({});
    expect(r.result).toBe('unresolved');
  });
});
// WP-001 diagnostic: webhookInfo response mapping — non-secret fields only (PA-approved)
describe('WP-001 webhookInfo diagnostic mapping', () => {
  it('maps Evolution webhook config fields safely (enabled/events/webhookByEvents/webhookBase64)', () => {
    const evolutionRaw = { url: 'https://example/app', enabled: true, events: ['MESSAGES_UPSERT'], webhookByEvents: false, webhookBase64: false, webhook: { url: 'https://example/app', enabled: true, events: ['MESSAGES_UPSERT'] } };
    const currentUrl = evolutionRaw.url || evolutionRaw.webhook?.url || '';
    const result = {
      success: true, configured: !!currentUrl, url: currentUrl, webhookUrl: 'https://prod/app', lastMessageAt: '2026-09-05',
      enabled: evolutionRaw.enabled ?? evolutionRaw.webhook?.enabled ?? null,
      events: evolutionRaw.events ?? evolutionRaw.webhook?.events ?? null,
      webhookByEvents: evolutionRaw.webhookByEvents ?? (evolutionRaw as any).webhook?.webhookByEvents ?? null,
      webhookBase64: evolutionRaw.webhookBase64 ?? (evolutionRaw as any).webhook?.webhookBase64 ?? null,
    };
    expect(result.success).toBe(true);
    expect(result.configured).toBe(true);
    expect(result.url).toBe('https://example/app');
    expect(result.enabled).toBe(true);
    expect(result.events).toContain('MESSAGES_UPSERT');
    expect(result.webhookByEvents).toBe(false);
    expect(result.webhookBase64).toBe(false);
    // No secret material exposed
    expect(JSON.stringify(result)).not.toMatch(/apikey|token|secret|jwt/i);
  });
});
