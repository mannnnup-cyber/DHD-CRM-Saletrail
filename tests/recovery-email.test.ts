import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const m = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn(), from: vi.fn(), generateLink: vi.fn(), maybeSingle: vi.fn(), single: vi.fn(), fetch: vi.fn(), order: vi.fn(), in: vi.fn() }));
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
    vi.stubEnv('RECOVERY_FROM_EMAIL', 'FollOps <no-reply@pickupja.com>');
    vi.stubEnv('RECOVERY_APP_URL', 'https://trusted-app.example');
    m.getUser.mockResolvedValue({ data: { user: { id: 'caller' } }, error: null });
    m.maybeSingle.mockResolvedValue({ data: { id: 'caller', email: 'manager@example.test', role: 'manager', is_active: true } });
    m.single.mockResolvedValue({ data: { email: 'recipient@example.test', name: '<Recipient>' } });
    const chain: any = { select: vi.fn(() => chain), eq: vi.fn(() => chain), maybeSingle: m.maybeSingle, single: m.single };
    const settings = { select: vi.fn(), in: m.in, order: m.order };
    settings.select.mockReturnValue(settings); m.in.mockReturnValue(settings); m.order.mockResolvedValue({ data: [], error: null });
    m.from.mockImplementation(table => table === 'app_settings' ? settings : chain); m.generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'hash+test', action_link: 'https://provider.example/private-token' } }, error: null });
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
  it('uses env key/sender without querying settings', async () => { await invoke(); expect(m.from).not.toHaveBeenCalledWith('app_settings'); expect(m.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer resend-test'); expect(JSON.parse(m.fetch.mock.calls[0][1].body).from).toBe('FollOps <no-reply@pickupja.com>'); expect(m.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal); });
  it('uses saved fallback and newest nonblank rows per key', async () => {
    vi.stubEnv('RESEND_API_KEY', ''); vi.stubEnv('RECOVERY_FROM_EMAIL', '');
    m.order.mockResolvedValue({ data: [{ setting_key: 'RESEND_API_KEY', setting_value: ' ' }, { setting_key: 'RESEND_API_KEY', setting_value: 'new-key-test' }, { setting_key: 'RESEND_API_KEY', setting_value: 'old-key-test' }, { setting_key: 'RECOVERY_FROM_EMAIL', setting_value: 'FollOps <no-reply@pickupja.com>' }, { setting_key: 'RECOVERY_FROM_EMAIL', setting_value: 'Old <old@example.test>' }], error: null });
    expect((await invoke()).payload.success).toBe(true); expect(m.in).toHaveBeenCalledWith('setting_key', ['RESEND_API_KEY', 'RECOVERY_FROM_EMAIL']); expect(m.order).toHaveBeenCalledWith('updated_at', { ascending: false }); expect(m.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer new-key-test'); expect(JSON.parse(m.fetch.mock.calls[0][1].body).from).toBe('FollOps <no-reply@pickupja.com>');
  });
  it('preserves env key when sender comes from DB', async () => { vi.stubEnv('RECOVERY_FROM_EMAIL', ''); m.order.mockResolvedValue({ data: [{ setting_key: 'RESEND_API_KEY', setting_value: 'db-test' }, { setting_key: 'RECOVERY_FROM_EMAIL', setting_value: 'FollOps <no-reply@pickupja.com>' }], error: null }); await invoke(); expect(m.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer resend-test'); });
  it('keeps original sender default if no recovery override exists', async () => { vi.stubEnv('RECOVERY_FROM_EMAIL', ''); await invoke(); expect(JSON.parse(m.fetch.mock.calls[0][1].body).from).toBe('DHD SalesTrail <support@dirtyhanddesigns.com>'); });
  it('reports missing mail key without sending', async () => { vi.stubEnv('RESEND_API_KEY', ''); const r = await invoke(); expect(r.payload.deliveryError).toBe('missing_key'); expect(m.fetch).not.toHaveBeenCalled(); });
  it('fails closed on settings error', async () => { vi.stubEnv('RESEND_API_KEY', ''); m.order.mockResolvedValue({ data: null, error: { message: 'private-key' } }); const r = await invoke(); expect(r.payload.deliveryError).toBe('configuration_unavailable'); expect(JSON.stringify(r.payload)).not.toContain('private-key'); expect(m.fetch).not.toHaveBeenCalled(); });
  it.each(['FollOps <no-reply@pickupja.com>\r\nBcc: victim@example.test', 'bad-email', 'valid@example.test\n', 'Name <valid@example.test', 'x'.repeat(321)])('rejects malformed sender %j before network', async sender => { vi.stubEnv('RECOVERY_FROM_EMAIL', sender); expect((await invoke()).payload.deliveryError).toBe('invalid_sender'); expect(m.fetch).not.toHaveBeenCalled(); });
  it.each([[401, {}, 'invalid_credentials'], [403, { name: 'validation_error', message: 'The pickupja.com domain is not verified' }, 'sender_unverified'], [429, {}, 'rate_limited'], [503, {}, 'provider_unavailable'], [400, { message: 'untrusted private-token private-key' }, 'provider_rejected']])('categorizes status %i without echoing body', async (status, response, category) => { const logger = vi.spyOn(console, 'error').mockImplementation(() => {}); m.fetch.mockResolvedValue({ ok: false, status, json: async () => response }); const r = await invoke(); expect(r.payload.deliveryError).toBe(category); expect(JSON.stringify(r.payload)).not.toMatch(/private-token|private-key/); expect(logger).not.toHaveBeenCalled(); expect(m.fetch).toHaveBeenCalledTimes(1); });
  it('handles non-JSON rejection safely', async () => { m.fetch.mockResolvedValue({ ok: false, status: 403, json: async () => { throw new Error('private-token'); } }); expect((await invoke()).payload.deliveryError).toBe('provider_rejected'); });
  it('handles timeout/network errors without echoing error messages', async () => { m.fetch.mockRejectedValue(new Error('private-token private-key')); const r = await invoke(); expect(r.payload.deliveryError).toBe('provider_unavailable'); expect(JSON.stringify(r.payload)).not.toContain('private-token'); });
  it('does not retry rejected env key with saved credentials', async () => { vi.stubEnv('RECOVERY_FROM_EMAIL', ''); m.order.mockResolvedValue({ data: [{ setting_key: 'RESEND_API_KEY', setting_value: 'saved-test-key' }], error: null }); m.fetch.mockResolvedValue({ ok: false, status: 401 }); expect((await invoke()).payload.deliveryError).toBe('invalid_credentials'); expect(m.fetch).toHaveBeenCalledTimes(1); expect(m.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer resend-test'); });
  it('defaults to public canonical origin instead of protected deployment host', async () => { vi.stubEnv('RECOVERY_APP_URL', ''); vi.stubEnv('VERCEL_URL', 'protected-snapshot.example'); await invoke({ authorization: 'Bearer session', host: 'evil.example' }); const email = JSON.parse(m.fetch.mock.calls[0][1].body); expect(email.html).toContain('https://dhd-crm-saletrail.vercel.app/#/recovery'); expect(email.html).not.toContain('protected-snapshot.example'); });
  it.each(['http://unsafe.example', 'https://user:password@unsafe.example', 'not a URL'])('rejects malformed or insecure recovery origin %s', async origin => { vi.stubEnv('RECOVERY_APP_URL', origin); expect((await invoke()).payload.success).toBe(false); expect(m.fetch).not.toHaveBeenCalled(); expect(m.generateLink).not.toHaveBeenCalled(); });
});
