import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authorizePublishing, publishingProvider, projectPost, projectMedia, PublishingError, reject, id, DHD_WORKSPACE } from './provider.js';
import { rpc, membership, normalizeDraft, positiveVersion, listStore, readPost } from './store.js';
import { uploadImage, schedulePost, deliveryCommand, recoverOperation } from './commands.js';
import {generateContent,brandInput,campaignInput} from './ai.js';
import {postAnalytics,attributionInput} from './analytics.js';

export async function handlePublishing(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const caller = await authorizePublishing(req);
    const action = typeof req.query.action === 'string' ? req.query.action : 'readiness';
    const methods: Record<string,string> = { readiness:'GET',media:'GET',mediaPreview:'GET',knownPost:'GET',store:'GET',detail:'GET',initialize:'POST',grant:'POST',revoke:'POST',save:'POST',submit:'POST',approve:'POST',reject:'POST',upload:'POST',schedule:'POST',cancel:'POST',reconcile:'POST',recover:'POST',brand:'POST',campaign:'POST',ai:'POST',analytics:'GET',report:'GET',attribution:'POST' };
    if (!methods[action]) reject(400, 'Unknown publishing action.');
    if (req.method !== methods[action]) { res.setHeader('Allow', methods[action]); reject(405, `${methods[action]} required.`); }
    if (req.method !== 'GET' && req.headers['content-type']?.split(';')[0] !== 'application/json') reject(415, 'JSON required.');
    const localOnly=['store','detail','grant','revoke','submit','approve','reject','brand','campaign','ai','report','attribution'].includes(action);
    const provider:any = localOnly ? {workspace:id(process.env.BRIGHTBEAN_WORKSPACE_ID||DHD_WORKSPACE)} : await publishingProvider(caller.admin);
    if (action === 'readiness') return res.json({ success: true, workspace: { id: provider.workspace, name: provider.name, timezone: 'America/Jamaica' }, accounts: provider.accounts, permissions: provider.permissions, writesEnabled:process.env.SOCIAL_PUBLISHING_WRITES_ENABLED==='true',aiEnabled:process.env.SOCIAL_AI_ENABLED==='true',publicationVerified: false, warning: 'Connected metadata does not prove platform publication. FollOps approval does not prevent direct publishing in BrightBean Studio.' });
    if(action!=='initialize')await membership(caller,provider.workspace);
    if (action === 'mediaPreview') {
      const saved = await caller.admin.from('social_media').select('*').eq('workspace_id',provider.workspace).eq('id',id(req.query.id)).maybeSingle();
      if (saved.error || !saved.data) reject(404,'Image is unavailable in this workspace.');
      const media = projectMedia(await provider.request(`/media/${id(saved.data.provider_id)}`),provider.workspace);
      if (media.id !== saved.data.provider_id || media.bytes !== saved.data.bytes || media.mime !== saved.data.mime) reject(409,'The image mapping changed. Review the media before approval.');
      return res.json({success:true,media});
    }
    if (action === 'knownPost') { const requested = id(req.query.id); const row = await provider.request(`/posts/${requested}`); if (row?.id !== requested) reject(502, 'Post identity could not be verified.'); return res.json({ success: true, post: projectPost(row, provider) }); }
    if (!['media'].includes(action)) {
      const input = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
      if (action === 'initialize') { if (caller.role !== 'owner') reject(403,'Only an owner may initialize publishing.'); return res.json({success:true,result:await rpc(caller.admin,'social_command',{p_workspace:provider.workspace,p_actor:caller.actor,p_action:action,p_input:{accounts:provider.accounts.map((a:any)=>({id:a.id,platform:a.platform}))}})}); }
      if (action === 'upload') return res.json(await uploadImage(caller,provider,input));
      if (action === 'schedule') return res.json(await schedulePost(caller,provider,input));
      if (action === 'cancel' || action === 'reconcile') return res.json(await deliveryCommand(caller,provider,input,action));
      if (action === 'recover') return res.json(await recoverOperation(caller,provider,input));
      if (action === 'ai') return res.json(await generateContent(caller,provider.workspace,input));
      if (action === 'analytics') return res.json(await postAnalytics(caller,provider,req.query.id));
      if (action === 'report') return res.json({success:true,report:await rpc(caller.admin,'social_report',{p_workspace:provider.workspace,p_actor:caller.actor})});
      if (action === 'store') return res.json({success:true,...await listStore(caller,provider.workspace,req.query),role:caller.role,actor:caller.actor});
      if (action === 'detail') {
        const post = await readPost(caller,provider.workspace,req.query.id);
        const [operations,deliveries,approvals,audit,revisions] = await Promise.all(['social_operations','social_deliveries','social_approvals','social_audit','social_revisions'].map(table=>caller.admin.from(table).select('*').eq('post_id',post.id).limit(100)));
        if ([operations,deliveries,approvals,audit,revisions].some(r=>r.error)) reject(503,'Post history is unavailable.');
        return res.json({success:true,post,operations:operations.data.map(({lease_token,...safe}:any)=>safe),deliveries:deliveries.data,approvals:approvals.data,audit:audit.data,revisions:revisions.data});
      }
      const data = action === 'save' ? normalizeDraft(input,provider) : action==='brand'?brandInput(input):action==='campaign'?campaignInput(input):action==='attribution'?attributionInput(input):['grant','revoke'].includes(action) ? {actorId:id(input.actorId)} : {id:id(input.id),version:positiveVersion(input.version)};
      return res.json({success:true,result:await rpc(caller.admin,'social_command',{p_workspace:provider.workspace,p_actor:caller.actor,p_action:action,p_input:data})});
    }
    const query = new URLSearchParams({ limit: '25' });
    if (req.query.cursor !== undefined) { if (typeof req.query.cursor !== 'string' || req.query.cursor.length > 256 || !/^[A-Za-z0-9_+=\/-]+$/.test(req.query.cursor)) reject(400, 'Invalid media cursor.'); query.set('cursor', req.query.cursor); }
    const media = await provider.request(`/media/?${query}`);
    if (!Array.isArray(media.items) || media.items.length > 25 || (media.next_cursor != null && (typeof media.next_cursor !== 'string' || media.next_cursor.length > 256 || !/^[A-Za-z0-9_+=\/-]+$/.test(media.next_cursor)))) reject(502, 'Media listing is unavailable.');
    return res.json({ success: true, items: media.items.map((row: any) => projectMedia(row, provider.workspace)), nextCursor: media.next_cursor ?? null });
  } catch (error) {
    const safe = error instanceof PublishingError ? error : new PublishingError(503, 'Publishing is temporarily unavailable.');
    if(safe.status===429)res.setHeader('Retry-After',safe.retryAfter);
    return res.status(safe.status).json({ success: false, error: safe.message, uncertain: safe.uncertain });
  }
}
