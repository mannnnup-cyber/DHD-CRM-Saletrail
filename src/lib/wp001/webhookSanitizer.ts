/**
 * WP-001 sanitized webhook response-shape diagnostic.
 * Pure function — no network, no secrets, production response only.
 * Allows only non-secret webhook config fields; redacts everything else.
 */

export type SanitizeMode = 'full' | 'structure';

export interface SanitizedWebhookShape {
  // Only explicitly allowed webhook config values
  url?: { type: 'string'; value?: string };
  enabled?: { type: 'boolean'; value?: boolean };
  events?: { type: 'array'; value?: string[] };
  webhookByEvents?: { type: 'boolean'; value?: boolean };
  webhookBase64?: { type: 'boolean'; value?: boolean };
  // Everything else: name + type only, value redacted
  [other: string]: { type: string; value?: unknown } | undefined;
}

const ALLOWLIST_VALUES = new Set([
  'url', 'enabled', 'events', 'webhookByEvents', 'webhookBase64',
]);

const SECRET_LIKE = new Set([
  'apikey', 'api_key', 'key', 'token', 'jwt', 'auth', 'cookie', 'secret',
  'password', 'credential', 'access_token', 'refresh_token', 'instance',
  'instanceName', 'instance_name', 'phone', 'jid', 'contact', 'message',
  'from', 'to', 'mediaUrl', 'media_url', 'body', 'payload',
]);

const SENSITIVE_TYPES: Record<string, boolean> = {
  url: true, enabled: true, events: true, webhookByEvents: true, webhookBase64: true,
};

function getTypeName(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  return typeof v;
}

export function sanitizeWebhookResponse(
  raw: unknown,
  mode: SanitizeMode = 'full'
): SanitizedWebhookShape {
  if (!raw || typeof raw !== 'object') return {};
  const out: SanitizedWebhookShape = {};
  const obj = raw as Record<string, unknown>;

  // Check both top-level and nested webhook (provider contract variation)
  const sources = [
    obj,
    (obj.webhook || (obj as any).data?.webhook || {}) as Record<string, unknown>,
  ];

  for (const src of sources) {
    for (const [key, val] of Object.entries(src)) {
      if (ALLOWLIST_VALUES.has(key) && mode === 'full') {
        // Only allowlisted values exposed when explicitly permitted
        if (key === 'events' && Array.isArray(val)) {
          out[key] = { type: 'array', value: val.map(String) };
        } else if (key === 'url' && typeof val === 'string') {
          out[key] = { type: 'string', value: val };
        } else if (key === 'enabled' || key === 'webhookByEvents' || key === 'webhookBase64') {
          out[key] = { type: 'boolean', value: val === true };
        } else {
          out[key] = { type: getTypeName(val), value: undefined };
        }
      } else if (!ALLOWLIST_VALUES.has(key)) {
        const isSecret = SECRET_LIKE.has(key.toLowerCase()) || /token|secret|key|jwt|auth|cookie|password/i.test(key);
        const typeName = getTypeName(val);
        // Redact value for secret-like or unknown fields
        out[key] = { type: typeName, value: isSecret ? undefined : (mode === 'full' ? val : undefined) };
      }
    }
  }
  return out;
}
