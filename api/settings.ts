import type {VercelRequest,VercelResponse} from '@vercel/node';
import {settingsOwner,settingsFailure} from '../src/lib/settings/server.js';
import {verifySavedMailbox} from '../src/lib/inbox/mailbox-server.js';
import {isSecretSetting,projectSetting,SETTINGS_MASK,writableSetting,providerOrigin} from '../src/lib/settings/projection.js';

const methods:Record<string,string>={list:'GET',get:'GET',categories:'GET',save:'POST',testEmail:'POST',testResend:'POST',testOpenAI:'POST'};
const keyValid=(key:unknown):key is string=>typeof key==='string'&&/^[A-Z][A-Z0-9_]{0,99}$/.test(key);
export default async function handler(req:VercelRequest,res:VercelResponse){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method==='OPTIONS')return res.status(204).end();
 const action=req.query.action;
 if(typeof action!=='string'||!Object.prototype.hasOwnProperty.call(methods,action))return res.status(400).json({success:false,error:'Unknown settings action.'});
 if(req.method!==methods[action])return res.status(405).json({success:false,error:methods[action]+' required.'});
 const actor=await settingsOwner(req,res);if(!actor)return;
 const admin=actor.admin;
 if(req.method==='POST'&&(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||JSON.stringify(req.body).length>65536))return res.status(400).json({success:false,error:'Provide bounded settings data.'});
 try{
  if(action==='testEmail'){
   try{await verifySavedMailbox(admin);return res.json({success:true,message:'Saved IMAP login verified. No messages were imported.'});}
   catch{return res.status(502).json({success:false,error:'Saved mailbox validation failed. Check the saved credentials and TLS settings.'});}
  }
  if(action==='list'||action==='get'||action==='categories'||action==='save'){
   const {data,error}=await admin.from('app_settings').select('setting_key,setting_value,setting_type,is_encrypted,category,updated_at').order('updated_at',{ascending:false});
   if(error)return res.status(503).json({success:false,error:'Settings are unavailable.'});
   const current=new Map<string,any>();for(const row of data||[])if(typeof row.setting_key==='string'&&!current.has(row.setting_key))current.set(row.setting_key,row);
   if(action==='categories')return res.json({success:true,categories:[...new Set([...current.values()].map(row=>row.category).filter(value=>typeof value==='string'))]});
   if(action==='get'){
    if(!keyValid(req.query.key))return res.status(400).json({success:false,error:'Invalid setting key.'});
    const row=current.get(req.query.key);if(!row)return res.status(404).json({success:false,error:'Setting not found.'});
    return res.json({success:true,setting:projectSetting(row)});
   }
   if(action==='list'){
    const settings:Record<string,string>=Object.create(null),isConfigured:Record<string,boolean>=Object.create(null);
    for(const[key,row]of current){const safe=projectSetting(row);settings[key]=safe.setting_value;isConfigured[key]=safe.isConfigured;}
    return res.json({success:true,settings,isConfigured});
   }
   const values=req.body.settings;
   if(req.body.clearSecrets!==undefined||!values||typeof values!=='object'||Array.isArray(values)||Object.getPrototypeOf(values)!==Object.prototype||Object.keys(values).length>100)return res.status(400).json({success:false,error:'Invalid settings data.'});
   for(const[key,value]of Object.entries(values))if(!keyValid(key)||!writableSetting(key)||typeof value!=='string'||value.length>16384)return res.status(400).json({success:false,error:'Invalid or unsupported settings value.'});
   if(values.EVOLUTION_API_URL!==undefined){const origin=providerOrigin(values.EVOLUTION_API_URL);if(!origin)return res.status(400).json({success:false,error:'Evolution requires a trusted HTTPS origin without credentials, path or query.'});values.EVOLUTION_API_URL=origin;}
   // Preserve the existing blank/masked credential behavior; no new clear workflow.
   for(const key of Object.keys(values)){
    const old=current.get(key),secret=isSecretSetting(key,old),value=values[key];
    if(value===SETTINGS_MASK||secret&&value==='')continue;
    const type=secret?'password':key.includes('PORT')?'number':key.includes('ENABLED')?'boolean':old?.setting_type||'text';
    const payload={setting_value:value,setting_type:type,updated_at:new Date().toISOString()};
    const update=await admin.from('app_settings').update(payload).eq('setting_key',key).select('setting_key');
    if(update.error)return res.status(503).json({success:false,error:'Settings save was not completed. Reload before retrying.'});
    if(!update.data?.length){const inserted=await admin.from('app_settings').insert({setting_key:key,...payload});if(inserted.error)return res.status(503).json({success:false,error:'Settings save was not completed. Reload before retrying.'});}
   }
   return res.json({success:true,message:'Settings saved successfully'});
  }
  const key=action==='testResend'?'RESEND_API_KEY':'OPENAI_API_KEY';let apiKey=req.body.apiKey;
  if(apiKey!==undefined&&(typeof apiKey!=='string'||apiKey.length>16384))return res.status(400).json({success:false,error:'Invalid credential input.'});
  if(!apiKey||apiKey===SETTINGS_MASK){const saved=await admin.from('app_settings').select('setting_value').eq('setting_key',key).order('updated_at',{ascending:false}).limit(1).maybeSingle();if(saved.error)return res.status(503).json({success:false,error:'Saved credential is unavailable.'});apiKey=process.env[key]||saved.data?.setting_value;}
  if(!apiKey)return res.status(400).json({success:false,error:'Save or enter a credential first.'});
  const anthropic=action==='testOpenAI'&&apiKey.startsWith('sk-ant-');
  const url=action==='testResend'?'https://api.resend.com/api-keys':anthropic?'https://api.anthropic.com/v1/models':'https://api.openai.com/v1/models';
  const headers:Record<string,string>=anthropic?{'x-api-key':apiKey,'anthropic-version':'2023-06-01'}:{Authorization:`Bearer ${apiKey}`};
  const response=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(10000)});
  return res.status(response.ok?200:502).json(response.ok?{success:true,message:'Provider credential verified.'}:{success:false,error:'Provider credential validation failed.'});
 }catch{return res.status(503).json({success:false,error:'Settings operation is unavailable.'});}
}
