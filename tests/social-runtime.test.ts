import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

describe('native emitted social handler', () => {
  it('loads unbundled ESM helpers and reaches actual authentication guard', () => {
    const scratch = path.resolve('work'); fs.mkdirSync(scratch, { recursive: true }); const temp = fs.mkdtempSync(path.join(scratch, 'social-runtime-'));
    try {
      fs.writeFileSync(path.join(temp, 'package.json'), '{"type":"module"}');
      fs.symlinkSync(fs.realpathSync(path.resolve('node_modules')), path.join(temp, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
      for (const source of ['api/social.ts', 'src/lib/inbox/social-server.ts', 'src/lib/inbox/social.ts', ...fs.readdirSync('src/lib/publishing').filter(name=>name.endsWith('.ts')).map(name=>`src/lib/publishing/${name}`)]) {
        const output = ts.transpileModule(fs.readFileSync(path.resolve(source), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
        const destination = path.join(temp, source.replace(/\.ts$/, '.js')); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, output);
      }
      const script = `globalThis.fetch=()=>{throw new Error('No network allowed')}; const {default:handler}=await import(${JSON.stringify(pathToFileURL(path.join(temp, 'api/social.js')).href)}); const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(payload){console.log(JSON.stringify({code:this.code,payload,headers:this.headers}));return this}}; await handler({method:'GET',query:{action:'inbox'},headers:{}},res);`;
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 15000 });
      expect(result.status, result.stderr).toBe(0); expect(JSON.parse(result.stdout.trim())).toMatchObject({ code: 401, payload: { success: false, error: 'Authentication required.' }, headers: { 'Cache-Control': 'no-store' } });
    } finally { if (path.dirname(path.resolve(temp)) !== scratch) throw new Error('Unexpected scratch target'); fs.rmSync(temp, { recursive: true, force: true }); }
  }, 20000);
});
