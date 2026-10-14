import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const m = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn(), from: vi.fn(), generateLink: vi.fn(), maybeSingle: vi.fn(), single: vi.fn(), fetch: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: m.createClient }));
let handler: typeof import('../api/users').default;
async function invoke(headers: any = { authorization: 'Bearer session' }) {
  const r: any = { code: 200, payload: null, setHeader: vi.fn(), status(c: number) { this.code = c; return this; }, json(p: any) { this.payload = p; return this; } };
  await handler({ method: 'POST', query: { action: 'resetPassword' }, body: { id: 'target' }, headers } as any, r); return r;
}
describe('actual reset initiation handler', () => {
  beforeEach(async () => {
    vi.resetModules(); vi.resetAllMocks();
    for (const [key, value] of Object.entries({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'secret-test', SUPABASE_ANON_KEY: 'anon-test', RESEND_API_KEY: 'resend-test', VERCEL_URL: 'trusted-app.example' })) vi.stubEnv(key, value);
    m.getUser.mockResolvedValue({ data: { user: { id: 'caller' } }, error: null });
    m.maybeSingle.mockResolvedValue({ data: { id: 'caller', email: 'manager@example.test', role: 'manager', is_active: true } });
    m.single.mockResolvedValue({ data: { email: 'recipient@example.test', name: '<Recipient>' } });
    const chain: any = { select: vi.fn(() => chain), eq: vi.fn(() => chain), maybeSingle: m.maybeSingle, single: m.single };
    m.from.mockReturnValue(chain); m.generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'hash+test', action_link: 'https://provider.example/private-token' } }, error: null });
    m.createClient.mockReturnValue({ auth: { getUser: m.getUser, admin: { generateLink: m.generateLink } }, from: m.from });
    m.fetch.mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', m.fetch);
    handler = (await import('../api/users')).default;
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('requires authentication', async () => { expect((await invoke({})).code).toBe(401); expect(m.generateLink).not.toHaveBeenCalled(); });
  it('rejects reps', async () => { m.maybeSingle.mockResolvedValue({ data: { id: 'caller', role: 'sales_rep', is_active: true } }); expect((await invoke()).code).toBe(403); expect(m.fetch).not.toHaveBeenCalled(); });
  it.each(['owner', 'manager'])('allows %s and emails trusted fragment link without returning it', async role => {
    m.maybeSingle.mockResolvedValue({ data: { id: 'caller', role, is_active: true } });
    const r = await invoke({ authorization: 'Bearer session', host: 'evil.example' }); expect(r.payload.success).toBe(true);
    expect(m.generateLink).toHaveBeenCalledWith({ type: 'recovery', email: 'recipient@example.test' });
    const email = JSON.parse(m.fetch.mock.calls[0][1].body);
    expect(email.html).toContain('https://trusted-app.example/#/recovery?token_hash=hash%2Btest&amp;type=recovery');
    expect(email.html).toContain('&lt;Recipient&gt;'); expect(email.html).not.toContain('private-token'); expect(JSON.stringify(r.payload)).not.toContain('hash');
  });
  it('sanitizes link generation failures', async () => { m.generateLink.mockResolvedValue({ data: null, error: { message: 'private-token' } }); const r = await invoke(); expect(r.payload.success).toBe(false); expect(JSON.stringify(r.payload)).not.toContain('private-token'); expect(m.fetch).not.toHaveBeenCalled(); });
  it('delivery failure preserves existing password and never logs provider body', async () => { const logger = vi.spyOn(console, 'error').mockImplementation(() => {}); m.fetch.mockResolvedValue({ ok: false, json: vi.fn().mockResolvedValue({ token: 'private-token' }) }); const r = await invoke(); expect(r.payload.error).toContain('existing password has not been changed'); expect(logger).not.toHaveBeenCalled(); });
  it('sanitizes thrown provider failures', async () => { const logger = vi.spyOn(console, 'error').mockImplementation(() => {}); m.generateLink.mockRejectedValue(new Error('private-token')); const r = await invoke(); expect(r.code).toBe(500); expect(JSON.stringify(r.payload)).not.toContain('private-token'); expect(logger).not.toHaveBeenCalled(); });
});
