import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminClient, authenticateWoo, displayOrder, provider, safeHeaders, sendError, storeConfig, syncBatch, verifyCron, WooError } from '../src/lib/woocommerce-server.js';

export default async function handler(req: VercelRequest,res: VercelResponse) {
  safeHeaders(res);
  if(req.method==='OPTIONS') { res.setHeader('Allow','GET, POST, OPTIONS'); return res.status(204).end(); }
  try {
    const action=typeof req.query.action==='string'?req.query.action:'';
    if(action==='cron') {
      if(req.method!=='GET')throw new WooError(405,'GET required.');
      verifyCron(req); return res.json(await syncBatch(adminClient()));
    }
    const admin=await authenticateWoo(req);
    const writes=['syncOrders'];
    if(req.method!==(writes.includes(action)?'POST':'GET'))throw new WooError(405,writes.includes(action)?'POST required.':'GET required.');
    if(action==='configured') { let configured=false,storeUrl=null; try {storeUrl=storeConfig().origin;configured=true;}catch{} return res.json({success:true,configured,storeUrl}); }
    if(action==='syncOrders')return res.json(await syncBatch(admin));
    if(action==='syncStatus') {
      const result=await admin.from('woo_sync_state').select('mode,page,last_success_at,last_error,failures,retry_after,lease_until').eq('id','orders').single();
      if(result.error)throw new WooError(503,'Sync state is unavailable.'); return res.json({success:true,state:result.data});
    }
    if(action==='test') { await provider('orders',{per_page:'1'}); return res.json({success:true,store:{name:'WooCommerce',url:storeConfig().origin}}); }
    const parse=(value:unknown,fallback:number,max:number)=> { if(value===undefined)return fallback; if(typeof value!=='string'||!/^\d{1,7}$/.test(value)||Number(value)<1||Number(value)>max)throw new WooError(400,'Invalid pagination.'); return Number(value); };
    const page=parse(req.query.page,1,1000000),perPage=parse(req.query.per_page,50,100);
    if(action==='orders') {
      let query=admin.from('woo_orders').select('*',{count:'exact'});
      if(req.query.status && req.query.status!=='any') { if(typeof req.query.status!=='string'||!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(req.query.status))throw new WooError(400,'Invalid status.'); query=query.eq('status',req.query.status); }
      for(const [parameter,op] of [['after','gte'],['before','lte']] as const) if(req.query[parameter]) { const value=req.query[parameter]; if(typeof value!=='string'||value.length>40||!Number.isFinite(Date.parse(value)))throw new WooError(400,'Invalid date.'); query=query[op]('provider_created_at',value); }
      const result=await query.order('provider_created_at',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).range((page-1)*perPage,page*perPage-1);
      if(result.error)throw new WooError(503,'Stored orders could not be loaded.');
      return res.json({success:true,total:result.count||0,pages:Math.max(1,Math.ceil((result.count||0)/perPage)),orders:(result.data||[]).map(displayOrder),source:'saved'});
    }
    if(action==='customers'||action==='products') {
      const result=await provider(action,{page:String(page),per_page:String(perPage)});
      if(!Array.isArray(result.data)||result.data.length>perPage)throw new WooError(502,'Invalid store response.');
      const bound=(v:unknown,max=255)=>typeof v==='string'?v.slice(0,max):'';
      if(action==='products')return res.json({success:true,products:result.data.map((p:any)=>({id:p.id,name:bound(p.name),price:Number(p.price)||0,category:bound(p.categories?.[0]?.name),status:bound(p.status)}))});
      return res.json({success:true,total:result.total,pages:result.pages,customers:result.data.map((c:any)=>({id:`wc_customer_${c.id}`,wcId:c.id,name:`${bound(c.first_name,120)} ${bound(c.last_name,120)}`.trim(),email:bound(c.email),phone:bound(c.billing?.phone,50),company:bound(c.billing?.company),address:bound(c.billing?.address_1),totalSpent:Number(c.total_spent)||0,ordersCount:Number(c.orders_count)||0,dateRegistered:bound(c.date_created,40),avatarUrl:''}))});
    }
    throw new WooError(400,'Unknown WooCommerce action.');
  } catch(e) { return sendError(res,e); }
}
