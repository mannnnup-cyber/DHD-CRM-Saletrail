export interface SocialReply {
  id: string; messageId: string; body: string; status: string; sentAt: string | null; confirmed: boolean;
}
export interface SocialMessage {
  id: string; accountId: string; platform: string; type: string; status: string;
  sender: string; body: string; bodyTruncated: boolean; receivedAt: string | null;
  canSend: boolean; reason: string; replies: SocialReply[];
}
export interface SocialAccount { id: string; platform: string; account_name: string; account_handle: string; connection_status: string; }
export const socialUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function socialText(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max) : '';
}
export function projectReply(row: any): SocialReply | null {
  if (!row || !socialUuid.test(row.id) || !socialUuid.test(row.inbox_message_id)) return null;
  return { id: row.id, messageId: row.inbox_message_id, body: socialText(row.body, 10000), status: ['draft', 'failed', 'sent'].includes(row.status) ? row.status : 'unknown', sentAt: typeof row.sent_at === 'string' ? socialText(row.sent_at, 40) : null, confirmed: row.status === 'sent' && Boolean(row.sent_at) && typeof row.platform_reply_id === 'string' && Boolean(row.platform_reply_id.trim()) };
}
export function projectMessage(row: any): SocialMessage | null {
  if (!row || !socialUuid.test(row.id) || !socialUuid.test(row.social_account_id)) return null;
  return { id: row.id, accountId: row.social_account_id, platform: socialText(row.platform, 40), type: socialText(row.message_type, 30), status: socialText(row.status, 30), sender: socialText(row.sender_name || row.sender_handle) || 'Unknown sender', body: socialText(row.body, 12000), bodyTruncated: typeof row.body === 'string' && row.body.length > 12000, receivedAt: typeof row.received_at === 'string' ? socialText(row.received_at, 40) : null, canSend: row.reply_eligibility?.can_send === true, reason: socialText(row.reply_eligibility?.reason, 500), replies: Array.isArray(row.replies) ? row.replies.slice(0, 100).map(projectReply).filter((reply: SocialReply | null) => reply?.messageId === row.id) : [] };
}
