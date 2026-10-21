export interface PhoneLabel { id: string; name: string; color: string; }
export const validChatId = (id: unknown): id is string => typeof id === 'string' && /^\d{5,25}(?:-\d{1,25})?@(?:s\.whatsapp\.net|c\.us|g\.us|lid)$/.test(id);
export const validMessageId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function projectPhoneLabels(value: unknown): PhoneLabel[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error('Invalid label response');
  const seen = new Set<string>();
  return value.map(row => {
    if (!row || typeof row.id !== 'string' || !/^[\w-]{1,100}$/.test(row.id) || typeof row.name !== 'string' || row.name.length > 100 || seen.has(row.id)) throw new Error('Invalid label response');
    seen.add(row.id);
    return { id: row.id, name: row.name, color: String(row.color ?? '').slice(0, 100) };
  });
}
export function unreadBadge(count: number) { return count > 99 ? '99+' : String(count); }
