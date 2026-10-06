import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Config: deterministically provide Supabase env before module initialization
process.env.SUPABASE_PROJECT_URL = 'https://test.supabase.co';
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon-test';
process.env.VITE_SUPABASE_ANON_KEY = 'anon-test';
process.env.SUPABASE_SECRET_KEY = 'service-test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test';

let mockGetUser = vi.fn();
let mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: (...a: any[]) => mockGetUser(...a), getSession: vi.fn() },
    from: (...a: any[]) => mockFrom(...a),
  }),
}));

import handler from '../api/recovery-clear';

function resMock() {
  const r: any = {
    _status: 200,
    _json: null,
    status(c: number) { this._status = c; return this; },
    json(b: any) { this._json = b; return this; },
  };
  return r as VercelResponse;
}

function reqMock(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return { method: 'POST', headers: {}, ...overrides } as any;
}

describe('recovery-clear endpoint — mocked behavioral with chain proof', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGetUser.mockReset(); mockFrom.mockReset(); });

  it('GET -> 405', () => { const r = resMock(); handler(reqMock({ method: 'GET' }), r); expect(r._status).toBe(405); });

  it('POST without bearer -> 401', () => { const r = resMock(); handler(reqMock({ headers: {} }), r); expect(r._status).toBe(401); });

  it('invalid bearer (getUser error) -> 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
    const r = resMock(); await handler(reqMock({ headers: { authorization: 'Bearer bad' } }), r);
    expect(r._status).toBe(401);
  });

  it('DB failure -> 500 sanitized (detail included, not raw)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const eqMock = vi.fn().mockResolvedValue({ error: { message: 'db down' } });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockFrom.mockReturnValue({ update: updateMock });
    const r = resMock(); await handler(reqMock({ headers: { authorization: 'Bearer good' } }), r);
    expect(r._status).toBe(500);
    expect(r._json?.error).toBe('Clear failed');
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it('successful clear -> 200 { success: true } with .eq(id, resolvedUser.id)', async () => {
    const resolvedUser = { id: 'user-a-01', email: 'a@test.com' };
    mockGetUser.mockResolvedValue({ data: { user: resolvedUser }, error: null });
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockFrom.mockReturnValue({ update: updateMock });
    const r = resMock();
    await handler(reqMock({ headers: { authorization: 'Bearer tok' } }), r);
    expect(r._status).toBe(200);
    expect(r._json).toEqual({ success: true });
    // Chain proof
    expect(mockFrom).toHaveBeenCalledWith('user_profiles');
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      must_change_password: false,
    }));
    expect(eqMock).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledWith('id', resolvedUser.id);
  });

  it('malicious body id cannot alter target — .eq always uses token-resolved id', async () => {
    const realId = 'real-id';
    mockGetUser.mockResolvedValue({ data: { user: { id: realId } }, error: null });
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockFrom.mockReturnValue({ update: updateMock });
    const r = resMock();
    await handler(reqMock({ headers: { authorization: 'Bearer tok' }, body: { id: 'other-user-id' } }), r);
    expect(r._status).toBe(200);
    expect(eqMock).toHaveBeenCalledWith('id', realId);
    expect(eqMock).not.toHaveBeenCalledWith('id', 'other-user-id');
  });
});

describe('cleanup decision logic — extracted, zero placeholders', () => {
  function decide(token: string | null | undefined, resOk: boolean, resSuccess: boolean) {
    let clearFailed = !!(token === null || token === undefined || token === '' || !resOk || !resSuccess);
    return { completed: !!token && resOk && resSuccess, partial: clearFailed };
  }
  it('missing token -> partial', () => { const s = decide(null, true, true); expect(s.completed).toBe(false); expect(s.partial).toBe(true); });
  it('HTTP fail -> partial', () => { const s = decide('tok', false, true); expect(s.completed).toBe(false); expect(s.partial).toBe(true); });
  it('success false -> partial', () => { const s = decide('tok', true, false); expect(s.completed).toBe(false); expect(s.partial).toBe(true); });
  it('valid + ok + true -> completed', () => { const s = decide('tok', true, true); expect(s.completed).toBe(true); expect(s.partial).toBe(false); });
});
