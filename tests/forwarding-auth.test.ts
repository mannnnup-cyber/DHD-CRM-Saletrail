import {beforeEach,afterEach,it,expect,vi} from 'vitest';

const actorId='10000000-0000-4000-8000-000000000001';
const m=vi.hoisted(()=>({role:'owner',active:true,expired:false,profileError:false,missing:false,mismatch:false,queries:[] as any[],writes:[] as any[],authCalls:0}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({
 auth:{getUser:async()=>{m.authCalls++;return {data:{user:m.expired?null:{id:'10000000-0000-4000-8000-000000000001',email:'owner@example.test'}},error:m.expired?{message:'private-auth-detail'}:null};}},
 from:(table:string)=>{
  const filters:Record<string,unknown>={};let operation='read',payload:any;const q:any={};
  for(const method of ['select','order','limit','neq'])q[method]=(...args:any[])=>{m.queries.push({table,method,args});return q;};
  q.eq=(key:string,value:any)=>{filters[key]=value;m.queries.push({table,method:'eq',args:[key,value]});return q;};
  for(const method of ['update','insert'])q[method]=(value:any)=>{operation=method;payload=value;m.writes.push({table,method,value,filters});return q;};
  const result=()=>{
   if(table==='user_profiles')return {data:m.missing?null:{id:m.mismatch?'foreign-id':'10000000-0000-4000-8000-000000000001',email:'owner@example.test',role:m.role,is_active:m.active},error:m.profileError?{message:'private-profile-detail'}:null};
   if(table==='users')return {data:{id:'10000000-0000-4000-8000-000000000001',email:'owner@example.test',is_active:true},error:null};
   if(table==='devices')return {data:{device_id:'device-1'},error:null};
   if(table==='device_commands')return {data:operation==='insert'?{id:'command-1',...payload}:operation==='update'?[]:[{id:'command-1',device_phone:'18765550100',command:'verify_status',status:'done'}],error:null};
   return {data:null,error:null};
  };
  q.single=async()=>result();q.maybeSingle=async()=>result();q.then=(resolve:any,reject:any)=>Promise.resolve(result()).then(resolve,reject);return q;
 }
})}));

const response=()=>({code:200,payload:null as any,headers:{} as any,sent:false,
 setHeader(k:any,v:any){if(this.sent)throw new Error('Headers already sent');this.headers[k]=v;},
 status(c:number){this.code=c;return this;},json(value:any){this.sent=true;this.payload=value;return this;},end(){this.sent=true;return this;}});
const command={devicePhone:'18765550100',command:'verify_status',simSlot:0};
async function request(action:any='sendForwardCommand',method='POST',headers:any={authorization:'Bearer synthetic-owner'},body:any=command){
 const {default:handler}=await import('../api/whatsapp');const res=response();
 await handler({method,query:{action},headers,body} as any,res as any);return res;
}
beforeEach(()=>{
 vi.resetModules();m.role='owner';m.active=true;m.expired=false;m.profileError=false;m.missing=false;m.mismatch=false;m.queries=[];m.writes=[];m.authCalls=0;
 for(const[k,v]of Object.entries({SUPABASE_PROJECT_URL:'https://synthetic.invalid',SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SECRET_KEY:'synthetic-modern',NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.invalid',EVOLUTION_API_URL:'https://provider.invalid',EVOLUTION_API_KEY:'synthetic-provider'}))vi.stubEnv(k,v);
 vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('Provider must not be called by forwarding management');}));
 vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();});

const actions=[['sendForwardCommand','POST'],['getForwardStatus','GET']];
it.each(actions)('%s denies missing, malformed and array credentials before private effects',async(action,method)=>{
 for(const authorization of [undefined,'','Bearer ',['Bearer synthetic-owner']]){
  const r=await request(action,method,authorization===undefined?{}:{authorization});expect(r.code).toBe(401);
  expect(JSON.stringify(r.payload)).not.toMatch(/18765550100|command-1|private-/);
 }
 expect(m.queries).toHaveLength(0);expect(m.writes).toHaveLength(0);expect(m.authCalls).toBe(0);expect(fetch).not.toHaveBeenCalled();
});
it.each(actions)('%s denies both rep roles despite spoofed owner headers',async(action,method)=>{
 for(const role of ['rep','sales_rep']){
  m.role=role;const r=await request(action,method,{authorization:'Bearer synthetic-rep','x-user-role':'owner','x-user-email':'spoof-owner@example.test'});
  expect(r.code).toBe(403);expect(JSON.stringify(r.payload)).not.toMatch(/18765550100|command-1|private-/);
 }
 expect(m.queries.every(q=>['user_profiles','users'].includes(q.table))).toBe(true);expect(m.writes).toHaveLength(0);expect(fetch).not.toHaveBeenCalled();
});
it.each(actions)('%s validates current identity, role, modern configuration and project',async(action,method)=>{
 for(const mode of ['inactive','expired','profile-error','missing-profile','profile-mismatch','unknown-role','missing-modern','wrong-project']){
  m.active=mode!=='inactive';m.expired=mode==='expired';m.profileError=mode==='profile-error';m.missing=mode==='missing-profile';m.mismatch=mode==='profile-mismatch';m.role=mode==='unknown-role'?'administrator':'owner';
  vi.stubEnv('SUPABASE_SECRET_KEY',mode==='missing-modern'?'':'synthetic-modern');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','legacy-not-authority');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL',mode==='wrong-project'?'https://other.invalid':'https://synthetic.invalid');
  vi.resetModules();const r=await request(action,method);expect(r.code).toBe(mode==='expired'?401:['profile-error','missing-modern','wrong-project'].includes(mode)?503:403);
  expect(m.writes).toHaveLength(0);expect(m.queries.every(q=>['user_profiles','users'].includes(q.table))).toBe(true);expect(fetch).not.toHaveBeenCalled();
 }
});
it.each(actions)('%s rejects the alternate method before authentication or effects',async(action,method)=>{
 const r=await request(action,method==='POST'?'GET':'POST');expect(r.code).toBe(405);expect(m.authCalls).toBe(0);expect(m.queries).toHaveLength(0);expect(m.writes).toHaveLength(0);expect(fetch).not.toHaveBeenCalled();
});
it.each([['sendForwardCommand'],['getForwardStatus','sendForwardCommand'],{action:'sendForwardCommand'}])('query action alias %j cannot enter forwarding management',async action=>{
 expect((await request(action)).code).toBe(400);expect(m.authCalls).toBe(0);expect(m.queries).toHaveLength(0);expect(m.writes).toHaveLength(0);expect(fetch).not.toHaveBeenCalled();
});
it.each(['owner','manager'])('%s creates a command attributed to the canonical fresh actor UUID',async role=>{
 m.role=role;const r=await request('sendForwardCommand','POST',{authorization:'Bearer synthetic','x-user-email':'spoof@example.test'}, {...command,created_by:'client-controlled-id'});
 expect(r.code).toBe(200);expect(r.payload.success).toBe(true);expect(r.headers['Cache-Control']).toBe('private, no-store');expect(m.authCalls).toBe(1);
 expect(m.writes.find(w=>w.table==='device_commands'&&w.method==='insert').value).toMatchObject({created_by:actorId,device_phone:'18765550100',command:'verify_status',sim_slot:0,status:'pending'});
 expect(JSON.stringify(r.payload)).not.toMatch(/spoof@example.test|client-controlled-id/);expect(fetch).not.toHaveBeenCalled();
});
it.each(['owner','manager'])('%s reads existing forwarding status without modifying the queue',async role=>{
 m.role=role;const r=await request('getForwardStatus','GET');expect(r.code).toBe(200);expect(r.payload).toMatchObject({success:true,forwardStatus:{'18765550100':{id:'command-1',status:'done'}}});
 expect(r.headers['Cache-Control']).toBe('private, no-store');expect(m.authCalls).toBe(1);expect(m.writes).toHaveLength(0);expect(fetch).not.toHaveBeenCalled();
});
