// Idempotency tests
import { deriveIdempotencyKey } from './types-corrected';
describe('Idempotency', () => {
  it('identical replay -> same key', () => expect(deriveIdempotencyKey('whatsapp', {providerEventId:'e1'}).key).toBe('e1'));
  it('distinct -> different keys', () => expect(deriveIdempotencyKey('whatsapp', {providerEventId:'e1'}).key).not.toBe(deriveIdempotencyKey('whatsapp', {providerEventId:'e2'}).key));
  it('same ts different msg -> different', () => {
    const a = deriveIdempotencyKey('whatsapp', {senderNormalized:'a', channel:'w', timestamp:'t', contentHash:'h1'});
    const b = deriveIdempotencyKey('whatsapp', {senderNormalized:'a', channel:'w', timestamp:'t', contentHash:'h2'});
    expect(a.safe).toBe(true); expect(b.safe).toBe(true); expect(a.key).not.toBe(b.key);
  });
  it('missing stable id + valid derived -> safe', () => expect(deriveIdempotencyKey('whatsapp', {senderNormalized:'s', channel:'w', timestamp:'t', contentHash:'h'}).safe).toBe(true));
  it('insufficient fallback -> explicit failure (key null)', () => expect(deriveIdempotencyKey('whatsapp', {}).safe).toBe(false));
});
// Contact resolution tests
describe('Contact Resolution', () => {
  it('direct verified -> matched', () => {
    const r = require('./adapter-corrected').resolveContactCorrected({verifiedContactId:'c1', normalizedIdentity:'e', candidateIds:['c1']});
    expect(r.result).toBe('matched'); expect(r.contact_id).toBe('c1');
  });
  it('unique authoritative normalized -> confident', () => {
    const r = require('./adapter-corrected').resolveContactCorrected({normalizedIdentity:'e', candidateIds:['c2']});
    expect(r.result).toBe('confident'); expect(r.contact_id).toBe('c2');
  });
  it('zero -> unresolved', () => expect(require('./adapter-corrected').resolveContactCorrected({candidateIds:[]}).result).toBe('unresolved'));
  it('multiple -> ambiguous', () => expect(require('./adapter-corrected').resolveContactCorrected({candidateIds:['c1','c2']}).result).toBe('ambiguous'));
  it('malformed -> unresolved (no fabricated match)', () => expect(require('./adapter-corrected').resolveContactCorrected({}).result).toBe('unresolved'));
});
