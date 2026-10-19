import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authorizePublishing, publishingProvider, projectPost, projectMedia, PublishingError, reject, id } from './provider.js';

export async function handlePublishing(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const caller = await authorizePublishing(req);
    const action = typeof req.query.action === 'string' ? req.query.action : 'readiness';
    if (!['readiness', 'media', 'knownPost'].includes(action)) reject(400, 'Unknown publishing action.');
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); reject(405, 'GET required.'); }
    const provider = await publishingProvider(caller.admin);
    if (action === 'readiness') return res.json({ success: true, workspace: { id: provider.workspace, name: provider.name, timezone: 'America/Jamaica' }, accounts: provider.accounts, permissions: provider.permissions, publicationVerified: false, warning: 'Connected metadata does not prove platform publication. FollOps approval does not prevent direct publishing in BrightBean Studio.' });
    if (action === 'knownPost') { const requested = id(req.query.id); const row = await provider.request(`/posts/${requested}`); if (row?.id !== requested) reject(502, 'Post identity could not be verified.'); return res.json({ success: true, post: projectPost(row, provider) }); }
    const query = new URLSearchParams({ limit: '25' });
    if (req.query.cursor !== undefined) { if (typeof req.query.cursor !== 'string' || req.query.cursor.length > 256 || !/^[A-Za-z0-9_+=\/-]+$/.test(req.query.cursor)) reject(400, 'Invalid media cursor.'); query.set('cursor', req.query.cursor); }
    const media = await provider.request(`/media/?${query}`);
    if (!Array.isArray(media.items) || media.items.length > 25 || (media.next_cursor != null && (typeof media.next_cursor !== 'string' || media.next_cursor.length > 256 || !/^[A-Za-z0-9_+=\/-]+$/.test(media.next_cursor)))) reject(502, 'Media listing is unavailable.');
    return res.json({ success: true, items: media.items.map((row: any) => projectMedia(row, provider.workspace)), nextCursor: media.next_cursor ?? null });
  } catch (error) {
    const safe = error instanceof PublishingError ? error : new PublishingError(503, 'Publishing is temporarily unavailable.');
    return res.status(safe.status).json({ success: false, error: safe.message, uncertain: safe.uncertain });
  }
}
