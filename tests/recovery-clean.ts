// Behavioral test for recovery-clear endpoint (actual handler invocation via mock request/response)
import { describe, it, expect, vi } from 'vitest';
import handler from '../api/recovery-clear';

describe('recovery-clear endpoint', () => {
  it('rejects non-POST', () => {
    const req = { method: 'GET', headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
  it('rejects missing bearer token', () => {
    const req = { method: 'POST', headers: { authorization: '' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
