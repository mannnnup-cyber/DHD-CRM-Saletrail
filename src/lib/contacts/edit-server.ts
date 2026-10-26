import { contactCaller, contactFailure, type ContactCaller } from './auth-server.js';
import { sharedChallenge,claimSharedReview,sharedMutation } from './shared-review-server.js';
import { fullPhone } from './review.js';
import { contactCandidates, candidateFilter } from './review-server.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowed = ['name', 'email', 'phone', 'company', 'contact_preference', 'timezone', 'linkedin_url'];
export function contactChanges(body: unknown): Record<string, string | null> {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) throw new Error('Unsupported contact fields.');
  const result: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'string' || value.length > (key === 'linkedin_url' ? 500 : 254)) throw new Error('Invalid contact field.');
    result[key] = value.trim() || null;
  }
  if (!Object.keys(result).length || ('name' in result && !result.name)) throw new Error('A contact name is required.');
  if (result.email) {
    result.email = result.email.toLowerCase();
    if (!/^[^\s@,;()]+@[^\s@,;()]+\.[^\s@,;()]+$/.test(result.email)) throw new Error('Enter a valid email address.');
  }
  if ('phone' in result) {
    if (result.phone && !/^\+?[0-9 ()-]{7,30}$/.test(result.phone)) throw new Error('Enter a valid phone number.');
    const digits = (result.phone || '').replace(/\D/g, '');
    if (result.phone && (digits.length < 7 || digits.length > 15)) throw new Error('Enter a valid phone number.');
    result.phone_normalized = digits ? digits.slice(-10) : null;
  }
  if (result.contact_preference && !['call', 'whatsapp', 'email', 'sms'].includes(result.contact_preference)) throw new Error('Invalid contact preference.');
  if (result.linkedin_url) { try { const url = new URL(result.linkedin_url); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); } catch { throw new Error('Enter a valid HTTP or HTTPS URL.'); } }
  return result;
}
export async function editContact(req: VercelRequest, res: VercelResponse, verified?: ContactCaller) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' });
    const caller=verified || await contactCaller(req,res), admin=caller.admin;
    if(!caller.manager)return res.status(403).json({error:'Contact corrections require an active owner or manager.'});
    if (!/^application\/json(?:;|$)/i.test(String(req.headers['content-type'] || ''))) return res.status(415).json({ error: 'JSON required.' });
    if (typeof req.query.id !== 'string' || !uuid.test(req.query.id)) return res.status(400).json({ error: 'Invalid contact ID.' });
    let changes: ReturnType<typeof contactChanges>;
    try { changes = contactChanges(req.body?.fields); } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid contact fields.' }); }
    const expected=req.body?.expected;
    if(!expected||typeof expected!=='object'||Array.isArray(expected)||Object.keys(expected).length!==allowed.length||allowed.some(key=>!(key in expected)||(expected[key]!==null&&typeof expected[key]!=='string')||(typeof expected[key]==='string'&&expected[key].length>500)))return res.status(428).json({error:'Reload the contact before saving; an original field snapshot is required.'});
    const { data: current, error: currentError } = await admin.from('contacts').select('id,name,email,phone,phone_normalized,company,contact_preference,timezone,linkedin_url').eq('id', req.query.id).maybeSingle();
    if (currentError) return res.status(503).json({ error: 'Could not verify the current contact.' });
    if (!current) return res.status(404).json({ error: 'Contact not found.' });
    const stale=()=>res.status(409).json({code:'CONTACT_STALE',error:'This contact changed since editing began. Your draft is preserved; reload and review before saving.'});
    if(allowed.some(key=>(current[key]??null)!==expected[key]))return stale();
    if(req.body.sharedReview&&allowed.every(key=>!(key in changes)||(changes[key]??null)===(current[key]??null)))return res.status(400).json({error:'No contact correction was proposed.'});
    let shared:Awaited<ReturnType<typeof claimSharedReview>>|undefined;
    // Best-effort review preflight, not an atomic cross-worker identity constraint.
    const warnings:string[]=[];
    for (const field of ['email','phone']) {
      if (!changes[field] || changes[field] === (field==='email'?current.email?.trim().toLowerCase():current.phone)) continue;
      let query=admin.from('contacts').select('id,phone,phone_normalized');
      query=field==='email'?query.ilike('email',changes.email!.replace(/[\\%_]/g,'\\$&')):query.or(candidateFilter({phone:changes.phone},false));
      const {data,error}=await query.neq('id',req.query.id).limit(21);
      if(error)return res.status(503).json({error:'Could not verify contact uniqueness.'});
      const conflict=field==='email'?Boolean(data?.length):(data?.length||0)>20||data?.some((row:any)=>!fullPhone(changes.phone)||!fullPhone(row.phone)||fullPhone(changes.phone)===fullPhone(row.phone));
      if(conflict){const identity={...current,...changes},result=await contactCandidates(caller,req.query.id,identity,undefined,false),input={purpose:'edit' as const,target:req.query.id,fields:changes,expected,identity};if(req.body.sharedReview){shared=await claimSharedReview(req,res,caller,input,result);break;}return res.status(409).json({code:'CONTACT_IDENTIFIER_CONFLICT',matchScope:'identifiers',error:'Another contact has matching identifiers. Review before saving.',matchedFields:[field],...result,...sharedChallenge(caller,input,result),guidance:'Review all matches; keep these contacts separate only after explicit confirmation. No merge or relationship transfer occurs.'});}
      if(data?.length)warnings.push('Legacy phone suffix matches other records, but full international numbers differ. Ownership remains unverified.');
    }
    if(req.body.sharedReview&&!shared)return res.status(409).json({error:'Matching evidence changed. Review again before confirming.'});
    let update=(shared?.admin||admin).from('contacts').update(changes).eq('id',req.query.id);
    for(const key of allowed)update=expected[key]===null?update.is(key,null):update.eq(key,expected[key]);
    const { data, error } = await sharedMutation(update.select('id,name,email,phone,company,contact_preference,timezone,linkedin_url').maybeSingle());
    if(error){if(shared)await shared.finish('uncertain-save');return res.status(503).json({code:shared?'SHARED_SAVE_UNCERTAIN':undefined,operationId:shared?.id,error:'Could not confirm contact corrections. Do not retry automatically; reconcile the operation.'});}
    if(!data){if(shared&&!await shared.finish('rejected-stale'))return res.status(503).json({code:'SHARED_SAVE_UNCERTAIN',operationId:shared.id,error:'No correction was returned and audit finalization is uncertain. Reconcile before retrying.'});return stale();}
    if(shared&&!await shared.finish('confirmed'))return res.status(503).json({code:'SHARED_SAVE_UNCERTAIN',operationId:shared.id,error:'The contact correction may be saved, but audit outcome could not be confirmed. Reconcile before retrying.'});
    return res.json({ success: true, contact: data, warnings });
  } catch(error) { return contactFailure(res,error); }
}
