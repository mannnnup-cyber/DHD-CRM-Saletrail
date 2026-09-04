import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

// BrightBean Studio hosted API (social media scheduling/publishing).
// Key is workspace-scoped: Authorization: Bearer bb_studio_...
// Read from app_settings first (DB wins over env, same pattern as Evolution API),
// with a short TTL cache to avoid a DB round-trip on every request.
const BB_API_URL = (process.env.BRIGHTBEAN_API_URL || 'https://studio.brightbean.xyz/api/v1').replace(/\/+$/, '');
const ENV_BB_API_KEY = process.env.BRIGHTBEAN_API_KEY || '';

let _bbKeyCache: { value: string | null; expires: number } = { value: null, expires: 0 };

async function getBrightBeanKey(): Promise<string | null> {
  if (Date.now() < _bbKeyCache.expires) return _bbKeyCache.value;
  // Server env (Vercel) wins; app_settings is the fallback so rotated keys
  // never need to be written back into the database.
  let value: string | null = ENV_BB_API_KEY || null;
  if (!value) {
    try {
      const { data } = await supabase!
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'BRIGHTBEAN_API_KEY')
        .maybeSingle();
      value = (data?.setting_value as string) || null;
    } catch { /* no env and no DB value */ }
  }
  _bbKeyCache = { value, expires: Date.now() + 5000 };
  return value;
}

// NOTE: BrightBean routing is inconsistent — /me/ and /accounts/ REQUIRE a
// trailing slash, but /analytics/accounts/{id} must NOT have one. Pass explicit
// paths; no auto-normalization.
async function bbGet(path: string, apiKey: string): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${BB_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  return { ok: res.ok, status: res.status, data };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const action = (req.query.action as string) || 'status';
  const apiKey = await getBrightBeanKey();

  // Not configured yet — return a soft success so the UI can show setup steps
  // instead of an error banner.
  if (!apiKey) {
    return res.json({ success: true, configured: false, accounts: [] });
  }

  try {
    // ── GET /api/social?action=status — workspace info + connected accounts ──
    if (action === 'status') {
      const [me, accounts] = await Promise.all([bbGet('/me/', apiKey), bbGet('/accounts/', apiKey)]);
      if (me.status === 401 || accounts.status === 401) {
        return res.status(401).json({ error: 'BrightBean API key rejected — check BRIGHTBEAN_API_KEY' });
      }
      return res.json({
        success: true,
        configured: true,
        workspace: me.ok ? (me.data?.workspace_name ?? null) : null,
        permissions: me.ok ? (me.data?.permissions ?? []) : [],
        accounts: accounts.ok ? (accounts.data?.accounts ?? []) : [],
        apiError: !accounts.ok ? (accounts.data ? JSON.stringify(accounts.data) : `HTTP ${accounts.status}`) : null,
      });
    }

    // ── GET /api/social?action=accounts — connected social accounts ─────────
    if (action === 'accounts') {
      const r = await bbGet('/accounts/', apiKey);
      if (r.status === 401) return res.status(401).json({ error: 'BrightBean API key rejected' });
      if (!r.ok) return res.status(502).json({ error: `BrightBean API error (HTTP ${r.status})` });
      return res.json({ success: true, accounts: r.data?.accounts ?? [] });
    }

    // ── GET /api/social?action=analytics&account_id=...&days=30 ─────────────
    if (action === 'analytics') {
      const accountId = req.query.account_id as string;
      if (!accountId) return res.status(400).json({ error: 'account_id required' });
      const days = ['7', '30', '90'].includes(req.query.days as string) ? req.query.days : '30';
      const r = await bbGet(`/analytics/accounts/${accountId}?days=${days}`, apiKey);
      if (r.status === 401) return res.status(401).json({ error: 'BrightBean API key rejected' });
      if (r.status === 403) return res.status(403).json({ error: 'API key lacks view_analytics permission' });
      if (!r.ok) return res.status(502).json({ error: `BrightBean API error (HTTP ${r.status})` });
      return res.json({ success: true, analytics: r.data });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e: any) {
    return res.status(502).json({ error: `BrightBean API unreachable: ${e.message}` });
  }
}
