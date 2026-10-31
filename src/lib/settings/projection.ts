export const SETTINGS_MASK='••••••••';
const publicKeys=new Set(['IMAP_HOST','IMAP_PORT','IMAP_USER','IMAP_USE_TLS','DEFAULT_FROM_EMAIL','DEFAULT_FROM_NAME','AI_ANALYSIS_ENABLED','AI_SUGGESTIONS_ENABLED','EVOLUTION_API_URL','EVOLUTION_INSTANCE_NAME','EVOLUTION_PHONE','WHATSAPP_ACTIVE_PROVIDER','WOOCOMMERCE_URL','COMPANION_APP_VERSION']);
const writableKeys=new Set(['IMAP_HOST','IMAP_PORT','IMAP_USER','IMAP_PASSWORD','IMAP_USE_TLS','RESEND_API_KEY','DEFAULT_FROM_EMAIL','DEFAULT_FROM_NAME','OPENAI_API_KEY','AI_ANALYSIS_ENABLED','AI_SUGGESTIONS_ENABLED','WOOCOMMERCE_URL','WOOCOMMERCE_KEY','WOOCOMMERCE_SECRET','EVOLUTION_API_URL','EVOLUTION_API_KEY','EVOLUTION_INSTANCE_NAME','EVOLUTION_PHONE','WHATSAPP_ACTIVE_PROVIDER','GREENAPI_INSTANCE_ID','GREENAPI_TOKEN','BRIGHTBEAN_API_KEY','BRIGHTBEAN_API_URL','RECOVERY_FROM_EMAIL','RECOVERY_APP_URL']);
export const writableSetting=(key:string)=>writableKeys.has(key);
// Only an HTTPS DNS origin can be configured; deployment still requires trusted DNS/egress.
export function providerOrigin(value:unknown){
 if(typeof value!=='string'||value.length>2048)return null;
 try{const url=new URL(value),host=url.hostname.toLowerCase();if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!host.includes('.')||!/[a-z]/i.test(host)||!/^[a-z0-9.-]+$/.test(host)||/(?:^|\.)(localhost|local|internal|invalid|test)$/.test(host))return null;return url.origin;}catch{return null;}
}
export function isSecretSetting(key:string,row?:{setting_type?:unknown;is_encrypted?:unknown}){
 return !publicKeys.has(key)||row?.setting_type==='password'||row?.is_encrypted===true;
}
export function projectSetting(row:Record<string,any>){
 const configured=typeof row.setting_value==='string'?row.setting_value.length>0:row.setting_value!=null;
 let secret=isSecretSetting(row.setting_key,row);
 if(!secret&&row.setting_key.endsWith('_URL')&&configured){try{const url=new URL(row.setting_value);secret=!['https:','http:'].includes(url.protocol)||!!url.username||!!url.password||!!url.search||!!url.hash||url.pathname!=='/';}catch{secret=true;}}
 return {setting_key:row.setting_key,setting_value:secret?configured?SETTINGS_MASK:'':String(row.setting_value??''),setting_type:secret?'password':['text','number','boolean'].includes(row.setting_type)?row.setting_type:'text',category:typeof row.category==='string'&&['email','api','integrations','app'].includes(row.category)?row.category:undefined,isConfigured:configured};
}
