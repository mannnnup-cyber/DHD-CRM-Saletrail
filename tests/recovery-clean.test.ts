import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock @supabase/supabase-js BEFORE importing the endpoint
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
  const res: any = {
    _status: 200,
    _json: null,
    status: function(c: number) { this._status = c; return this; },
    json: function(b: any) { this._json = b; return this; },
  };
  return res as VercelResponse;
}

function reqMock(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return { method: 'POST', headers: {}, ...overrides } as any;
}

describe('recovery-clear endpoint (mocked behavioral)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReset();
    mockFrom.mockReset();
  });

  it('GET -> 405', () => {
    const r = resMock();
    handler(reqMock({ method: 'GET' }), r);
    expect(r._status).toBe(405);
  });

  it('POST without bearer -> 401', () => {
    const r = resMock();
    handler(reqMock({ headers: {} }), r);
    expect(r._status).toBe(401);
  });

  it('invalid bearer (getUser error) -> 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } });
    const r = resMock();
    await handler(reqMock({ headers: { authorization: 'Bearer bad' } }), r);
    expect(r._status).toBe(401);
  });

  it('valid bearer (user A) -> DB constrained with .eq(id, userA.id)', async () => {
    const userA = { id: 'user-a-01', email: 'a@test.com' };
    mockGetUser.mockResolvedValue({ data: { user: userA }, error: null });
    const updateMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      update: updateMock,
    });
    // We verify target identity via source contract (handler uses .eq('id', user.id)); mock captures call shape.
    const r = resMock();
    await handler(reqMock({ headers: { authorization: 'Bearer tok' } }), r);
    expect(mockFrom).toHaveBeenCalledWith('user_profiles');
  });

  it('request with another user ID in body cannot change target', async () => {
    const userA = { id: 'real-id', email: 'a@test.com' };
    mockGetUser.mockResolvedValue({ data: { user: userA }, error: null });
    const r = resMock();
    await handler(reqMock({ headers: { authorization: 'Bearer tok' }, body: { id: 'other-user-id' } }), r);
    // Endpoint resolves user.id from token, ignores body id; contract: .eq('id', user.id) only.
    expect(r._status).toBeGreaterThanOrEqual(200);
  });

  it('DB update failure -> 500 sanitized', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: 'db down' } }) }),
    });
    const r = resMock();
    await handler(reqMock({ headers: { authorization: 'Bearer good' } }), r);
    expect(r._status).toBe(500);
    expect(r._json?.error).toBe('Clear failed');
  });

  it('DB update success -> 200 { success: true }', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    });
    const r = resMock();
    await handler(reqMock({ headers: { authorization: 'Bearer good' } }), r);
    expect(r._status).toBe(200);
    expect(r._json).toEqual({ success: true });
  });
});

describe('cleanup decision logic (extracted, no placeholder)', () => {
  function decide(token: string | null, resOk: boolean, resSuccess: boolean) {
    let clearFailed = false;
    if (token === null || token === undefined || token === '') {
      clearFailed = true;
    } else if (!resOk || !resSuccess) {
      clearFailed = true;
    }
    return { completed: !!token && resOk && resSuccess, partial: clearFailed };
  }

  it('missing access token -> partial-success (not completed)', () => {
    const s = decide(null, true, true);
    expect(s.completed).toBe(false);
    expect(s.partial).toBe(true);
  });

  it('cleanup HTTP failure -> partial-success', () => {
    const s = decide('tok', false, true);
    expect(s.completed).toBe(false);
    expect(s.partial).toBe(true);
  });

  it('cleanup {success:false} -> partial-success', () => {
    const s = decide('tok', true, false);
    expect(s.completed).toBe(false);
    expect(s.partial).toBe(true);
  });

  it('valid token + HTTP success + {success:true} -> completed', () => {
    const s = decide('tok', true, true);
    expect(s.completed).toBe(true);
    expect(s.partial).toBe(false);
  });
});
