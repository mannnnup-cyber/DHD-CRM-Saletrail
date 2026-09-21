export interface IdempotencyResult { key: string | null; source: string; derivedFrom: string[]; safe: boolean; }
export const deriveIdempotencyKey = (source: string, f: Record<string,string>): IdempotencyResult => {
  if (f.providerEventId || f.messageId || f.externalId) return { key: f.providerEventId || f.messageId || f.externalId, source, derivedFrom: ['stable_id'], safe: true };
  const combo = [f.senderNormalized, f.channel, f.timestamp, f.contentHash].filter(Boolean).join(':');
  if (combo.length > 0 && combo.length >= 6) return { key: require('crypto').createHash('sha256').update(combo).digest('hex').slice(0,16), source, derivedFrom: ['derived_hash'], safe: true };
  return { key: null, source, derivedFrom: [], safe: false };
};
