import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

describe('native emitted email function runtime', () => {
  it('loads unbundled ESM and reaches the actual missing-token auth guard', () => {
    const scratch = path.resolve('work');
    fs.mkdirSync(scratch, { recursive: true });
    const temp = fs.mkdtempSync(path.join(scratch, 'email-runtime-'));
    try {
      fs.writeFileSync(path.join(temp, 'package.json'), '{"type":"module"}');
      fs.symlinkSync(fs.realpathSync(path.resolve('node_modules')), path.join(temp, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
      for (const source of ['api/email.ts', 'src/lib/inbox/mailbox-server.ts', 'src/lib/inbox/email-server.ts', 'src/lib/inbox/email.ts']) {
        const emitted = ts.transpileModule(fs.readFileSync(path.resolve(source), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
        const destination = path.join(temp, source.replace(/\.ts$/, '.js'));
        fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, emitted);
      }
      const script = `
        globalThis.fetch = () => { throw new Error('Runtime guard test must not make network requests'); };
        const { default: handler } = await import(${JSON.stringify(pathToFileURL(path.join(temp, 'api/email.js')).href)});
        const res = { code: null, headers: {}, payload: null, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; return this; } };
        await handler({ method: 'GET', query: { action: 'inbox' }, headers: {} }, res);
        console.log(JSON.stringify({ code: res.code, noStore: res.headers['Cache-Control'], payload: res.payload }));
      `;
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 15000, env: { ...process.env, SUPABASE_PROJECT_URL: 'https://synthetic.example.supabase.co', SUPABASE_ANON_KEY: 'synthetic-anon', SUPABASE_SECRET_KEY: 'synthetic-modern', SUPABASE_SERVICE_ROLE_KEY: '' } });
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout.trim())).toEqual({ code: 401, noStore: 'no-store', payload: { success: false, error: 'Authentication required.' } });
    } finally {
      if (path.dirname(path.resolve(temp)) !== scratch) throw new Error('Unexpected runtime scratch target');
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }, 20000);
});
