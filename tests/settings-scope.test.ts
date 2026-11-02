import {it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const baseline='544ac0ed669dd7a5e1a9eea99cbcf49f6d329916';
const before=(file:string)=>execFileSync('git',['show',baseline+':'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n');
const current=(file:string)=>fs.readFileSync(path.resolve(file),'utf8').replace(/\r\n/g,'\n');
it.each(['api/settings.ts','src/lib/settings/server.ts','src/lib/settings/projection.ts','src/lib/settings/client.ts','src/App.tsx','src/lib/inbox/email-server.ts','src/lib/auth.ts','src/pages/Settings.tsx','src/pages/WhatsApp.tsx','src/pages/CompanionApp.tsx'])('%s preserves the released SECURITY-001A baseline',file=>{expect(current(file)).toBe(before(file));});
it('unrelated WhatsApp behavior stays unchanged apart from explicit private log/error/raw redaction',()=>{
 function extract(source:string){
  const ast=ts.createSourceFile('api.ts',source,ts.ScriptTarget.Latest,true);
  const transform=ts.transform(ast,[context=>node=>{
   const visit:ts.Visitor=node=>{
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.expression.getText(ast)==='console')return ts.factory.updateCallExpression(node,node.expression,node.typeArguments,[ts.factory.createStringLiteral('REDACTED')]);
    if(ts.isPropertyAssignment(node)&&['error','dbError','raw'].includes(node.name.getText(ast)))return ts.factory.updatePropertyAssignment(node,node.name,ts.factory.createStringLiteral('REDACTED'));
    return ts.visitEachChild(node,visit,context);
   };
   return ts.visitNode(node,visit) as ts.SourceFile;
  }]);
  const clean=transform.transformed[0],printer=ts.createPrinter({removeComments:true}),cases=new Map<string,string>();let callback='';
  function visit(node:ts.Node){
   if(ts.isCaseClause(node)&&ts.isStringLiteral(node.expression))cases.set(node.expression.text,printer.printNode(ts.EmitHint.Unspecified,node,clean));
   if(ts.isIfStatement(node)&&node.expression.getText(ast)==="req.method === 'POST' && !req.query.action")callback=printer.printNode(ts.EmitHint.Unspecified,node,clean);
   ts.forEachChild(node,visit);
  }
  visit(clean);transform.dispose();return {cases,callback};
 }
 const old=extract(before('api/whatsapp.ts')),now=extract(current('api/whatsapp.ts'));
 expect(old.callback.length).toBeGreaterThan(1000);expect(now.callback).toBe(old.callback);
 const changed=new Set<string>();
 for(const[action,text]of old.cases)if(!changed.has(action))expect(now.cases.get(action),action).toBe(text);
});

it('independent packet introduces no machine enforcement or registry dependency',()=>{for(const file of ['api/whatsapp.ts','api/recordings.ts','src/lib/integrations/provider-projection.ts'])expect(current(file)).not.toMatch(/FOLLOPS_(COMPANION_CREDENTIALS|WHATSAPP_WEBHOOKS)|companionActor|providerWebhook|outboundWebhookSecret|machine-server/);expect(current('api/recordings.ts')).toContain('maxFileSize: 500 * 1024 * 1024');});
