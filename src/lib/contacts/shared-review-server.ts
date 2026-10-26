import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import type {VercelRequest,VercelResponse} from '@vercel/node';
import {contactCaller,reject,type ContactCaller} from './auth-server.js';
import {contactCandidates} from './review-server.js';
const stable=(value:any):string=>value===undefined?'null':value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(stable).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}';
const digest=(value:any)=>createHash('sha256').update(stable(value)).digest('hex');
const signature=(encoded:string)=>createHmac('sha256',process.env.SUPABASE_SECRET_KEY||'').update('follops/contact-shared-review/v1:'+encoded).digest('base64url');
export interface SharedReview {purpose:'edit'|'create';target:string;fields:any;expected:any;identity:any;}
const complete=(review:any)=>Number.isInteger(review.visibleCount)&&review.visibleCount>0&&review.visibleCount<=20&&!review.nextCursor&&review.candidates.length===review.visibleCount;
const state=(caller:ContactCaller,input:SharedReview,review:any)=>digest({actor:caller.id,purpose:input.purpose,target:input.target,fields:input.fields,expected:input.expected,candidates:review.candidates,visibleCount:review.visibleCount});
export function sharedChallenge(caller:ContactCaller,input:SharedReview,review:any){
  if(!complete(review))return {sharedSaveAvailable:false,sharedSaveGuidance:'All matches must fit one complete review (at most 20). Refine the identifiers before confirming.'};
  const payload={v:1,nonce:randomUUID(),actor:caller.id,purpose:input.purpose,target:input.target,expires:Date.now()+180000,state:state(caller,input,review)};
  const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');
  return {sharedSaveAvailable:true,reviewToken:encoded+'.'+signature(encoded),reviewExpiresAt:payload.expires,reviewTarget:input.target};
}
export async function claimSharedReview(req:VercelRequest,res:VercelResponse,caller:ContactCaller,input:SharedReview,review:any){
  const confirmation=req.body?.sharedReview;
  if(!confirmation||confirmation.decision!=='keep-separate'||typeof confirmation.token!=='string'||confirmation.token.length>3000||typeof confirmation.reason!=='string'||!confirmation.reason.trim()||confirmation.reason.length>500)reject(400,'Explicit reviewed keep-separate confirmation and a bounded reason are required.');
  const [encoded,supplied,...extra]=confirmation.token.split('.');
  const correct=signature(encoded||''),a=Buffer.from(supplied||''),b=Buffer.from(correct);
  if(extra.length||a.length!==b.length||!timingSafeEqual(a,b))reject(409,'Review confirmation is invalid. Review the current matches again.');
  let payload:any;try{payload=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));}catch{reject(409,'Review confirmation is invalid.');}
  if(payload.v!==1||payload.actor!==caller.id||payload.purpose!==input.purpose||payload.target!==input.target||typeof payload.expires!=='number'||payload.expires<Date.now()||payload.expires>Date.now()+180000||!complete(review)||payload.state!==state(caller,input,review))reject(409,'Review expired or the contact, proposal or candidates changed. Review again.');
  const fresh=await contactCaller(req,res);if(!fresh.manager||fresh.id!==caller.id)reject(403,'Shared saves require the same active owner or manager.');
  const metadata={version:1,source:'contact-shared-review',actor_id:caller.id,actor_role:fresh.role,operation_id:payload.nonce,purpose:input.purpose,target_id:input.target,review_state:payload.state,proposed_fields:Object.keys(input.fields),candidate_ids:review.candidates.map((row:any)=>row.id),reason:confirmation.reason.trim(),outcome:'intent',at:new Date().toISOString()};
  // The existing primary key is a durable single-use claim across workers. Intent precedes any contact mutation.
  const {data,error}=await fresh.admin.from('interactions').insert({id:payload.nonce,contact_id:null,type:'NOTE',direction:'OUTBOUND',subject:'Shared identifier review',content:'Explicit keep-separate decision; see protected audit metadata.',metadata,timestamp:metadata.at}).select('id').maybeSingle();
  if(error||data?.id!==payload.nonce)reject(error?.code==='23505'?409:503,'Review could not be claimed or has already been used. No retry is performed; reconcile any prior operation before a new review.');
  const finish=async(outcome:string)=>{try{const {data,error}=await fresh.admin.from('interactions').update({metadata:{...metadata,outcome,completed_at:new Date().toISOString()}}).eq('id',payload.nonce).eq('metadata->>source','contact-shared-review').eq('metadata->>actor_id',caller.id).select('id').maybeSingle();return !error&&data?.id===payload.nonce;}catch{return false;}};
  const check=await contactCandidates(fresh,input.purpose==='edit'?input.target:'00000000-0000-0000-0000-000000000000',input.identity,undefined,false);
  if(!complete(check)||state(fresh,input,check)!==payload.state){await finish('rejected-candidate-drift');reject(409,'Candidates changed during confirmation. No contact was changed. Review again.');}
  try{const finalCaller=await contactCaller(req,res);if(!finalCaller.manager||finalCaller.id!==caller.id)reject(403,'Shared save authorization changed.');}catch(error){await finish('rejected-authorization');throw error;}
  return {admin:fresh.admin,id:payload.nonce,finish};
}
export const newReviewTarget=()=>randomUUID();

export async function sharedMutation(query:any){try{return await query;}catch{return {data:null,error:true};}}
