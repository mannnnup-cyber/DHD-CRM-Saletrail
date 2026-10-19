import {id,reject,text} from './provider.js';
import {readPost} from './store.js';
export async function postAnalytics(caller:any,provider:any,postId:unknown){
 provider.permission('view_analytics');const post=await readPost(caller,provider.workspace,postId);
 const saved=await caller.admin.from('social_deliveries').select('*').eq('post_id',post.id).eq('version',post.version).limit(2);if(saved.error)reject(503,'Delivery mappings are unavailable.');
 const platforms=[];
 for(const delivery of saved.data||[]){const account=provider.account(delivery.account_id);const result=await provider.request(`/analytics/posts/${id(delivery.provider_id)}`);
  if(result.workspace_id!==provider.workspace||result.post_id!==delivery.provider_id||!Array.isArray(result.platform_posts)||result.platform_posts.length!==1)reject(502,'Analytics scope could not be verified.');
  const row=result.platform_posts[0];if(row.social_account_id!==account.id||row.platform!==account.platform)reject(502,'Analytics account could not be verified.');
  const available=row.analytics_available===true;
  platforms.push({accountId:account.id,platform:account.platform,available,reason:available?(Array.isArray(row.metric_tiles)&&row.metric_tiles.length?'':'No provider metrics have been collected yet.'):'Metrics are unavailable for this account.',capturedAt:typeof row.captured_at==='string'&&Number.isFinite(Date.parse(row.captured_at))?row.captured_at:null,metrics:available&&Array.isArray(row.metric_tiles)?row.metric_tiles.slice(0,20).map((m:any)=>({key:text(m.key,60),label:text(m.label,100),kind:text(m.kind,30),value:typeof m.value==='number'&&Number.isFinite(m.value)?m.value:null})):[]});
 }
 return {success:true,postId:post.id,platforms,attribution:'Engagement does not establish revenue attribution.'};
}
export function attributionInput(input:any){const evidence=text(input.evidence,1001);if(!evidence.trim()||evidence.length>1000||(!input.contactId&&!input.dealId))reject(400,'Link a contact or deal and describe the evidence.');return {campaignId:id(input.campaignId),contactId:input.contactId?id(input.contactId):null,dealId:input.dealId?id(input.dealId):null,evidence};}
export function trackableLink(raw:string,campaignId:string,platform:string){const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Use an HTTPS destination without embedded credentials.');url.searchParams.set('utm_source',platform==='instagram'?'instagram':'facebook');url.searchParams.set('utm_medium','social');url.searchParams.set('utm_campaign',id(campaignId));return url.href;}
