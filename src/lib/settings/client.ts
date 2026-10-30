import {authHeaders} from '../auth';
const actions=new Set(['status','webhookInfo','getEvolutionConfig','webhookConfig','fullDiagnostics','diagnostics','setWebhook','saveEvolutionConfig','createInstance','getQRCode','getInstanceStatus','disconnect','debugSaveInstance','publishVersion']);
export function settingsFetch(url:string,options:RequestInit={}){
 if(!url.startsWith('/api/'))throw new Error('Settings requests require a same-origin API path.');
 const parsed=new URL(url,'https://local.invalid');
 if(parsed.origin!=='https://local.invalid'||parsed.hash||!['/api/settings','/api/whatsapp'].includes(parsed.pathname)||parsed.pathname==='/api/whatsapp'&&(parsed.searchParams.getAll('action').length!==1||!actions.has(parsed.searchParams.get('action')||'')))throw new Error('Invalid settings API path.');
 const headers=new Headers(options.headers);headers.delete('Authorization');for(const[key,value]of Object.entries(authHeaders()))headers.set(key,value);
 return fetch(url,{...options,headers,redirect:'error',credentials:'same-origin'});
}
