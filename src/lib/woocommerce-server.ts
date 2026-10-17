import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export class WooError extends Error { constructor(public status: number, message: string) { super(message); } }
const text = (value: unknown, max = 255) => typeof value === 'string' ? value.slice(0, max) : '';
const amount = (value: unknown) => { const n = Number(value); if (!Number.isFinite(n) || Math.abs(n) > 1e12) throw new WooError(502, 'Store returned an invalid amount.'); return n; };
export function adminClient() {
  const url = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new WooError(503, 'WooCommerce storage is unavailable.');
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function safeHeaders(res: VercelResponse) { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); }
export async function authenticateWoo(req: VercelRequest) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !/^Bearer \S+$/.test(header) || header.length > 8192) throw new WooError(401, 'Authentication required.');
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(header.slice(7));
  if (error || !data?.user) throw new WooError(401, 'Invalid or expired session.');
  const profile = await admin.from('user_profiles').select('id,role,is_active').eq('id', data.user.id).maybeSingle();
  if (profile.error) throw new WooError(503, 'WooCommerce access is unavailable.');
  if (profile.data?.id !== data.user.id || profile.data?.is_active !== true || !['owner','manager'].includes(profile.data.role)) throw new WooError(403, 'WooCommerce access requires an active owner or manager.');
  return admin;
}
export function verifyCron(req: VercelRequest) {
  const expected = process.env.CRON_SECRET;
  const actual = req.headers.authorization;
  if (!expected || typeof actual !== 'string') throw new WooError(401, 'Cron authentication required.');
  const a = Buffer.from(actual), b = Buffer.from(`Bearer ${expected}`);
  if (a.length !== b.length || !timingSafeEqual(a,b)) throw new WooError(401, 'Cron authentication required.');
}
export function storeConfig() {
  try {
    const u = new URL(process.env.WC_STORE_URL || '');
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash || u.pathname !== '/' || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) || /(^|\.)(localhost|local|internal)$/.test(u.hostname)) throw new Error();
    const key = process.env.WC_CONSUMER_KEY, secret = process.env.WC_CONSUMER_SECRET;
    if (!key || !secret) throw new Error();
    return { origin: u.origin, authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`, identity: createHash('sha256').update(u.origin).digest('hex') };
  } catch { throw new WooError(503, 'WooCommerce store credentials are not configured correctly.'); }
}
export async function provider(path: string, params: Record<string,string> = {}) {
  const config = storeConfig();
  if (!/^(orders(?:\/\d+)?|customers|products)$/.test(path)) throw new WooError(400, 'Invalid store resource.');
  const url = new URL(`/wp-json/wc/v3/${path}`, config.origin);
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key,value);
  const observedAt=new Date().toISOString();
  const abort = new AbortController(); const timeout = setTimeout(()=>abort.abort(),12000);
  try {
    const response = await fetch(url, { headers: { Authorization: config.authorization, Accept:'application/json' }, redirect:'error', signal:abort.signal });
    if (!response.ok) throw new WooError(response.status === 401 || response.status === 403 ? 502 : 503, `Store rejected the request (HTTP ${response.status}). Check WooCommerce permissions and store security rules.`);
    if (Number(response.headers.get('content-length') || 0)>4_000_000) throw new WooError(502,'Store response is too large.');
    const reader = response.body?.getReader(); if (!reader) throw new WooError(502,'Store returned an empty response.');
    const chunks: Uint8Array[]=[]; let length=0;
    try { while(true) { const next=await reader.read(); if(next.done)break; length+=next.value.length; if(length>4_000_000)throw new WooError(502,'Store response is too large.'); chunks.push(next.value); } } finally { await reader.cancel().catch(()=>{}); }
    let data; try { data=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new WooError(502,'Store returned an invalid response.'); }
    return { data, observedAt, pages: Math.max(1,Number(response.headers.get('x-wp-totalpages'))||1), total:Number(response.headers.get('x-wp-total'))||0 };
  } catch (e) { if(e instanceof WooError)throw e; throw new WooError(503,'Store request failed. Try again later.'); } finally { clearTimeout(timeout); }
}
function date(value: unknown, required=false) {
  if (!value && !required)return null;
  const raw=text(value,40); const parsed = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/.test(raw) ? Date.parse(raw.endsWith('Z')?raw:`${raw}Z`):NaN;
  if(!Number.isFinite(parsed))throw new WooError(502,'Store returned an invalid order timestamp.'); return new Date(parsed).toISOString();
}
export function projectOrder(o:any) {
  if(!o || !Number.isSafeInteger(o.id) || o.id<1 || !/^[a-z0-9][a-z0-9_-]{0,49}$/.test(o.status) || !/^[A-Z]{3}$/.test(o.currency))throw new WooError(502,'Store returned an invalid order.');
  if(!Array.isArray(o.line_items) || o.line_items.length>500 || !Array.isArray(o.refunds || []) || (o.refunds||[]).length>500)throw new WooError(502,'Store order exceeds supported limits.');
  const address=(a:any)=>[a?.address_1,a?.address_2,a?.city,a?.state,a?.postcode,a?.country].filter(v=>typeof v==='string').join(', ').slice(0,2000);
  const email=text(o.billing?.email).trim().toLowerCase();
  return { woo_order_id:String(o.id), order_number:text(String(o.number||o.id),100), contact_id:null as string|null,
    customer_name:`${text(o.billing?.first_name,120)} ${text(o.billing?.last_name,120)}`.trim(), customer_email:email,
    customer_phone:text(o.billing?.phone,50), company:text(o.billing?.company), billing_address:address(o.billing), shipping_address:address(o.shipping),
    subtotal:o.line_items.reduce((sum:number,i:any)=>sum+amount(i.subtotal||0),0),tax_amount:amount(o.total_tax||0),shipping_amount:amount(o.shipping_total||0),
    total_amount:amount(o.total),currency:o.currency,status:o.status,payment_method:text(o.payment_method_title,50),order_notes:text(o.customer_note,5000),
    line_items:o.line_items.map((i:any)=>({name:text(i.name,500),quantity:amount(i.quantity),price:amount(i.price||0),total:amount(i.total||0)})),
    provider_created_at:date(o.date_created_gmt,true),provider_modified_at:date(o.date_modified_gmt,true),date_paid:date(o.date_paid_gmt),date_completed:date(o.date_completed_gmt),
    refund_amount:(o.refunds||[]).reduce((sum:number,r:any)=>sum+Math.abs(amount(r.total)),0) };
}
export async function saveOrder(admin:any, raw:any, observedAt:string) {
  const row=projectOrder(raw);
  // Exact equality cannot inject PostgREST OR expressions; ambiguous matches stay unlinked.
  if(row.customer_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.customer_email)) {
    const contacts=await admin.from('contacts').select('id').eq('email',row.customer_email).limit(2);
    if(contacts.error)throw new WooError(503,'Contact lookup failed; sync will retry.');
    if(contacts.data?.length===1)row.contact_id=contacts.data[0].id;
  }
  const saved=await admin.rpc('woo_save_order',{snapshot:{...row,snapshot_observed_at:observedAt},store_identity:storeConfig().identity});
  if(saved.error)throw new WooError(503,'Order could not be saved; sync will retry.');
  return saved.data === true;
}
export function displayOrder(row:any) {
  return { id:`wc_${row.woo_order_id}`,orderId:Number(row.woo_order_id),orderNumber:text(row.order_number||row.woo_order_id,100),
    status:text(row.status,50),pipelineStage:row.status==='completed'?'Delivered':null, customerName:text(row.customer_name),customerEmail:text(row.customer_email),
    customerPhone:text(row.customer_phone,50),company:text(row.company),address:text(row.billing_address,2000),total:Number(row.total_amount)||0,currency:/^[A-Z]{3}$/.test(row.currency)?row.currency:'JMD',
    lineItems:(Array.isArray(row.line_items)?row.line_items:[]).slice(0,500).map((i:any)=>({name:text(i.name,500),quantity:Number.isFinite(Number(i.quantity))?Number(i.quantity):0,price:Number.isFinite(Number(i.price))?Number(i.price):0,total:Number.isFinite(Number(i.total))?Number(i.total):0})),dateCreated:row.provider_created_at||row.created_at,dateModified:row.provider_modified_at,
    paymentMethod:text(row.payment_method,50),notes:text(row.order_notes,5000),refundAmount:Number(row.refund_amount)||0,datePaid:row.date_paid,contactId:row.contact_id };
}
export async function syncBatch(admin:any) {
  const identity=storeConfig().identity, token=randomUUID();
  const claimed=await admin.rpc('woo_claim_sync',{token,store_identity:identity});
  if(claimed.error)throw new WooError(503,'Sync state unavailable. Check the reviewed database migration and store identity.');
  const state=claimed.data?.[0];
  if(!state)throw new WooError(409,'A sync is running or waiting to retry. Try again later.');
  let checked=0,saved=0; const deadline=Date.now()+45000;
  try {
    const params:Record<string,string>={per_page:'25',page:String(state.page),orderby:'id',order:'desc',before:state.window_before};
    if(state.mode==='catchup') { delete params.before; params.modified_before=state.window_before; if(state.modified_after)params.modified_after=state.modified_after; }
    const result=await provider('orders',params);
    if(!Array.isArray(result.data)||result.data.length>25)throw new WooError(502,'Store returned an invalid order page.');
    for(const order of result.data) { if(Date.now()>deadline)throw new WooError(503,'Batch time limit reached; saved orders retained and this page will retry.'); if(await saveOrder(admin,order,result.observedAt))saved++; checked++; }
    const done=state.page>=result.pages || result.data.length<25;
    const next={...state,mode:done?'catchup':state.mode,page:done?1:state.page+1,
      modified_after:done?new Date(Date.parse(state.window_before)-300000).toISOString():state.modified_after,
      window_before:done?null:state.window_before,last_success_at:new Date().toISOString(),last_error:null,failures:0,retry_after:null};
    const finish=await admin.rpc('woo_finish_sync',{token,next_state:next});
    if(finish.error||finish.data!==true)throw new WooError(503,'Sync lease expired; this batch will be checked again.');
    return {success:true,checked,saved,unchanged:checked-saved,complete:done,mode:next.mode,nextPage:next.page};
  } catch(e) {
    const failure={...state,last_error:'Batch failed; saved orders retained.',failures:Math.min((state.failures||0)+1,10),retry_after:new Date(Date.now()+Math.min(3600,30*2**Math.min(state.failures||0,7))*1000).toISOString()};
    await admin.rpc('woo_finish_sync',{token,next_state:failure}); throw e;
  }
}
export function sendError(res:VercelResponse,error:unknown) { return res.status(error instanceof WooError?error.status:503).json({success:false,error:error instanceof WooError?error.message:'WooCommerce is temporarily unavailable.'}); }
