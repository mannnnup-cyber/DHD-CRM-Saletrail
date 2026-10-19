import { id, reject, text } from './provider.js';

export async function rpc(admin: any, name: string, args: object) {
  const result = await admin.rpc(name, args);
  if (result.error) {
    const conflict = /social_(revision|state|operation|approval|identity|already|delivery|schedule|cannot)/.test(result.error.message || '');
    const denied = /social_(access|membership|account)/.test(result.error.message || '');
    reject(denied ? 403 : conflict ? 409 : 503, denied ? 'Workspace membership or permission is required.' : conflict ? 'State changed or an operation remains unresolved. Refresh before continuing.' : 'Publishing storage is unavailable. Verify the reviewed migration is installed.');
  }
  return result.data;
}
export async function membership(caller: any, workspace: string) {
  const result = await caller.admin.from('social_memberships').select('actor_id').eq('workspace_id', workspace).eq('actor_id', caller.actor).maybeSingle();
  if (result.error) reject(503, 'Publishing storage is unavailable. The reviewed migration must be installed first.');
  if (!result.data) reject(403, 'Ask an owner to initialize this workspace or grant you access.');
}
export async function readPost(caller: any, workspace: string, postId: unknown) {
  const result = await caller.admin.from('social_posts').select('*').eq('workspace_id', workspace).eq('id', id(postId)).maybeSingle();
  if (result.error) reject(503, 'Publishing storage is unavailable.'); if (!result.data) reject(404, 'Post is unavailable.'); return result.data;
}
export function normalizeDraft(input: any, provider: any) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) reject(400, 'Draft is invalid.');
  const caption = text(input.caption, 10001), firstComment = text(input.firstComment, 2201);
  if (!caption.trim() || caption.length > 10000 || firstComment.length > 2200) reject(400, 'Enter a caption of 1–10,000 characters and a first comment up to 2,200.');
  if (!Array.isArray(input.accountIds) || input.accountIds.length < 1 || input.accountIds.length > 2 || new Set(input.accountIds).size !== input.accountIds.length) reject(400, 'Select one or two different Instagram/Facebook accounts.');
  const accounts = input.accountIds.map((raw: unknown) => { const account = provider.account(id(raw)); if (caption.length > account.charLimit) reject(400, `Caption exceeds ${account.charLimit} characters for the selected account.`); return { id: account.id, platform: account.platform }; }).sort((a: any,b: any) => a.id.localeCompare(b.id));
  if (!Array.isArray(input.mediaIds) || input.mediaIds.length > 1) reject(400, 'The first publishing slice supports one JPEG/PNG image.');
  const mediaIds = input.mediaIds.map(id);
  let scheduledAt = null;
  if (input.scheduledAt) { if (typeof input.scheduledAt !== 'string' || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(input.scheduledAt) || !Number.isFinite(Date.parse(input.scheduledAt))) reject(400, 'Schedule requires an explicit timezone.'); scheduledAt = new Date(input.scheduledAt).toISOString(); }
  return { id: input.id ? id(input.id) : undefined, version: input.id ? positiveVersion(input.version) : undefined, caption, firstComment, accounts, mediaIds, scheduledAt, campaignId: input.campaignId ? id(input.campaignId) : null };
}
export function positiveVersion(value: unknown) { if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 1000000) reject(400, 'Refresh the post version.'); return value as number; }
export async function listStore(caller: any, workspace: string, query: any) {
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000) reject(400, 'Invalid page offset.');
  let posts = caller.admin.from('social_posts').select('*', { count: 'exact' }).eq('workspace_id', workspace);
  const states = ['draft','awaiting_approval','approved','scheduled','publishing','published','failed','cancelled','uncertain','partial'];
  if (query.status) { if (!states.includes(query.status)) reject(400, 'Invalid status.'); posts = posts.eq('state',query.status); }
  if (query.campaign) posts = posts.eq('campaign_id', id(query.campaign));
  if (query.from || query.to) { if (!query.from || !query.to || !Number.isFinite(Date.parse(query.from)) || !Number.isFinite(Date.parse(query.to)) || Date.parse(query.to) - Date.parse(query.from) > 100*86400000 || Date.parse(query.to) <= Date.parse(query.from)) reject(400,'Calendar range must be at most 100 days.'); posts = posts.gte('scheduled_at',new Date(query.from).toISOString()).lt('scheduled_at',new Date(query.to).toISOString()); }
  const [rows, campaigns, brand, media, members] = await Promise.all([
    posts.order('created_at', { ascending:false }).range(offset,offset+49),
    caller.admin.from('social_campaigns').select('*').eq('workspace_id',workspace).order('updated_at',{ascending:false}).limit(100),
    caller.admin.from('social_brands').select('profile,version').eq('workspace_id',workspace).maybeSingle(),
    caller.admin.from('social_media').select('*').eq('workspace_id',workspace).order('created_at',{ascending:false}).limit(100),
    caller.admin.from('social_memberships').select('actor_id').eq('workspace_id',workspace).limit(100)
  ]);
  if ([rows,campaigns,brand,media,members].some(r=>r.error)) reject(503,'Publishing storage is unavailable.');
  return { posts: rows.data, total: rows.count, offset, campaigns:campaigns.data, brand:brand.data, media:media.data, members:members.data };
}
