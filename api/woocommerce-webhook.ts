import type { VercelRequest,VercelResponse } from '@vercel/node';
import { createHmac,timingSafeEqual } from 'node:crypto';
import { adminClient,provider,safeHeaders,saveOrder,sendError,WooError } from '../src/lib/woocommerce-server.js';
export const config={api:{bodyParser:false}};
export function verifySignature(bytes:Buffer,signature:unknown,secret:string|undefined) {
  if(!secret || typeof signature!=='string' || !/^[A-Za-z0-9+/]{43}=$/.test(signature))return false;
  const expected=createHmac('sha256',secret).update(bytes).digest(); const supplied=Buffer.from(signature,'base64');
  return supplied.length===expected.length && timingSafeEqual(supplied,expected);
}
export default async function handler(req:VercelRequest,res:VercelResponse) {
  safeHeaders(res);
  try {
    if(req.method!=='POST')throw new WooError(405,'POST required.');
    if(!process.env.WC_WEBHOOK_SECRET)throw new WooError(503,'Webhook verification is not configured.');
    const signature=req.headers['x-wc-webhook-signature'];
    if(typeof signature!=='string' || !/^[A-Za-z0-9+/]{43}=$/.test(signature))throw new WooError(401,'Invalid webhook signature.');
    if(Number(req.headers['content-length']||0)>1_000_000)throw new WooError(413,'Webhook payload too large.');
    const chunks:Buffer[]=[];let length=0;
    // Never reconstruct JSON: Woo signs the exact bytes, including whitespace.
    for await(const chunk of req) { const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);length+=bytes.length;if(length>1_000_000)throw new WooError(413,'Webhook payload too large.');chunks.push(bytes); }
    const bytes=Buffer.concat(chunks);
    if(!verifySignature(bytes,signature,process.env.WC_WEBHOOK_SECRET))throw new WooError(401,'Invalid webhook signature.');
    const topic=req.headers['x-wc-webhook-topic'];
    if(typeof topic!=='string'||!['order.created','order.updated'].includes(topic))throw new WooError(400,'Unsupported webhook topic.');
    let body;try{body=JSON.parse(bytes.toString('utf8'));}catch{throw new WooError(400,'Invalid webhook JSON.');}
    if(!Number.isSafeInteger(body?.id)||body.id<1)throw new WooError(400,'Invalid order ID.');
    const result=await provider(`orders/${body.id}`);
    if(result.data?.id!==body.id)throw new WooError(502,'Store returned a different order.');
    const saved=await saveOrder(adminClient(),result.data,result.observedAt);
    return res.json({success:true,saved,orderId:body.id});
  }catch(e){return sendError(res,e);}
}
