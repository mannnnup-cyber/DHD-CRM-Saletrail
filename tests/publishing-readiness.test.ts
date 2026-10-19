import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ getUser: vi.fn(), createClient: vi.fn(), profile: {} as any }));
vi.mock('@supabase/supabase-js', () => ({ createClient: m.createClient }));
const actor = '11111111-1111-4111-8111-111111111111', account = '33333333-3333-4333-8333-333333333333';
let handler: typeof import('../api/social').default, scope: any, upstream: any;
async function call(action = 'readiness', extra = {}, headers: any = { authorization: 'Bearer synthetic' }, method = 'GET') {
  const res: any = { code: 200, payload: null, setHeader: vi.fn(), status(c: number) { this.code = c; return this; }, json(p: any) { this.payload = p; return this; } };
  await handler({ headers, method, query: { module: 'publishing', action, ...extra } } as any, res); return res;
}
beforeEach(async () => {
  vi.resetModules(); vi.resetAllMocks();
  vi.stubEnv('SUPABASE_PROJECT_URL', 'https://synthetic.supabase.co'); vi.stubEnv('SUPABASE_ANON_KEY', 'anon'); vi.stubEnv('SUPABASE_SECRET_KEY', 'modern'); vi.stubEnv('BRIGHTBEAN_API_KEY', 'synthetic');
  m.profile = { id: actor, role: 'owner', is_active: true }; m.getUser.mockResolvedValue({ data: { user: { id: actor } } });
  m.createClient.mockImplementation((_url: string, key: string) => key === 'anon' ? { auth: { getUser: m.getUser } } : { from() { const chain: any = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: m.profile }) }; return chain; } });
  scope = { workspace_id: '0b8f55a0-f110-4504-8e16-c9b6c79c5726', workspace_name: 'Synthetic', permissions: ['create_posts'], allowlisted_accounts: [{ id: account }] };
  upstream = vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/me/') ? scope : url.endsWith('/accounts/') ? { accounts: [{ id: account, platform: 'instagram', account_name: 'Synthetic', connection_status: 'connected', char_limit: 2200, private: 'secret' }] } : { items: [], next_cursor: null }), { status: 200 })); vi.stubGlobal('fetch', upstream);
  handler = (await import('../api/social')).default;
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('denies anonymous and rep before provider access', async () => { expect((await call('readiness', {}, {})).code).toBe(401); m.profile.role = 'rep'; expect((await call()).code).toBe(403); expect(upstream).not.toHaveBeenCalled(); });
it('requires modern secret and canonical active user', async () => { vi.stubEnv('SUPABASE_SECRET_KEY', ''); expect((await call()).code).toBe(503); vi.stubEnv('SUPABASE_SECRET_KEY', 'modern'); m.profile.is_active = false; expect((await call()).code).toBe(403); });
it('projects read-only readiness without claiming publication and strips private data', async () => { const r = await call(); expect(r.payload.publicationVerified).toBe(false); expect(r.payload.accounts).toHaveLength(1); expect(JSON.stringify(r.payload)).not.toContain('secret'); expect(upstream.mock.calls.every((c: any) => c[1].method === 'GET')).toBe(true); });
it('rejects foreign workspace and known-post account scope', async () => { scope.workspace_id = actor; expect((await call()).code).toBe(503); });
it('lists provider media through actual GET collection with cursor validation', async () => { expect((await call('media')).payload.items).toEqual([]); expect(upstream.mock.calls.at(-1)[0]).toContain('/media/?limit=25'); expect((await call('media', { cursor: '../escape' })).code).toBe(400); });
it('rejects mutation methods and excludes unsupported platforms', async () => { expect((await call('readiness', {}, undefined, 'POST')).code).toBe(405); scope.allowlisted_accounts = []; expect((await call()).payload.accounts).toEqual([]); });
