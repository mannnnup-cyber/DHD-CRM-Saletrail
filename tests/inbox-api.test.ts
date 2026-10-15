import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ getUser: vi.fn(), createClient: vi.fn(), calls: [] as any[], profile: {} as any, legacy: {} as any, rows: [] as any[], emailError: null as any }));
vi.mock('@supabase/supabase-js', () => ({ createClient: m.createClient }));
let handler: typeof import('../api/email').default;
const userId = '11111111-1111-4111-8111-111111111111';
const emailId = '22222222-2222-4222-8222-222222222222';
const contactId = '33333333-3333-4333-8333-333333333333';
async function request(query: any = { action: 'inbox' }, method = 'GET', headers: any = { authorization: 'Bearer signed-token' }) {
  const res: any = { code: 200, payload: null, headers: {}, setHeader(key: string, value: any) { this.headers[key] = value; }, status(code: number) { this.code = code; return this; }, json(payload: any) { this.payload = payload; return this; }, end() { return this; } };
  await handler({ query, method, headers } as any, res); return res;
}
describe('actual email handler access and plaintext projection', () => {
  beforeEach(async () => {
    vi.resetModules(); vi.resetAllMocks(); m.calls = []; m.emailError = null;
    vi.stubEnv('SUPABASE_PROJECT_URL', 'https://example.supabase.co'); vi.stubEnv('SUPABASE_ANON_KEY', 'anon-test'); vi.stubEnv('SUPABASE_SECRET_KEY', 'modern-test');
    m.profile = { id: userId, role: 'owner', email: 'actor@example.test', is_active: true }; m.legacy = { id: userId, email: 'actor@example.test', is_active: true };
    m.getUser.mockResolvedValue({ data: { user: { id: userId, email: 'actor@example.test' } }, error: null });
    m.rows = [{ id: emailId, contact_id: contactId, contact: { id: contactId, name: 'Assigned', assigned_to: userId }, subject: 'Stored', body: 'Plain text', body_html: '<img src="private-html">', ai_analysis: { token: 'private-meta' }, date: '2026-10-14T12:00:00.123456+00:00', read: false }];
    const from = (table: string) => {
      const chain: any = {};
      for (const operation of ['select', 'eq', 'or', 'order', 'limit', 'is', 'lt']) chain[operation] = vi.fn((...args) => { m.calls.push({ table, operation, args }); return chain; });
      chain.maybeSingle = vi.fn(async () => ({ data: table === 'user_profiles' ? m.profile : m.legacy, error: null }));
      chain.then = (resolve: any, reject: any) => Promise.resolve({ data: m.rows, error: table === 'emails' ? m.emailError : null }).then(resolve, reject);
      m.calls.push({ table, operation: 'from', args: [] }); return chain;
    };
    m.createClient.mockImplementation((_url, key) => key === 'anon-test' ? { auth: { getUser: m.getUser } } : { from });
    handler = (await import('../api/email')).default;
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('rejects missing bearer before querying private records', async () => { expect((await request(undefined, 'GET', {})).code).toBe(401); expect(m.calls).toHaveLength(0); });
  it('rejects invalid JWT', async () => { m.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'private-token' } }); const r = await request(); expect(r.code).toBe(401); expect(m.calls).toHaveLength(0); expect(JSON.stringify(r.payload)).not.toContain('private-token'); });
  it.each([{ ...{} , is_active: false, role: 'owner' }, { id: userId, role: 'unknown', is_active: true }, null])('denies inactive/missing/unknown profile', async profile => { m.profile = profile; expect((await request()).code).toBe(403); expect(m.calls.some(c => c.table === 'emails')).toBe(false); });
  it('uses modern key and sanitized nonpersistent clients', async () => { await request(); expect(m.createClient.mock.calls.filter(c => c[1] === 'modern-test').length).toBeGreaterThan(0); expect(m.createClient.mock.calls.find(c => c[1] === 'anon-test')[2].auth).toMatchObject({ persistSession: false, autoRefreshToken: false }); });
  it('requires modern key with no legacy fallback', async () => { vi.stubEnv('SUPABASE_SECRET_KEY', ''); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'legacy-test'); expect((await request()).code).toBe(503); expect(m.calls.some(c => c.table === 'emails')).toBe(false); });
  it.each(['owner', 'manager'])('allows %s minimized plaintext result', async role => { m.profile.role = role; const r = await request(); expect(r.code).toBe(200); expect(r.payload.items).toHaveLength(1); expect(JSON.stringify(r.payload)).not.toMatch(/private-html|private-meta|assigned_to/); expect(r.headers['Cache-Control']).toBe('no-store'); expect(m.calls.find(c => c.table === 'emails' && c.operation === 'select').args[0]).not.toContain('body_html'); });
  it('rep authorization filters contact assignment before ordering and pagination', async () => { m.profile.role = 'sales_rep'; const r = await request(); expect(r.payload.items).toHaveLength(1); const calls = m.calls.filter(c => c.table === 'emails'); expect(calls.find(c => c.operation === 'select').args[0]).toContain('contacts!inner'); const filter = calls.findIndex(c => c.operation === 'eq' && c.args[0] === 'contact.assigned_to' && c.args[1] === userId); expect(filter).toBeGreaterThan(-1); expect(filter).toBeLessThan(calls.findIndex(c => c.operation === 'limit')); });
  it.each([{ id: 'wrong-id', email: 'actor@example.test', is_active: true }, { id: userId, email: 'different@example.test', is_active: true }, { id: userId, email: 'actor@example.test', is_active: false }, null])('denies unverified legacy identity mapping', async legacy => { m.profile.role = 'rep'; m.legacy = legacy; expect((await request()).code).toBe(403); expect(m.calls.some(c => c.table === 'emails')).toBe(false); });
  it('rep row defense excludes unassigned/unresolved even if a mock or provider ignores filters', async () => { m.profile.role = 'rep'; m.rows = [{ ...m.rows[0], contact: null }, { ...m.rows[0], contact: { id: contactId, assigned_to: 'other-id' } }]; expect((await request()).payload.items).toEqual([]); });
  it.each(['list', 'threads', 'thread', 'stats', 'templates', 'predictive', 'send', 'reply', 'sync', 'analyze', 'aiSuggest', 'import', 'delete', 'markRead', 'markStarred', 'convertToLead', 'useTemplate'])('rep cannot bypass scoped Inbox via legacy %s', async action => { m.profile.role = 'rep'; expect((await request({ action })).code).toBe(403); expect(m.calls.some(c => c.table === 'emails')).toBe(false); });
  it.each(['markRead', 'markStarred', 'delete', 'convertToLead', 'sync', 'send'])('GET cannot trigger legacy mutation %s', async action => { expect((await request({ action })).code).toBe(405); expect(m.calls.some(c => c.table === 'emails')).toBe(false); });
  it('keeps authenticated legacy list shape', async () => { const r = await request({ action: 'list' }); expect(r.payload).toMatchObject({ success: true, emails: m.rows }); });
  it.each([{ action: 'inbox', limit: '51' }, { action: 'inbox', limit: ['1'] }, { action: 'inbox', cursor: '{bad' }, { action: 'inbox', cursor: JSON.stringify({ id: emailId, date: '2026-10-14T12:00:00Z),evil.eq.true' }) }])('bounds malformed query', async query => { expect((await request(query)).code).toBe(400); expect(m.calls.some(c => c.table === 'emails')).toBe(false); });
  it('preserves microsecond cursor to avoid page-boundary skips', async () => { m.rows.push({ ...m.rows[0], id: '44444444-4444-4444-8444-444444444444' }); const first = await request({ action: 'inbox', limit: '1' }); const cursor = first.payload.nextCursor; expect(JSON.parse(cursor).date).toBe('2026-10-14T12:00:00.123456+00:00'); m.calls = []; await request({ action: 'inbox', limit: '1', cursor }); expect(m.calls.find(c => c.table === 'emails' && c.operation === 'or').args[0]).toContain('date.eq.2026-10-14T12:00:00.123456+00:00'); });
  it('handles null-date cursor phase explicitly', async () => { await request({ action: 'inbox', cursor: JSON.stringify({ id: emailId, date: null }) }); expect(m.calls).toContainEqual({ table: 'emails', operation: 'is', args: ['date', null] }); expect(m.calls).toContainEqual({ table: 'emails', operation: 'lt', args: ['id', emailId] }); });
  it('reports database/schema errors rather than success-empty', async () => { m.emailError = { message: 'private-schema-details' }; const r = await request(); expect(r.code).toBe(503); expect(JSON.stringify(r.payload)).not.toContain('private-schema-details'); });
  it('deduplicates stored row replay without customer data persistence', async () => { m.rows.push({ ...m.rows[0] }); expect((await request()).payload.items).toHaveLength(1); });
});
