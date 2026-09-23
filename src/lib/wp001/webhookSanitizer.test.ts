import { describe, it, expect } from 'vitest';
import { sanitizeWebhookResponse } from './webhookSanitizer';

describe('WP-001 webhook sanitizer (pure, no network)', () => {
  it('top-level webhook config exposes allowed values', () => {
    const r = sanitizeWebhookResponse({
      url: 'https://dhd-crm-saletrail.vercel.app/api/whatsapp',
      enabled: true,
      events: ['MESSAGES_UPSERT'],
      webhookByEvents: false,
      webhookBase64: false,
    });
    expect(r.url).toEqual({ type: 'string', value: 'https://dhd-crm-saletrail.vercel.app/api/whatsapp' });
    expect(r.enabled).toEqual({ type: 'boolean', value: true });
    expect(r.events).toEqual({ type: 'array', value: ['MESSAGES_UPSERT'] });
  });

  it('nested webhook config exposes allowed values', () => {
    const r = sanitizeWebhookResponse({ webhook: { url: 'https://example/app', enabled: true, events: ['MESSAGES_UPSERT'] } });
    expect(r.url?.value).toBe('https://example/app');
    expect(r.enabled?.value).toBe(true);
  });

  it('null/missing fields return null type with no leaked value', () => {
    const r = sanitizeWebhookResponse({ url: 'x', events: null, webhookByEvents: null, unknown: 42 });
    expect(r.events?.type).toBe('null');
    // missing allowlisted fields simply absent from result — no leak
    expect(r.unknown?.type).toBe('number');
  });

  it('unknown non-secret fields expose structure and type only (full mode), not arbitrary values unless allowlisted', () => {
    const r = sanitizeWebhookResponse({ extraField: 'hello', url: 'https://x' }, 'full');
    expect(r.extraField?.type).toBe('string');
    // allowlist fields get real values
    expect(r.url?.value).toBe('https://x');
  });

  it('secret-like fields never expose values (redacted)', () => {
    const r = sanitizeWebhookResponse({ apikey: 'secret', url: 'https://x', token: 't', password: 'p' }, 'full');
    expect(r.apikey?.type).toBe('string');
    expect(r.apikey?.value).toBeUndefined();
    expect(r.token?.value).toBeUndefined();
    expect(r.password?.value).toBeUndefined();
    // allowed field intact
    expect(r.url?.value).toBe('https://x');
  });

  it('customer/message-like fields are redacted', () => {
    const r = sanitizeWebhookResponse({ from: '123@c.us', message: { body: 'hi' }, jid: 'jid', url: 'https://x' }, 'full');
    expect(r.from?.value).toBeUndefined();
    expect(r.message?.value).toBeUndefined();
    expect(r.jid?.value).toBeUndefined();
    expect(r.url?.value).toBe('https://x');
  });

  it('arrays only for events (explicit allowlist)', () => {
    const r = sanitizeWebhookResponse({ events: ['MESSAGES_UPSERT', 'CALL'] });
    expect(r.events?.type).toBe('array');
    expect(r.events?.value).toContain('MESSAGES_UPSERT');
  });

  it('structure mode returns only structure for non-allowlisted fields', () => {
    const r = sanitizeWebhookResponse({ url: 'https://x', unknown: true }, 'structure');
    expect(r.url?.value).toBeUndefined(); // structure only
    expect(r.unknown?.type).toBe('boolean');
  });
});
