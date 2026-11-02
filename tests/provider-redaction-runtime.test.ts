import {it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

it('native redaction imports load without machine configuration or network',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'follops-machine-runtime-'));
 try{
  fs.writeFileSync(path.join(temp,'package.json'),'{"type":"module"}');
  fs.symlinkSync(fs.realpathSync('node_modules'),path.join(temp,'node_modules'),process.platform==='win32'?'junction':'dir');
  const sources=['api/whatsapp.ts','api/recordings.ts','src/lib/integrations/provider-projection.ts','src/lib/settings/server.ts','src/lib/settings/projection.ts','src/lib/inbox/email-server.ts','src/lib/inbox/email.ts','src/lib/whatsapp/inbox-server.ts','src/lib/whatsapp/inbox.ts','src/lib/whatsapp/phone-labels-server.ts'];
  for(const source of sources){
   const dest=path.join(temp,source.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(dest),{recursive:true});
   fs.writeFileSync(dest,ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  }
  const script=`globalThis.fetch=()=>{throw new Error('Network forbidden')};const results=[];for(const [name,action]of [['whatsapp','getEvolutionConfig'],['recordings','listRecordings']]){const {default:handler}=await import(${JSON.stringify(pathToFileURL(path.join(temp,'api')).href)}+'/'+name+'.js');const res={code:200,setHeader(){},status(c){this.code=c;return this},json(p){results.push({code:this.code,success:p.success});return this}};await handler({method:'GET',query:{action},headers:{},body:{}},res)}console.log('RESULT:'+JSON.stringify(results));`;
  const childEnv={...process.env,SUPABASE_PROJECT_URL:'https://synthetic.invalid',NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.invalid',SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SECRET_KEY:'synthetic-modern',FOLLOPS_COMPANION_CREDENTIALS:'',FOLLOPS_WHATSAPP_WEBHOOKS:''};
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:60000,env:childEnv});
  expect(result.status,result.stderr).toBe(0);
  const line=result.stdout.split('\n').find(line=>line.startsWith('RESULT:'));
  expect(JSON.parse(line!.slice(7))).toEqual([{code:401,success:false},{code:405}]);
 }finally{
  if(path.dirname(path.resolve(temp))!==path.resolve(os.tmpdir())||!path.basename(temp).startsWith('follops-machine-runtime-'))throw new Error('Unsafe temporary target');
  fs.rmSync(temp,{recursive:true,force:true});
 }
},90000);
