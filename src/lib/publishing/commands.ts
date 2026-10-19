import { createHash } from 'node:crypto';
import {PNG} from 'pngjs';
import jpeg from 'jpeg-js';
import { id, reject, PublishingError, projectMedia, projectPost, text } from './provider.js';
import { rpc, readPost, positiveVersion } from './store.js';

export const digest = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export function validateImage(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > 2097152) reject(400,'Upload a JPEG or PNG no larger than 2 MiB.');
  let width = 0, height = 0;
  if (mime === 'image/png' && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.length >= 24 && bytes.toString('ascii',12,16)==='IHDR') { width=bytes.readUInt32BE(16); height=bytes.readUInt32BE(20); }
  else if (mime==='image/jpeg' && bytes[0]===255 && bytes[1]===216 && bytes[bytes.length-2]===255 && bytes[bytes.length-1]===217) {
    let n=2;
    while(n+9<bytes.length) { if(bytes[n]!==255) break; const marker=bytes[n+1]; if(marker===218) break; const length=bytes.readUInt16BE(n+2); if(length<2 || n+2+length>bytes.length) break; if([192,193,194].includes(marker)){height=bytes.readUInt16BE(n+5);width=bytes.readUInt16BE(n+7);break;} n+=2+length; }
  }
  if (!width || !height || width>10000 || height>10000 || width*height>25000000) reject(400,'Image format or dimensions are invalid. Maximum 25 megapixels.');
  try {const decoded=mime==='image/png'?PNG.sync.read(bytes,{checkCRC:true}):jpeg.decode(bytes,{useTArray:true,formatAsRGBA:false,tolerantDecoding:false,maxResolutionInMP:25,maxMemoryUsageInMB:96});if(decoded.width!==width||decoded.height!==height)throw new Error();}catch{reject(400,'The image is truncated or cannot be decoded safely.');}
  return {width,height,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export function writeGate() { if(process.env.SOCIAL_PUBLISHING_WRITES_ENABLED!=='true') reject(503,'Provider writes are disabled until owner-authorized UAT. Local drafts and approvals remain available.'); }
export async function executeOperation(caller:any, provider:any, options:{kind:string;identity:string;fingerprint:string;post?:any;accountId?:string;send:(operation:any)=>Promise<any>;project:(value:any)=>any}) {
  const claimed = await rpc(caller.admin,'social_claim',{p_workspace:provider.workspace,p_actor:caller.actor,p_kind:options.kind,p_identity:options.identity,p_fingerprint:options.fingerprint,p_post:options.post?.id||null,p_version:options.post?.version||null,p_account:options.accountId||null});
  const operation=claimed.operation;
  if(!claimed.dispatch) {
    if(operation.state==='succeeded') return {replayed:true,result:operation.result,operationId:operation.id};
    reject(409,'This operation is already running, failed or uncertain. Inspect history and reconcile; do not submit another copy.');
  }
  let receiptId:string|null=null;
  try {
    const raw=await options.send(operation);
    // An identity is diagnostic until its entire receipt is verified; never replay the write.
    if(raw?.workspace_id===provider.workspace && typeof raw.id==='string') {
      try { receiptId=id(raw.id); } catch { /* Invalid identities are not retained. */ }
    }
    const result=options.project(raw);
    receiptId=result.id;
    await rpc(caller.admin,'social_finish',{p_workspace:provider.workspace,p_actor:caller.actor,p_operation:operation.id,p_token:operation.lease_token,p_state:'succeeded',p_provider:result.id,p_result:result,p_error:null});
    return {result,operationId:operation.id};
  } catch(error) {
    // Even a successful upstream response with an invalid/unpersisted receipt is uncertain.
    const uncertain=!(error instanceof PublishingError) || error.uncertain || error.status>=500 || error.status===409;
    try { await rpc(caller.admin,'social_finish',{p_workspace:provider.workspace,p_actor:caller.actor,p_operation:operation.id,p_token:operation.lease_token,p_state:uncertain?'uncertain':'failed',p_provider:receiptId,p_result:null,p_error:uncertain?'outcome_unknown':'provider_rejected'}); } catch { /* The durable in-flight lease expires to uncertain; never retry the provider write. */ }
    throw new PublishingError(error instanceof PublishingError?error.status:502,uncertain?'Outcome is uncertain. Do not repeat this publication. Reconcile its known provider ID or ask an owner to inspect Studio.':'Provider rejected this operation. Inspect history before preparing a new intent.',uncertain);
  }
}
export async function uploadImage(caller:any,provider:any,input:any) {
  writeGate();provider.permission('upload_media');
  if(typeof input.base64!=='string' || input.base64.length>2796204 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)) reject(400,'Image encoding is invalid.');
  const bytes=Buffer.from(input.base64,'base64'),mime=input.mime;
  const image=validateImage(bytes,mime),filename=text(input.filename,180).replace(/[^A-Za-z0-9._ -]/g,'_')||'image';
  const title=text(input.title,200),alt=text(input.alt,1000);
  const identity=`upload-${image.sha256}`;
  const result=await executeOperation(caller,provider,{kind:'upload',identity,fingerprint:digest({sha256:image.sha256,mime,filename,title,alt}),send:async()=>{
    const form=new FormData();form.set('file',new Blob([new Uint8Array(bytes)],{type:mime}),filename);form.set('title',title);form.set('alt_text',alt);form.set('idempotency_key',identity);return provider.request('/media/','POST',form);
  },project:(raw:any)=>{const {url,thumbnail,...value}=projectMedia(raw,provider.workspace);if(value.mime!==mime || value.bytes!==bytes.length) throw new PublishingError(502,'Media upload receipt does not match.',true); return {...value,sha256:image.sha256};}});
  const value=result.result;
  // No signed URLs enter durable storage. Completed processing is checked again before scheduling.
  const saved=await caller.admin.from('social_media').upsert({workspace_id:provider.workspace,provider_id:value.id,sha256:image.sha256,filename,mime,bytes:bytes.length,width:image.width,height:image.height,title,alt,created_by:caller.actor},{onConflict:'workspace_id,sha256'}).select('*').single();
  if(saved.error) reject(503,'Upload succeeded but the local mapping is pending. Refresh history; repeating this same upload will recover its mapping.');
  return {success:true,media:saved.data};
}
export async function schedulePost(caller:any,provider:any,input:any) {
  writeGate(); if(caller.role!=='owner') reject(403,'Only an owner may schedule approved content.');provider.permission('create_posts');provider.permission('publish_directly');
  const post=await readPost(caller,provider.workspace,input.id); if(post.version!==positiveVersion(input.version)) reject(409,'Post version changed.');
  const account=provider.account(id(input.accountId));
  if(account.connection!=='connected') reject(409,'Reconnect the account in BrightBean before scheduling.');
  const snapshot=post.snapshot;
  if(snapshot.firstComment&&!account.firstComment)reject(400,'This account does not support a first comment.');
  if(!snapshot.accounts.some((a:any)=>a.id===account.id && a.platform===account.platform)) reject(403,'Account is not in this revision.');
  if(snapshot.caption.length>account.charLimit || !snapshot.scheduledAt || Date.parse(snapshot.scheduledAt)<Date.now()+120000) reject(400,'Check caption length and choose a time at least two minutes ahead.');
  if(!snapshot.media.length && account.requiresMedia) reject(400,'This account requires an approved image.');
  for(const media of snapshot.media){const raw=await provider.request(`/media/${id(media.providerId)}`);const found=projectMedia(raw,provider.workspace);if(found.id!==media.providerId||found.status!=='completed' || !['image/jpeg','image/png'].includes(found.mime)) reject(409,'Media is not ready.');const local=await caller.admin.from('social_media').select('sha256,width,height,provider_id,version,bytes,mime').eq('workspace_id',provider.workspace).eq('id',media.id).single();if(local.error||local.data?.sha256!==media.sha256||local.data.provider_id!==media.providerId||local.data.version!==media.version||local.data.bytes!==found.bytes||local.data.mime!==found.mime) reject(409,'Media version changed.');const ratio=local.data.width/local.data.height;if(account.platform==='instagram'&&(ratio<0.8||ratio>1.91)) reject(400,'Instagram image must have an aspect ratio between 4:5 and 1.91:1.');}
  const payload={social_account_id:account.id,caption:snapshot.caption,first_comment:snapshot.firstComment,title:'',media_asset_ids:snapshot.media.map((m:any)=>m.providerId),action:'schedule',scheduled_at:snapshot.scheduledAt,internal_notes:`FollOps ${post.id} revision ${post.version}`};
  const identity=`schedule-${post.id}-${post.version}-${account.id}`;
  return {success:true,...await executeOperation(caller,provider,{kind:'create_schedule',identity,fingerprint:digest(payload),post,accountId:account.id,send:()=>provider.request('/posts/','POST',{...payload,idempotency_key:identity}),project:(raw:any)=>{const projected=projectPost(raw,provider);if(projected.children.length!==1||projected.children[0].accountId!==account.id||projected.caption!==snapshot.caption||projected.firstComment!==snapshot.firstComment||projected.scheduledAt!==snapshot.scheduledAt)throw new PublishingError(502,'Publication receipt does not match approval.',true);return projected;}})};
}
export async function deliveryCommand(caller:any,provider:any,input:any,kind:'cancel'|'reconcile') {
  if(kind==='cancel'){writeGate();if(caller.role!=='owner')reject(403,'Only an owner may cancel a schedule.');provider.permission('create_posts');}
  const post=await readPost(caller,provider.workspace,input.id);if(post.version!==positiveVersion(input.version))reject(409,'Post version changed.');
  const account=provider.account(id(input.accountId));
  const saved=await caller.admin.from('social_deliveries').select('*').eq('post_id',post.id).eq('version',post.version).eq('account_id',account.id).maybeSingle();
  if(saved.error||!saved.data)reject(409,'No known provider delivery exists. Use owner recovery for an uncertain creation.');
  const providerId=id(saved.data.provider_id);
  const pendingCancel=await caller.admin.from('social_operations').select('id').eq('post_id',post.id).eq('version',post.version).eq('account_id',account.id).eq('kind','cancel').eq('state','uncertain').limit(1);
  if(pendingCancel.error)reject(503,'Delivery history is unavailable.');
  const identity=`${kind}-${post.id}-${post.version}-${account.id}-${id(input.requestId)}`;
  return {success:true,...await executeOperation(caller,provider,{kind,identity,fingerprint:digest({providerId,kind}),post,accountId:account.id,send:async()=>{
    const before=projectPost(await provider.request(`/posts/${providerId}`),provider);
    if(before.id!==providerId||before.children.length!==1||before.children[0].accountId!==account.id)throw new PublishingError(502,'Delivery scope changed.',true);
    if(kind==='reconcile')return before;
    if(before.children[0].status==='published')return before;
    if(!['scheduled','draft'].includes(before.children[0].status))reject(409,'This delivery cannot currently be cancelled.');
    const raw=await provider.request(`/posts/${providerId}/cancel`,'POST');return projectPost(raw,provider);
  },project:(value:any)=>{if(value.id!==providerId||value.children.length!==1||value.children[0].accountId!==account.id)throw new PublishingError(502,'Delivery receipt changed.',true);if(kind==='reconcile'&&value.children[0].status==='draft'&&(saved.data.status==='cancelled'||pendingCancel.data?.length))value.children[0].status='cancelled';return value;}})};
}
export async function recoverOperation(caller:any,provider:any,input:any) {
  if(caller.role!=='owner'||input.mediaAndScheduleChecked!==true)reject(403,'An owner must check the image, account and schedule in Studio before recovery.');
  const known=projectPost(await provider.request(`/posts/${id(input.providerId)}`),provider);
  if(known.id!==input.providerId)reject(502,'Provider identity changed.');
  return {success:true,result:await rpc(caller.admin,'social_recover',{p_workspace:provider.workspace,p_actor:caller.actor,p_operation:id(input.operationId),p_result:known})};
}
