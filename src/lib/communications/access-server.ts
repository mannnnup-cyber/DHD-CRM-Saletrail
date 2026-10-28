import {createClient} from '@supabase/supabase-js';
import type {VercelRequest,VercelResponse} from '@vercel/node';
export class CommunicationsError extends Error{constructor(public status:number,message:string){super(message);}}
const deny=(status:number,message:string):never=>{throw new CommunicationsError(status,message);};
export const browserWhatsAppMethods:Record<string,string>={
 status:'GET',webhookInfo:'GET',getEvolutionConfig:'GET',chats:'GET',chatsFromDb:'GET',messages:'GET',messageCount:'GET',mediaProxy:'GET',searchMessages:'GET',getCalls:'GET',getAllCalls:'GET',searchUnified:'GET',webhookConfig:'GET',getChatStatuses:'GET',fullDiagnostics:'GET',diagnostics:'GET',getDevices:'GET',getInsights:'GET',getGSMCalls:'GET',getForwardStatus:'GET',
 getQRCode:'POST',getInstanceStatus:'POST',setWebhook:'POST',saveEvolutionConfig:'POST',sendReaction:'POST',send:'POST',sendAudio:'POST',sendFile:'POST',sendMedia:'POST',readChat:'POST',bulkUpdateChats:'POST',createInstance:'POST',initiateCall:'POST',disconnect:'POST',debugSaveInstance:'POST',syncEvolutionMessages:'POST',updateChatStatus:'POST',syncContactNames:'POST',publishVersion:'POST',updateDeviceName:'POST',sendForwardCommand:'POST'};
export const machineWhatsAppMethods:Record<string,string>={addGSMCall:'POST',addWhatsAppCall:'POST',getDeviceCommands:'GET',ackCommand:'POST'};
export const publicWhatsAppMethods:Record<string,string>={getLatestRelease:'GET',checkVersion:'GET'};
const own=(table:Record<string,string>,action:string)=>Object.prototype.hasOwnProperty.call(table,action);
export function classifyWhatsApp(req:VercelRequest){
 const action=req.query.action;
 if(action===undefined&&req.method==='POST')return 'webhook';
 if(typeof action!=='string'||!action)return deny(400,'Unknown communications action.');
 const table=own(browserWhatsAppMethods,action)?browserWhatsAppMethods:own(machineWhatsAppMethods,action)?machineWhatsAppMethods:own(publicWhatsAppMethods,action)?publicWhatsAppMethods:null;
 if(!table)return deny(400,'Unknown communications action.');
 if(req.method!==table[action])return deny(405,table[action]+' required.');
 return table===browserWhatsAppMethods?'browser':table===machineWhatsAppMethods?'machine':'public';
}
export async function communicationsOwner(req:VercelRequest,res:VercelResponse,actualDatabaseUrl?:string){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const header=req.headers.authorization;if(typeof header!=='string'||!/^Bearer \S+$/.test(header)||header.length>8192)deny(401,'Authentication required.');
 const url=process.env.SUPABASE_PROJECT_URL||process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,secret=process.env.SUPABASE_SECRET_KEY;
 if(!url||!anon||!secret)deny(503,'Communications access is unavailable.');
 if(actualDatabaseUrl!==undefined&&actualDatabaseUrl.replace(/\/+$/,'')!==url.replace(/\/+$/,''))deny(503,'Communications database configuration is inconsistent.');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},auth=createClient(url,anon,options),admin=createClient(url,secret,options);
 const {data,error}=await auth.auth.getUser(header.slice(7));if(error||!data?.user)deny(401,'Invalid or expired session.');
 const {data:profile,error:profileError}=await admin.from('user_profiles').select('id,email,role,is_active').eq('id',data.user.id).eq('is_active',true).maybeSingle();
 if(profileError)deny(503,'Communications access is unavailable.');if(!profile||profile.id!==data.user.id||profile.is_active!==true||!['owner','manager'].includes(profile.role))deny(403,'Communications require an active owner or manager.');
 return {id:profile.id,email:data.user.email||profile.email||profile.id,admin};
}
export function communicationsFailure(res:VercelResponse,error:unknown){return res.status(error instanceof CommunicationsError?error.status:503).json({success:false,error:error instanceof CommunicationsError?error.message:'Communications access is unavailable.'});}
