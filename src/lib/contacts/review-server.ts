import { type ContactCaller, permittedContact, scopeContacts, reject, uuid } from './auth-server.js';
import { emailIdentity, phoneSuffix, matchingEvidence, type ContactIdentity } from './review.js';
export const contactProjection = 'id,name,email,phone,phone_normalized,company,assigned_to,source,sources,created_at,contact_type';
export const literalPattern = (value: string) => value.replace(/[\\%_*]/g, '\\$&');
const quoted = (value: string) => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
export function candidateFilter(identity: Partial<ContactIdentity>, includeName = true) {
  const terms: string[] = [], email=emailIdentity(identity.email), phone=phoneSuffix(identity.phone);
  if(email) terms.push('email.ilike.'+quoted(literalPattern(email)));
  if(phone) terms.push('phone_normalized.eq.'+quoted(phone));
  if(includeName && identity.name?.trim()) terms.push('name.ilike.'+quoted(literalPattern(identity.name.trim())));
  return terms.join(',');
}
export async function contactCandidates(caller: ContactCaller, id: string, identity: Partial<ContactIdentity>, after?: unknown, includeName = true) {
  if(after !== undefined && after !== null && !uuid(after)) reject(400, 'Invalid candidate cursor.');
  const filter = candidateFilter(identity, includeName);
  if(!filter) return {candidates:[],visibleCount:0,nextCursor:null};
  const base = (count = false) => scopeContacts(caller.admin.from('contacts').select(contactProjection, count ? {count:'exact',head:true} : undefined).neq('id',id).or(filter),caller);
  const {count,error:countError}=await base(true);
  let query=base().order('id',{ascending:true});if(after)query=query.gt('id',after);
  const {data,error}=await query.limit(21);
  if(error||countError||!Number.isInteger(count)||count<0)reject(503,'Could not check contact candidates.');
  const page=(data||[]).slice(0,20);
  return { candidates:page.map((row: ContactIdentity)=>({...row,...matchingEvidence(identity,row)})), visibleCount:count, nextCursor:(data||[]).length>20 ? page[page.length-1].id : null };
}
export async function compareContacts(caller: ContactCaller, ids: unknown[]) {
  if(ids.length!==2 || ids[0]===ids[1]) reject(400,'Choose two different contacts.');
  const contacts=await Promise.all(ids.map(id=>permittedContact(caller,id)));
  const tables=['leads','deals','tasks','emails','whatsapp_messages','woo_orders','quotes','invoices','calls','cellular_calls','whatsapp_calls','interactions'] as const;
  const summaries=await Promise.all(contacts.map(async contact=>{
    const counts:Record<string,number|null>={};
    await Promise.all(tables.map(async table=>{
      if(!caller.manager && ['whatsapp_messages','woo_orders','quotes','invoices','calls','cellular_calls','whatsapp_calls','interactions'].includes(table)){counts[table]=null;return;}
      let query=caller.admin.from(table).select('id',{count:'exact',head:true}).eq('contact_id',contact.id);
      if(!caller.manager && ['leads','deals','tasks'].includes(table))query=query.eq('assigned_to',caller.id);
      const {count,error}=await query; if(error||!Number.isInteger(count)||count<0)reject(503,'Contact comparison summaries are unavailable.');counts[table]=count;
    }));
    if(caller.manager){for(const field of ['contact_id','organization_id']){const {count,error}=await caller.admin.from('contact_organizations').select('id',{count:'exact',head:true}).eq(field,contact.id);if(error||!Number.isInteger(count)||count<0)reject(503,'Organization comparison counts are unavailable.');counts[field==='contact_id'?'organization_memberships':'organization_members']=count;}}else{counts.organization_memberships=null;counts.organization_members=null;}
    let activity:any[]=[];
    if(caller.manager){const {data,error}=await caller.admin.from('interactions').select('id,type,direction,timestamp').eq('contact_id',contact.id).order('timestamp',{ascending:false}).limit(10);if(error)reject(503,'Contact comparison activity is unavailable.');activity=data||[];}
    return {contact,counts,activity,activityRestricted:!caller.manager,identityEvidence:'Provider account ownership is not verified by matching CRM fields.'};
  }));
  return {success:true,items:summaries,evidence:matchingEvidence(contacts[0],contacts[1]),readOnly:true};
}
