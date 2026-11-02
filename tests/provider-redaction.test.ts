import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
const m=vi.hoisted(()=>({role:'owner',active:true,expired:false,dbError:false,deviceActive:true,deviceUser:'rep-1',deviceOrg:'org-1',recordingReadError:false,policyError:false,callMatch:true,insertError:null as any,duplicate:null as any,duplicateError:false,commandError:false,heartbeatError:false,parsed:0,uploads:0,fileMime:'audio/mp4',storage:null as any,fields:{} as any,filePath:'',queries:[] as any[],writes:[] as any[],settings:[] as any[]}));
vi.mock('../src/lib/inbox/mailbox-server.js',()=>({verifySavedMailbox:vi.fn(async()=>{})}));
vi.mock('formidable',()=>({default:()=>{m.parsed++;const form:any={on:(_event:any,fn:any)=>{form.begin=fn;return form;},parse:(_req:any,done:any)=>{form.begin?.('file',{filepath:m.filePath});done(null,m.fields,{file:[{filepath:m.filePath,mimetype:m.fileMime,size:16}]});}};return form;}}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:m.expired?null:{id:'browser-1',email:'owner@example.test'}},error:m.expired?{message:'private auth failure'}:null})},storage:{from:()=>({upload:async(storagePath:any,_body:any,options:any)=>{m.uploads++;m.storage={path:storagePath,options};return {data:{path:storagePath},error:null};}})},from:(table:string)=>{
 const filters:Record<string,any>={};let operation='read',payload:any,selection='';const q:any={};
 for(const method of ['select','order','limit','gte','lte','is','ilike','in','neq','range','or'])q[method]=(...args:any[])=>{if(method==='select')selection=args[0];m.queries.push({table,method,args});return q;};
 q.eq=(key:string,value:any)=>{filters[key]=value;m.queries.push({table,method:'eq',args:[key,value]});return q;};
 for(const method of ['update','insert','upsert'])q[method]=(value:any)=>{operation=method;payload=value;m.writes.push({table,method,value,filters});return q;};
 const result=(single=false)=>{
  if(table==='contacts')return {data:operation==='insert'?{id:'synthetic-contact'}:null,error:null};
  if(table==='user_profiles')return {data:{id:filters.id||'browser-1',email:'owner@example.test',role:m.role,is_active:m.active},error:m.dbError?{message:'private failure'}:null};
  if(table==='users')return {data:{id:filters.id,email:'owner@example.test',is_active:m.active},error:null};
  if(table==='devices')return {data:{device_id:'device-1',user_id:m.deviceUser,org_id:m.deviceOrg,phone_number:'18765550100',is_active:m.deviceActive,device_name:'Synthetic rep'},error:(m.dbError||operation==='update'&&m.heartbeatError)?{message:'private failure'}:null};
  if(table==='app_settings')return {data:single?m.settings.find(row=>row.setting_key===filters.setting_key)||null:m.settings,error:m.dbError?{message:'private-secret-db-error'}:null};
  if(table==='device_commands')return {data:operation==='insert'?{id:'new-command',...payload}:operation==='update'?(filters.id==='10000000-0000-4000-8000-000000000001'&&filters.device_phone==='18765550100'&&filters.status==='pending'?[{id:'10000000-0000-4000-8000-000000000001'}]:[]):[],error:m.commandError?{message:'private-command-error'}:null};
  if(table==='recording_settings')return {data:{recording_enabled:true,excluded_numbers:[],schedule_enabled:false},error:m.policyError?{message:'private policy error'}:null};
  if(table==='cellular_calls')return operation==='insert'?{data:null,error:m.insertError}:single?{data:m.duplicate,error:m.duplicateError?{message:'private-lookup-error'}:null}:{data:m.callMatch?[{id:'owned-call'}]:[],error:null};
  if(table==='audio_recordings')return {data:operation==='insert'?{recording_id:'recording-1'}:[],error:m.recordingReadError?{message:'private-recording-error'}:null};
  return {data:single?null:[],error:null};
 };
 q.single=async()=>result(true);q.maybeSingle=async()=>result(true);q.then=(resolve:any,reject:any)=>Promise.resolve(result()).then(resolve,reject);return q;
}})}));
const secret='synthetic-companion-secret-at-least-32-characters';
const webhookSecret='synthetic-dedicated-webhook-secret-32-characters';
function registry(){return [{id:'enrolled-1',secret,deviceId:'device-1',userId:'rep-1',orgId:'org-1',phone:'18765550100',expiresAt:'2099-01-01T00:00:00Z',actions:['addGSMCall','addWhatsAppCall','getDeviceCommands','ackCommand','uploadRecording']}];}
const machineHeaders={'x-follops-companion-id':'enrolled-1','x-follops-companion-secret':secret};
const call={phoneNumber:'18765550200',callType:'OUTGOING',duration_seconds:3,timestamp:1793260800000};
const response=()=>({code:200,payload:null as any,headers:{} as any,setHeader(k:any,v:any){this.headers[k]=v;},status(code:number){this.code=code;return this;},json(payload:any){this.payload=payload;return this;},end(){return this;}});
async function request(api='settings',action:any='list',method='GET',body:any={},headers:any={authorization:'Bearer synthetic'},extra:any={}){const handler=(await import(api==='settings'?'../api/settings':api==='recordings'?'../api/recordings':'../api/whatsapp')).default;const res=response();await handler({method,query:{...(action===null?{}:{action}),...extra},body,headers:{'content-type':'application/json',...headers}} as any,res as any);return res;}
beforeEach(()=>{vi.resetModules();m.role='owner';m.active=true;m.expired=false;m.dbError=false;m.deviceActive=true;m.deviceUser='rep-1';m.deviceOrg='org-1';m.policyError=false;m.callMatch=true;m.insertError=null;m.duplicate=null;m.duplicateError=false;m.commandError=false;m.heartbeatError=false;m.parsed=0;m.uploads=0;m.queries=[];m.writes=[];m.fields={phone_number:['18765550200'],timestamp_ms:['1793260800000'],device_phone:['18765550100'],duration_ms:['1000'],filename:['../../evil.m4a']};m.filePath=path.join(os.tmpdir(),'security-final-'+crypto.randomUUID()+'.m4a');fs.writeFileSync(m.filePath,'synthetic');m.settings=[{setting_key:'RESEND_API_KEY',setting_type:'text',setting_value:'private-key-value'},{setting_key:'GREENAPI_TOKEN',setting_type:'text',setting_value:'private-token-value'},{setting_key:'CUSTOM',setting_type:'password',setting_value:'private-custom'},{setting_key:'ENCRYPTED',is_encrypted:true,setting_value:'private-encrypted'},{setting_key:'EVOLUTION_INSTANCE_NAME',setting_type:'text',setting_value:'synthetic-instance'}];for(const[k,v]of Object.entries({SUPABASE_PROJECT_URL:'https://synthetic.invalid',SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SECRET_KEY:'modern-secret',EVOLUTION_API_URL:'https://provider.invalid',EVOLUTION_API_KEY:'provider-admin-secret',FOLLOPS_COMPANION_CREDENTIALS:JSON.stringify(registry()),FOLLOPS_WHATSAPP_WEBHOOKS:JSON.stringify([{provider:'evolution',instance:'synthetic-instance',secret:webhookSecret}])}))vi.stubEnv(k,v);vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,status:200,json:async()=>({}),text:async()=>'private-provider-key'})));});
afterEach(()=>{try{fs.unlinkSync(m.filePath);}catch{}vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});


beforeEach(()=>{m.recordingReadError=false;vi.stubEnv('FOLLOPS_COMPANION_CREDENTIALS','');vi.stubEnv('FOLLOPS_WHATSAPP_WEBHOOKS','');});
it('independent callback projection preserves ordinary message data without credentials or private log content',async()=>{
 const body={event:'messages.upsert',instance:'synthetic-instance',apikey:'private-top-key',headers:{authorization:'private-top-header'},data:{key:{id:'synthetic-message',remoteJid:'18765550200@s.whatsapp.net',fromMe:false},message:{conversation:'private-message-sentinel'},messageTimestamp:1793260800,apikey:'private-nested-key',headers:{authorization:'private-nested-header'}}};
 const r=await request('whatsapp',null,'POST',body,{});expect(r.code).toBe(200);expect(r.payload.success).toBe(true);
 const saved=m.writes.find(w=>w.table==='whatsapp_messages');expect(saved).toBeTruthy();expect(saved.value.raw.data.key.id).toBe('synthetic-message');expect(saved.value.raw.data.message.conversation).toBe('private-message-sentinel');
 expect(JSON.stringify(saved.value.raw)).not.toMatch(/private-top|private-nested/);
 const logs=[...vi.mocked(console.log).mock.calls,...vi.mocked(console.error).mock.calls,...vi.mocked(console.warn).mock.calls];expect(JSON.stringify(logs)).not.toMatch(/private-top|private-nested|private-message-sentinel|18765550200/);
});
it('independent recording errors do not echo raw database details',async()=>{
 m.recordingReadError=true;const r=await request('recordings','listRecordings','POST',{user_id:'synthetic-user',org_id:'synthetic-org'},{});expect(r.code).toBe(500);expect(r.payload.success).toBe(false);expect(JSON.stringify(r.payload)).not.toContain('private-recording-error');
 expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private-recording-error');
});
it('nested known secret keys and prototype fields are stripped while legitimate text remains',async()=>{
 const {providerPayload}=await import('../src/lib/integrations/provider-projection');
 const input=JSON.parse('{"event":"messages.upsert","__proto__":{"polluted":true},"data":{"message":{"conversation":"ordinary apikey word"},"access_token":"private-access","items":[{"API_KEY":"private-array","key":{"id":"kept"}}]}}');
 const safe:any=providerPayload(input);expect(safe.event).toBe('messages.upsert');expect(safe.data.message.conversation).toBe('ordinary apikey word');expect(safe.data.items[0].key.id).toBe('kept');expect(JSON.stringify(safe)).not.toMatch(/private-|polluted/);expect(({} as any).polluted).toBeUndefined();
});
it('deep provider structures are bounded without changing shallow scalar data',async()=>{
 const {providerPayload}=await import('../src/lib/integrations/provider-projection');let input:any={value:'end'};for(let i=0;i<40;i++)input={nested:input};expect(JSON.stringify(providerPayload(input))).not.toContain('end');expect(providerPayload({ok:true,items:[1,'text',null]})).toEqual({ok:true,items:[1,'text',null]});
});
