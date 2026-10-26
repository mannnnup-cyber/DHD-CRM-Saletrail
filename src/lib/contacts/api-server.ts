import type { VercelRequest, VercelResponse } from '@vercel/node';
import { contactCaller, contactFailure, jsonRequest, permittedContact, scopeContacts, basicContactProjection, basicContact, reject, uuid, type ContactCaller } from './auth-server.js';
import { contactCandidates, compareContacts, optionalContactHistory, contactProjection, candidateFilter, literalPattern } from './review-server.js';
import {sharedChallenge,claimSharedReview,newReviewTarget,sharedMutation} from './shared-review-server.js';
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
      let shared:Awaited<ReturnType<typeof claimSharedReview>>|undefined,target:string|undefined;
      if(data?.length){const review=await contactCandidates(caller,'00000000-0000-0000-0000-000000000000',changes,undefined,false);target=req.body.sharedReview?.target||newReviewTarget();const input={purpose:'create' as const,target,fields:{...changes,source},expected:null,identity:changes};if(req.body.sharedReview)shared=await claimSharedReview(req,res,caller,input,review);else return res.status(409).json({code:'CONTACT_REVIEW_REQUIRED',error:'Existing identifiers require deliberate keep-separate review. No contact was reused or created.',...review,...sharedChallenge(caller,input,review)});}
      if(req.body.sharedReview&&!shared)reject(409,'Matching evidence changed. Review again.');
      const {data:created,error:failure}=await sharedMutation((shared?.admin||caller.admin).from('contacts').insert({...changes,...target?{id:target}:{},source,sources:[source],status:'NEW'}).select('id').single());
      if(failure||!created){if(shared)await shared.finish('uncertain-save');return res.status(503).json({code:shared?'SHARED_SAVE_UNCERTAIN':undefined,operationId:shared?.id,error:'Contact creation could not be confirmed. Reconcile before retrying.'});}
      if(shared&&created.id!==target){await shared.finish('uncertain-created-id');return res.status(503).json({code:'SHARED_SAVE_UNCERTAIN',operationId:shared.id,error:'The created identity could not be reconciled with the reviewed target. Do not retry automatically.'});}
      if(shared&&!await shared.finish('confirmed'))return res.status(503).json({code:'SHARED_SAVE_UNCERTAIN',operationId:shared.id,error:'Contact creation may be saved but audit finalization is uncertain. Reconcile before retrying.'});
      return res.json({id:created.id,created:true,keptSeparate:Boolean(shared)});
    }
    if(action==='addNote'){
      const contact=await permittedContact(caller,id);const content=req.body.content;
      if(typeof content!=='string'||!content.trim()||content.length>8000)reject(400,'Provide a note of at most 8000 characters.');
      const {error}=await caller.admin.from('interactions').insert({contact_id:contact.id,type:'NOTE',direction:'OUTBOUND',subject:'Note',content:content.trim(),metadata:{version:1,source:'contact-note',actor_id:caller.id,actor_role:caller.role},...(!caller.manager?{user_id:caller.id}:{}),timestamp:new Date().toISOString()});
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
      const contact=await permittedContact(caller,id,caller.manager?'id,name,email,phone,company,website_url,source,sources,status,notes,tags,total_orders,total_revenue,average_order_value,first_order_date,last_order_date,created_at,contact_preference,timezone,linkedin_url,contact_type,organization_id':basicContactProjection);
      if(!caller.manager){delete contact.organization_id;delete contact.notes;}
      const interactionsQuery=caller.admin.from('interactions').select('id,type,direction,subject,content,timestamp').eq('contact_id',id).order('timestamp',{ascending:false}).limit(100);
      const {data:interactions,error}=await optionalContactHistory(caller.manager?interactionsQuery:interactionsQuery.eq('type','NOTE').eq('metadata->>actor_id',caller.id).eq('metadata->>source','contact-note').eq('metadata->>version','1'));
      const gsm=caller.manager?await optionalContactHistory(caller.admin.from('cellular_calls').select('id,phone_number,call_type,duration_seconds,called_at,rep_name,rep_phone').eq('contact_id',id).order('called_at',{ascending:false}).limit(50)):{data:[]};
      const orders=caller.manager?await optionalContactHistory(caller.admin.from('woo_orders').select('id,woo_order_id,status,total_amount,currency,customer_name,customer_email,customer_phone,line_items,created_at').eq('contact_id',id).order('created_at',{ascending:false}).limit(20)):{data:[]};
      const historyStatus={notes:error?'unavailable':caller.manager?'available':'own-attributed-only',gsm:!caller.manager?'restricted':gsm.error?'unavailable':'available',orders:!caller.manager?'restricted':orders.error?'unavailable':'available'};
      if(!caller.manager)await permittedContact(caller,id,'id');
      return res.json({contact,interactions:error?[]:interactions||[],gsmCalls:gsm.error?[]:(gsm.data||[]).map((row:any)=>({...row,duration:row.duration_seconds,started_at:row.called_at,direction:String(row.call_type||'').toUpperCase()==='INCOMING'?'inbound':String(row.call_type||'').toUpperCase()==='OUTGOING'?'outbound':null})),wooOrders:orders.error?[]:orders.data||[],historyStatus,historyScope:caller.manager?'business':'notes-only'});
    }
    const limit=req.query.limit===undefined?50:Number(req.query.limit);if(!Number.isInteger(limit)||limit<1||limit>100)reject(400,'Page size must be 1-100.');
    if(req.query.cursor!==undefined&&!uuid(req.query.cursor))reject(400,'Invalid contact cursor.');
    const text=req.query.search===undefined?'':typeof req.query.search==='string'?req.query.search.trim():null;if(text===null||text.length>200)reject(400,'Invalid contact search.');
    if(!caller.manager&&req.query.source&&req.query.source!=='all')reject(403,'Contact source history is restricted for this role.');
    const filter=(query:any)=>{query=scopeContacts(query,caller);if(text){const v='"%'+literalPattern(text).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'%"';query=query.or(`name.ilike.${v},email.ilike.${v},company.ilike.${v},phone.ilike.${v}`);}if(typeof req.query.status==='string'&&req.query.status!=='all')query=query.eq('status',req.query.status);if(typeof req.query.source==='string'&&req.query.source!=='all'){if(!['MANUAL','WOOCOMMERCE','CSV_IMPORT','WHATSAPP','WEBSITE','GSM'].includes(req.query.source))reject(400,'Invalid contact source.');query=query.or(`source.eq.${req.query.source},sources.cs.{${req.query.source}}`);}return query;};
    const {count,error:countError}=await filter(caller.admin.from('contacts').select('id',{count:'exact',head:true}));
    let query=filter(caller.admin.from('contacts').select(caller.manager?contactProjection+',status,total_orders,total_revenue,average_order_value,last_order_date,tags':basicContactProjection)).order('id',{ascending:true});if(req.query.cursor)query=query.gt('id',req.query.cursor);
    const {data,error}=await query.limit(limit+1);if(error||countError||!Number.isInteger(count)||count<0)reject(503,'Contact list is unavailable.');const page=(data||[]).slice(0,limit);
    return res.json({contacts:page,total:count,nextCursor:(data||[]).length>limit?page[page.length-1].id:null,scope:caller.manager?'business':'assigned'});
  }catch(error){return contactFailure(res,error);}
}
