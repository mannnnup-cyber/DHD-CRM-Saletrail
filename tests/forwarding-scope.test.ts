import {it,expect} from 'vitest';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const baseline='37a7253910c8541fbc35a296ee3371b848f28051';
const before=(file:string)=>execFileSync('git',['show',baseline+':'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n');
const current=(file:string)=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');

it.each(['api/settings.ts','api/recordings.ts','src/lib/settings/server.ts','src/lib/settings/client.ts','src/lib/settings/projection.ts','src/lib/integrations/provider-projection.ts','src/lib/inbox/email-server.ts','src/pages/WhatsApp.tsx','src/pages/CompanionApp.tsx','src/pages/CallLogs.tsx','.github/workflows/ci.yml','vercel.json'])('%s preserves the approved baseline',file=>{
 if(file==='vercel.json') {
  const config=JSON.parse(current(file));
  expect(config.git).toEqual({deploymentEnabled:{'review/security-001c-forwarding':false}});
  delete config.git;
  expect(config).toEqual(JSON.parse(before(file)));
  return;
 }
 expect(current(file)).toBe(before(file));
});
it('WhatsApp changes only the two forwarding guards and canonical creator attribution',()=>{
 const source=current('api/whatsapp.ts');
 const start=source.indexOf('  let forwardingActor:');
 const end=source.indexOf('\n\n  // Secrets prefer',start);
 expect(start).toBeGreaterThan(0);expect(end).toBeGreaterThan(start);
 const restored=(source.slice(0,start)+source.slice(end+1)).replace('created_by: forwardingActor!.id,',"created_by: String(req.headers['x-user-email'] || 'system'),");
 expect(restored).toBe(before('api/whatsapp.ts'));
 expect(source).not.toMatch(/FOLLOPS_(COMPANION_CREDENTIALS|WHATSAPP_WEBHOOKS)|machine-server|companionActor|providerWebhook/);
});
it('Settings changes only existing forwarding reads/writes to the current Bearer helper',()=>{
 const restored=current('src/pages/Settings.tsx').replaceAll("settingsFetch('/api/whatsapp?action=sendForwardCommand'","fetch('/api/whatsapp?action=sendForwardCommand'").replaceAll("settingsFetch('/api/whatsapp?action=getForwardStatus'","fetch('/api/whatsapp?action=getForwardStatus'");
 expect(restored).toBe(before('src/pages/Settings.tsx'));
});
