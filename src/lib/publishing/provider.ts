import type { VercelRequest } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const DHD_WORKSPACE = '0b8f55a0-f110-4504-8e16-c9b6c79c5726';
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class PublishingError extends Error {
  constructor(public status: number, message: string, public uncertain = false, public retryAfter='60') { super(message); }
}
const rateBuckets=new Map<string,{start:number;count:number}>();
export function reject(status: number, message: string): never { throw new PublishingError(status, message); }
export const text = (value: unknown, max = 300) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max) : '';
export function id(value: unknown) { if (typeof value !== 'string' || !uuidPattern.test(value)) reject(400, 'A valid identifier is required.'); return value as string; }
export async function authorizePublishing(req: VercelRequest) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !/^Bearer \S+$/.test(header) || header.length > 8192) reject(401, 'Authentication required.');
  const url = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !secret) reject(503, 'Publishing configuration is unavailable.');
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const auth = createClient(url, anon, options), admin = createClient(url, secret, options);
  const result = await auth.auth.getUser(header.slice(7));
  if (result.error || !result.data?.user) reject(401, 'Session expired. Sign in again.');
  const profile = await admin.from('user_profiles').select('id,role,is_active').eq('id', result.data.user.id).eq('is_active', true).maybeSingle();
  if (profile.error) reject(503, 'Publishing access is unavailable.');
  if (!profile.data || profile.data.id !== result.data.user.id || profile.data.is_active !== true || !['owner', 'manager'].includes(profile.data.role)) reject(403, 'Publishing requires an active owner or manager.');
  const now=Date.now();for(const [actor,bucket] of rateBuckets)if(now-bucket.start>=60000)rateBuckets.delete(actor);
  if(rateBuckets.size>=1000&&!rateBuckets.has(profile.data.id))reject(429,'Publishing request limit reached.');
  const bucket=rateBuckets.get(profile.data.id)||{start:now,count:0};bucket.count++;rateBuckets.set(profile.data.id,bucket);if(bucket.count>100)reject(429,'Publishing request limit reached.');
  return { admin, actor: profile.data.id as string, role: profile.data.role as 'owner' | 'manager' };
}

export async function publishingProvider(admin: any) {
  let key = process.env.BRIGHTBEAN_API_KEY || '';
  if (!key) {
    const setting = await admin.from('app_settings').select('setting_value').eq('setting_key', 'BRIGHTBEAN_API_KEY').maybeSingle();
    if (setting.error) reject(503, 'Publishing configuration is unavailable.');
    key = typeof setting.data?.setting_value === 'string' ? setting.data.setting_value : '';
  }
  if (!key) reject(503, 'BrightBean is not configured.');
  let base: URL;
  try { base = new URL(process.env.BRIGHTBEAN_API_URL || 'https://studio.brightbean.xyz/api/v1'); } catch { reject(503, 'Provider origin is invalid.'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || !/^\/api\/v1\/?$/.test(base.pathname)) reject(503, 'Provider origin is invalid.');
  const request = async (path: string, method = 'GET', body?: object | FormData) => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const multipart = body instanceof FormData;
      const response = await fetch(`${base.origin}/api/v1${path}`, { method, redirect: 'error', cache: 'no-store', signal: controller.signal,
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', 'User-Agent': 'FollOps-publishing/1.0', ...(!multipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body === undefined ? undefined : multipart ? body as FormData : JSON.stringify(body) });
      if (!response.ok) {
        if ([400, 401, 403, 404, 409, 422, 429].includes(response.status)) {const retry=response.headers.get('Retry-After');throw new PublishingError(response.status === 401 ? 502 : response.status, response.status === 429 ? 'BrightBean rate limited this request. Wait before trying again.' : 'BrightBean rejected this request. Check permissions, connection and content.',method!=='GET'&&response.status===409,retry&&/^\d{1,6}$/.test(retry)?retry:'60');}
        throw new PublishingError(502, 'BrightBean outcome could not be verified.', method !== 'GET');
      }
      let bytes = 0, raw = ''; const reader = response.body?.getReader(), decoder = new TextDecoder();
      if (!reader) throw new Error();
      while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 2000000) { await reader.cancel(); throw new Error(); } raw += decoder.decode(part.value, { stream: true }); }
      return JSON.parse(raw + decoder.decode());
    } catch (error) { if (error instanceof PublishingError) throw error; throw new PublishingError(502, 'BrightBean outcome could not be verified.', method !== 'GET'); }
    finally { clearTimeout(timer); }
  };
  const scope = await request('/me/');
  const expected = process.env.BRIGHTBEAN_WORKSPACE_ID || DHD_WORKSPACE;
  if (!uuidPattern.test(expected) || scope?.workspace_id !== expected || !Array.isArray(scope.permissions) || scope.permissions.length>100 || !Array.isArray(scope.allowlisted_accounts) || scope.allowlisted_accounts.length>100) reject(503, 'BrightBean workspace scope does not match this installation.');
  const result = await request('/accounts/');
  if (!Array.isArray(result?.accounts)) reject(502, 'BrightBean accounts are unavailable.');
  const allowed = new Set(scope.allowlisted_accounts.map((row: any) => row?.id).filter((value:unknown)=>typeof value==='string'&&uuidPattern.test(value)));
  const accounts = result.accounts.filter((row: any) => allowed.has(row.id) && uuidPattern.test(row.id) && ['instagram', 'facebook'].includes(row.platform)).map((row: any) => ({ id: row.id, platform: row.platform, name: text(row.account_name), handle: text(row.account_handle), connection: ['connected', 'token_expiring', 'disconnected', 'error'].includes(row.connection_status) ? row.connection_status : 'error', charLimit: Math.min(10000, Number(row.char_limit) || 2200), requiresMedia: row.requires_media === true, firstComment: row.supports_first_comment === true }));
  const permission = (name: string) => { if (!scope.permissions.includes(name)) reject(403, `BrightBean requires ${name} permission.`); };
  const account = (accountId: string) => { const found = accounts.find((row: any) => row.id === accountId); if (!found) reject(403, 'Account is outside this installation’s publishing scope.'); return found; };
  return { request, workspace: expected, name: text(scope.workspace_name), permissions: scope.permissions.filter((s: unknown) => typeof s === 'string'), accounts, permission, account };
}
export function projectPost(row: any, provider: Awaited<ReturnType<typeof publishingProvider>>) {
  if (!row || !uuidPattern.test(row.id) || row.workspace_id !== provider.workspace || !Array.isArray(row.platform_posts) || !row.platform_posts.length || row.platform_posts.length > 10) reject(502, 'Post scope could not be verified.');
  const children = row.platform_posts.map((child: any) => {
    const account = provider.account(child.social_account_id);
    if (account.platform !== child.platform || !uuidPattern.test(child.id)) reject(502, 'Post account could not be verified.');
    const publishedAt = typeof child.published_at === 'string' && Number.isFinite(Date.parse(child.published_at)) ? new Date(child.published_at).toISOString() : null;
    const nativeId = text(child.platform_post_id, 300);
    const status = child.status === 'published' && (!publishedAt || !nativeId) ? 'uncertain' : text(child.status, 40);
    return { id: child.id, accountId: account.id, platform: account.platform, status, publishedAt, scheduledAt: typeof child.scheduled_at === 'string' && Number.isFinite(Date.parse(child.scheduled_at)) ? new Date(child.scheduled_at).toISOString() : null, nativeId, error: child.publish_error ? 'Provider publication failed. Review the connection and Studio delivery history.' : null };
  });
  const statuses=children.map((c:any)=>c.status),all=(state:string)=>statuses.every((s:string)=>s===state);
  const status=statuses.includes('uncertain')?'uncertain':all('published')?'published':all('scheduled')?'scheduled':all('draft')?'draft':all('cancelled')?'cancelled':all('failed')?'failed':statuses.includes('publishing')?'publishing':'partial';
  return { id: row.id, status, caption: text(row.caption, 10000), title: text(row.title, 255), firstComment: text(row.first_comment, 2200), scheduledAt: typeof row.scheduled_at === 'string' && Number.isFinite(Date.parse(row.scheduled_at)) ? new Date(row.scheduled_at).toISOString() : null, children };
}
export function projectMedia(row: any, workspace: string) {
  if (!row || !uuidPattern.test(row.id) || row.workspace_id !== workspace) reject(502, 'Media workspace could not be verified.');
  const preview = (raw: unknown) => { if (typeof raw !== 'string' || !raw.trim() || raw.length > 4096) return null; try { const url = new URL(raw, 'https://studio.brightbean.xyz'); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } };
  const finite=(value:any,max:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max?value:0;
  return { id: row.id, filename: text(row.filename, 255), title: text(row.title, 200), alt: text(row.alt_text, 1000), mime: text(row.mime_type, 80), bytes: finite(row.file_size,1e10), width: finite(row.width,100000), height: finite(row.height,100000), status: text(row.processing_status, 40), url: preview(row.url), thumbnail: preview(row.thumbnail_url) };
}
