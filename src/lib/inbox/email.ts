export interface InboxEmail {
  kind: 'message'; channel: 'email'; id: string; identity: string;
  subject: string; body: string; from: string; to: string; occurredAt: string | null;
  unread: boolean; contact: { id: string; name: string } | null;
  resolution: 'matched' | 'unresolved';
  bodyTruncated: boolean;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function projectStoredEmail(raw: unknown): InboxEmail | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, any>;
  if (typeof row.id !== 'string' || !uuid.test(row.id)) return null;
  const text = (value: unknown, limit: number) => typeof value === 'string' ? value.slice(0, limit) : '';
  const contact = row.contact && !Array.isArray(row.contact) && uuid.test(row.contact.id) && row.contact.id === row.contact_id
    ? { id: row.contact.id, name: text(row.contact.name, 160) || 'Contact' } : null;
  const date = typeof row.date === 'string' && Number.isFinite(Date.parse(row.date)) ? new Date(row.date).toISOString() : null;
  return { kind: 'message', channel: 'email', id: row.id, identity: JSON.stringify(['crm-email-store', row.id]),
    subject: text(row.subject, 500) || '(No subject)', body: text(row.body, 12000), from: text(row.from_email, 320), to: text(row.to_email, 320),
    occurredAt: date, unread: row.read === false, contact, resolution: contact ? 'matched' : 'unresolved', bodyTruncated: typeof row.body === 'string' && row.body.length > 12000 };
}
export function deduplicateEmails(rows: readonly InboxEmail[]): InboxEmail[] {
  const seen = new Set<string>();
  return rows.filter(row => { if (seen.has(row.identity)) return false; seen.add(row.identity); return true; });
}
export function messagingIdentity(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  const fields = ['provider', 'mailbox', 'externalId'].map(key => row[key]);
  if (fields.some(value => typeof value !== 'string' || !value.trim() || value.length > 500)) return null;
  return JSON.stringify(['email', ...fields]);
}
