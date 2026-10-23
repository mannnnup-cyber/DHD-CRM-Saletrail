import type { VercelRequest, VercelResponse } from '@vercel/node';
import { contactCaller, contactFailure, jsonRequest, permittedContact, scopeContacts, reject, uuid, type ContactCaller } from './auth-server.js';
import { contactCandidates, compareContacts, contactProjection, candidateFilter, literalPattern } from './review-server.js';
import { matchingEvidence } from './review.js';
import { editContact, contactChanges } from './edit-server.js';
const managerOnly=(caller:ContactCaller)=>{if(!caller.manager)reject(403,'This contact operation requires an active owner or manager.');};
export async function handleContactApi(req:VercelRequest,res:VercelResponse){
  if(req.method==='OPTIONS'){res.setHeader('Allow','GET, POST, OPTIONS');return res.status(204).end();}
  try{
    if(!['GET','POST'].includes(req.method||''))reject(405,'Unsupported contact request method.');
    const caller=await contactCaller(req,res);
    const action=req.query.action, id=req.query.id;
    if(Array.isArray(action))reject(400,'Invalid contact action.');
    if(req.method==='POST')jsonRequest(req);
    if(action==='editIdentity')return editContact(req,res,caller);
    const writes=['resolve','update','migrate','mergeContacts','enrichLead','enrichContacts','previewEnrichment','linkOrder','addNote'];
    if(writes.includes(String(action)) && req.method!=='POST')reject(405,'POST required.');
    if(['mergeContacts','enrichLead','enrichContacts','previewEnrichment','migrate'].includes(String(action))){managerOnly(caller);reject(409,'This legacy merge or enrichment operation is disabled pending a reviewed preservation workflow. No contact has been changed.');}
    if(action==='compare'){
      if(req.method!=='GET')reject(405,'GET required.');
      return res.json(await compareContacts(caller,[req.query.left,req.query.right]));
    }
    if(['duplicateCandidates','findDuplicates','checkBeforeEnrich'].includes(String(action))){
      const source=req.method==='POST'?req.body:req.query;
      const current=await permittedContact(caller,source.contactId||id);
      const identity={...current};
      if(req.method==='POST' && source.fields){try{Object.assign(identity,contactChanges(source.fields));}catch{reject(400,'Invalid candidate fields.');}}
      if(source.matchScope!==undefined&&!['identifiers','discovery'].includes(source.matchScope))reject(400,'Invalid candidate scope.');
      const matchScope=source.matchScope||'discovery';
      const result=await contactCandidates(caller,current.id,identity,source.cursor,matchScope==='discovery');
      return res.json({success:true,...result,matchScope,duplicates:result.candidates,conflicts:result.candidates,hasConflicts:result.visibleCount>0,guidance:'Only contacts you may review are shown. Ask a manager for further review; matching fields alone do not prove the same identity.'});
    }
    if(action==='getDetectionStatus'){if(req.method!=='GET')reject(405,'GET required.');return res.json({success:true,unmergedDuplicates:[],count:0,available:false,guidance:'Saved duplicate decisions are not available in this review-only release.'});}
    if(action==='resolve'){
      managerOnly(caller);
      const {name='Unknown',email='',phone='',company='',source='MANUAL'}=req.body;
      if(typeof source!=='string'||!['MANUAL','WOOCOMMERCE','CSV_IMPORT','WHATSAPP','WEBSITE','GSM'].includes(source))reject(400,'Invalid contact source.');
      const changes=contactChanges({name,email,phone,company});if(!changes.email&&!changes.phone)reject(400,'An email or phone is required.');
      const filter=candidateFilter(changes,false);
      const {data,error}=await caller.admin.from('contacts').select('id,name,email,phone').or(filter).limit(2);
      if(error)reject(503,'Contact resolution is unavailable.');
      if(data?.length>1)reject(409,'More than one contact matches. Review candidates before linking.');
      if(data?.length===1){if(matchingEvidence(changes,data[0]).conflictingFields.some(field=>['email','phone'].includes(field)))reject(409,'The matching contact has conflicting identifiers. Review before linking.');return res.json({id:data[0].id,created:false});}
      const {data:created,error:failure}=await caller.admin.from('contacts').insert({...changes,source,sources:[source],status:'NEW'}).select('id').single();
      if(failure)reject(503,'Contact creation failed.');return res.json({id:created.id,created:true});
    }
    if(action==='addNote'){
      const contact=await permittedContact(caller,id);const content=req.body.content;
      if(typeof content!=='string'||!content.trim()||content.length>8000)reject(400,'Provide a note of at most 8000 characters.');
      const {error}=await caller.admin.from('interactions').insert({contact_id:contact.id,type:'NOTE',direction:'OUTBOUND',subject:'Note',content:content.trim(),timestamp:new Date().toISOString()});
      if(error)reject(503,'Could not save note.');return res.json({success:true});
    }
    if(action==='update'){
      managerOnly(caller);await permittedContact(caller,id);const allowed=['contact_preference','notes','status','website_url','timezone','linkedin_url'];
      if(Object.keys(req.body).some(key=>!allowed.includes(key)))reject(400,'Unsupported contact fields.');
      const changes:Record<string,string|null>={};for(const[key,value]of Object.entries(req.body)){if(typeof value!=='string'||value.length>8000)reject(400,'Invalid contact value.');changes[key]=(value as string).trim()||null;}
      if(!Object.keys(changes).length)reject(400,'No contact changes supplied.');
      if(changes.status&&!['NEW','CONTACTED','QUALIFYING','VERIFIED_CUSTOMER','CONVERTED','LOST'].includes(changes.status))reject(400,'Invalid contact status.');
      if(changes.contact_preference&&!['call','whatsapp','email','sms'].includes(changes.contact_preference))reject(400,'Invalid contact preference.');
      for(const field of ['website_url','linkedin_url'])if(changes[field]){try{const url=new URL(changes[field]!);if(!['http:','https:'].includes(url.protocol))throw new Error();}catch{reject(400,'Contact links must use HTTP or HTTPS.');}}
      const {data,error}=await caller.admin.from('contacts').update(changes).eq('id',id).select('id,contact_preference,notes,status,website_url,timezone,linkedin_url').single();
      if(error)reject(503,'Could not save contact.');return res.json({contact:data});
    }
    if(action==='searchOrders'){
      if(req.method!=='GET')reject(405,'GET required.');managerOnly(caller);
      const email=typeof req.query.email==='string'?req.query.email.trim():'',phone=typeof req.query.phone==='string'?req.query.phone.trim():'';
      if((!email&&!phone)||email.length>254||phone.length>30)reject(400,'A bounded email or phone is required.');
      const quoted=(value:string)=>'"'+value.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
      const filters=[];if(email)filters.push('customer_email.ilike.'+quoted(literalPattern(email)));if(phone){const digits=phone.replace(/\D/g,'').slice(-10);if(!digits)reject(400,'Invalid order phone search.');filters.push('customer_phone.ilike.'+quoted('%'+digits+'%'));}
      const {data,error}=await caller.admin.from('woo_orders').select('id,woo_order_id,status,total_amount,currency,customer_name,customer_email,customer_phone,line_items,created_at,contact_id').or(filters.join(',')).order('created_at',{ascending:false}).limit(30);
      if(error)reject(503,'Order search is unavailable.');return res.json({orders:data||[]});
    }
    if(action==='linkOrder'){
      managerOnly(caller);await permittedContact(caller,id);if(!uuid(req.body.orderId))reject(400,'Invalid order ID.');
      const {data:order,error:failure}=await caller.admin.from('woo_orders').select('id,contact_id').eq('id',req.body.orderId).maybeSingle();if(failure)reject(503,'Order link is unavailable.');if(!order)reject(404,'Order is unavailable.');
      if(order.contact_id&&order.contact_id!==id)reject(409,'Order already belongs to another contact. Reassignment requires a separate reviewed workflow.');
      if(order.contact_id===id)return res.json({success:true});
      const {data:linked,error}=await caller.admin.from('woo_orders').update({contact_id:id}).eq('id',order.id).is('contact_id',null).select('id').maybeSingle();if(error)reject(503,'Could not link order.');if(!linked)reject(409,'Order changed during review. Refresh before linking.');return res.json({success:true});
    }
    if(action&&action!=='search')reject(400,'Unknown contact action.');
    if(req.method!=='GET')reject(405,'GET required.');
    if(id){
      const contact=await permittedContact(caller,id,'id,name,email,phone,company,website_url,source,sources,status,notes,tags,total_orders,total_revenue,average_order_value,first_order_date,last_order_date,created_at,contact_preference,timezone,linkedin_url,contact_type,organization_id');
      if(!caller.manager)delete contact.organization_id;
      const interactionsQuery=caller.admin.from('interactions').select('id,type,direction,subject,content,timestamp').eq('contact_id',id).order('timestamp',{ascending:false}).limit(100);
      const {data:interactions,error}=await(caller.manager?interactionsQuery:interactionsQuery.eq('type','NOTE'));if(error)reject(503,'Contact history is unavailable.');
      const gsm=caller.manager?await caller.admin.from('cellular_calls').select('id,phone_number,direction,duration,started_at,rep_name,rep_phone,status').eq('contact_id',id).order('started_at',{ascending:false}).limit(50):{data:[]};
      const orders=caller.manager?await caller.admin.from('woo_orders').select('id,woo_order_id,status,total_amount,currency,customer_name,customer_email,customer_phone,line_items,created_at').eq('contact_id',id).order('created_at',{ascending:false}).limit(20):{data:[]};
      if(gsm.error||orders.error)reject(503,'Contact history is unavailable.');
      return res.json({contact,interactions:interactions||[],gsmCalls:gsm.data||[],wooOrders:orders.data||[],historyScope:caller.manager?'business':'notes-only'});
    }
    const limit=req.query.limit===undefined?50:Number(req.query.limit);if(!Number.isInteger(limit)||limit<1||limit>100)reject(400,'Page size must be 1-100.');
    if(req.query.cursor!==undefined&&!uuid(req.query.cursor))reject(400,'Invalid contact cursor.');
    const text=req.query.search===undefined?'':typeof req.query.search==='string'?req.query.search.trim():null;if(text===null||text.length>200)reject(400,'Invalid contact search.');
    const filter=(query:any)=>{query=scopeContacts(query,caller);if(text){const v='"%'+literalPattern(text).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'%"';query=query.or(`name.ilike.${v},email.ilike.${v},company.ilike.${v},phone.ilike.${v}`);}if(typeof req.query.status==='string'&&req.query.status!=='all')query=query.eq('status',req.query.status);if(typeof req.query.source==='string'&&req.query.source!=='all'){if(!['MANUAL','WOOCOMMERCE','CSV_IMPORT','WHATSAPP','WEBSITE','GSM'].includes(req.query.source))reject(400,'Invalid contact source.');query=query.or(`source.eq.${req.query.source},sources.cs.{${req.query.source}}`);}return query;};
    const {count,error:countError}=await filter(caller.admin.from('contacts').select('id',{count:'exact',head:true}));
    let query=filter(caller.admin.from('contacts').select(contactProjection+',status,total_orders,total_revenue,average_order_value,last_order_date,tags')).order('id',{ascending:true});if(req.query.cursor)query=query.gt('id',req.query.cursor);
    const {data,error}=await query.limit(limit+1);if(error||countError||!Number.isInteger(count)||count<0)reject(503,'Contact list is unavailable.');const page=(data||[]).slice(0,limit);
    return res.json({contacts:page,total:count,nextCursor:(data||[]).length>limit?page[page.length-1].id:null,scope:caller.manager?'business':'assigned'});
  }catch(error){return contactFailure(res,error);}
}
