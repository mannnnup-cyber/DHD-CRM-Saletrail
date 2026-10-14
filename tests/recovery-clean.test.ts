import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const m = vi.hoisted(() => ({ createClient: vi.fn(), from: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), update: vi.fn(), select: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: m.createClient }));
let handler: typeof import('../api/recovery-clear').default;
const body = { tokenHash: 'recovery-hash', newPassword: 'new-password-123' };
async function invoke(overrides: any = {}) {
  const res: any = { code: 200, payload: null, setHeader: vi.fn(), status(code: number) { this.code = code; return this; }, json(payload: any) { this.payload = payload; return this; } };
  await handler({ method: 'POST', body, headers: {}, ...overrides } as any, res); return res;
}
describe('actual recovery completion handler', () => {
  beforeEach(async () => {
    vi.resetModules(); vi.resetAllMocks();
    vi.stubEnv('SUPABASE_PROJECT_URL', 'https://example.supabase.co'); vi.stubEnv('SUPABASE_ANON_KEY', 'public-test'); vi.stubEnv('SUPABASE_SECRET_KEY', 'secret-test');
    m.verifyOtp.mockResolvedValue({ data: { user: { id: 'verified-user' }, session: { access_token: 'private-session' } }, error: null });
    m.updateUser.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null }); m.signOut.mockResolvedValue({ error: null });
    m.maybeSingle.mockResolvedValue({ data: { id: 'verified-user' }, error: null });
    const chain = { eq: m.eq, select: m.select, maybeSingle: m.maybeSingle };
    m.eq.mockReturnValue(chain); m.select.mockReturnValue(chain); m.update.mockReturnValue(chain); m.from.mockReturnValue({ update: m.update });
    m.createClient.mockImplementation((_url, key) => key === 'secret-test' ? { from: m.from } : { auth: { verifyOtp: m.verifyOtp, updateUser: m.updateUser, signOut: m.signOut } });
    handler = (await import('../api/recovery-clear')).default;
  });
  afterEach(() => vi.unstubAllEnvs());
  it('rejects GET without consuming a token', async () => { expect((await invoke({ method: 'GET' })).code).toBe(405); expect(m.verifyOtp).not.toHaveBeenCalled(); });
  it('rejects normal bearer-only clear', async () => { expect((await invoke({ body: {}, headers: { authorization: 'Bearer ordinary-session' } })).code).toBe(400); expect(m.from).not.toHaveBeenCalled(); });
  it.each([null, { tokenHash: 12, newPassword: 'new-password' }, { tokenHash: 'hash', newPassword: 'short' }, { tokenHash: 'hash', newPassword: 'x'.repeat(1025) }])('validates before consuming link: %j', async value => { expect((await invoke({ body: value })).code).toBe(400); expect(m.verifyOtp).not.toHaveBeenCalled(); });
  it('rejects invalid/expired/replayed tokens without writing', async () => { m.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'private-detail' } }); const r = await invoke(); expect(r.code).toBe(401); expect(JSON.stringify(r.payload)).not.toContain('private-detail'); expect(m.updateUser).not.toHaveBeenCalled(); expect(m.from).not.toHaveBeenCalled(); });
  it('cannot clear again when Supabase rejects replay of a consumed link', async () => { expect((await invoke()).code).toBe(200); m.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'consumed' } }); expect((await invoke()).code).toBe(401); expect(m.updateUser).toHaveBeenCalledTimes(1); expect(m.update).toHaveBeenCalledTimes(1); });
  it('updates verified session then clears only verified active profile', async () => { const r = await invoke({ body: { ...body, id: 'victim', type: 'signup' } }); expect(r.payload).toEqual({ success: true }); expect(m.verifyOtp).toHaveBeenCalledWith({ token_hash: body.tokenHash, type: 'recovery' }); expect(m.updateUser).toHaveBeenCalledWith({ password: body.newPassword }); expect(m.eq).toHaveBeenCalledWith('id', 'verified-user'); expect(m.eq).toHaveBeenCalledWith('is_active', true); expect(m.eq).not.toHaveBeenCalledWith('id', 'victim'); expect(m.updateUser.mock.invocationCallOrder[0]).toBeLessThan(m.update.mock.invocationCallOrder[0]); expect(m.signOut).toHaveBeenCalledWith({ scope: 'local' }); });
  it('does not clear on password update failure', async () => { m.updateUser.mockResolvedValue({ data: { user: null }, error: { message: 'private-detail' } }); const r = await invoke(); expect(r.code).toBe(400); expect(m.from).not.toHaveBeenCalled(); expect(JSON.stringify(r.payload)).not.toContain('private-detail'); });
  it.each([{ data: null, error: { message: 'private-detail' } }, { data: null, error: null }])('reports cleanup failure/missing active profile as partial: %j', async result => { m.maybeSingle.mockResolvedValue(result); const r = await invoke(); expect(r.code).toBe(500); expect(r.payload).toMatchObject({ success: false, passwordUpdated: true }); expect(JSON.stringify(r.payload)).not.toContain('private-detail'); });
  it('creates nonpersistent isolated auth clients per request', async () => { await Promise.all([invoke(), invoke()]); const calls = m.createClient.mock.calls.filter(c => c[1] === 'public-test'); expect(calls).toHaveLength(2); for (const c of calls) expect(c[2].auth).toMatchObject({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }); });
  it('sanitizes thrown errors and discards recovered session', async () => { m.updateUser.mockRejectedValue(new Error('private-session')); const r = await invoke(); expect(r.code).toBe(500); expect(JSON.stringify(r.payload)).not.toContain('private-session'); expect(m.signOut).toHaveBeenCalled(); });
  it('signout failure cannot override successful reset', async () => { m.signOut.mockRejectedValue(new Error('discard failed')); expect((await invoke()).payload).toEqual({ success: true }); });
});
