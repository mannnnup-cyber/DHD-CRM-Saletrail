import type {VercelRequest,VercelResponse} from '@vercel/node';
import {authenticateEmail} from '../inbox/email-server.js';
export const whatsappSettingsMethods:Record<string,string>={webhookInfo:'GET',getEvolutionConfig:'GET',webhookConfig:'GET',fullDiagnostics:'GET',diagnostics:'GET',setWebhook:'POST',saveEvolutionConfig:'POST',createInstance:'POST',getQRCode:'POST',getInstanceStatus:'POST',disconnect:'POST',debugSaveInstance:'POST',publishVersion:'POST'};
export const isWhatsAppSettingsAction=(action:unknown):action is string=>typeof action==='string'&&Object.prototype.hasOwnProperty.call(whatsappSettingsMethods,action);
export function settingsFailure(res:VercelResponse,status=503){return res.status(status).json({success:false,error:'Settings operation is unavailable.'});}
export async function settingsOwner(req:VercelRequest,res:VercelResponse,actualDatabaseUrl?:string){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const actor=await authenticateEmail(req,res);if(!actor)return null;res.setHeader('Cache-Control','private, no-store');
 if(!['owner','manager'].includes(actor.role)){res.status(403).json({success:false,error:'Settings require an active owner or manager.'});return null;}
 const expected=process.env.SUPABASE_PROJECT_URL||process.env.SUPABASE_URL;
 if(actualDatabaseUrl!==undefined&&(!expected||actualDatabaseUrl.replace(/\/+$/,'')!==expected.replace(/\/+$/,''))){settingsFailure(res);return null;}
 return actor;
}
