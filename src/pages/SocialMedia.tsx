import { useState, useEffect, useCallback } from 'react';
import {
  Share2, RefreshCw, ExternalLink, AlertCircle, CheckCircle2, Loader2,
  Instagram, Facebook, Linkedin, Youtube, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, KeyRound, Globe, Plug, Activity
} from 'lucide-react';

const STUDIO_URL = 'https://studio.brightbean.xyz';

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  account_handle: string;
  connection_status: 'connected' | 'token_expiring' | 'disconnected' | 'error';
}

interface DerivedMetric {
  key: string;
  label: string;
  kind: 'count' | 'percent' | 'minutes';
  value: number;
  delta: number | null;
  series?: number[];
}

interface StatusResponse {
  success: boolean;
  configured: boolean;
  workspace?: string | null;
  permissions?: string[];
  accounts?: SocialAccount[];
  apiError?: string | null;
  error?: string;
}

const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram, instagram_login: Instagram,
  facebook: Facebook,
  linkedin_personal: Linkedin, linkedin_company: Linkedin,
  youtube: Youtube,
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', instagram_login: 'Instagram',
  facebook: 'Facebook',
  linkedin_personal: 'LinkedIn', linkedin_company: 'LinkedIn Page',
  tiktok: 'TikTok', youtube: 'YouTube', pinterest: 'Pinterest',
  threads: 'Threads', mastodon: 'Mastodon', bluesky: 'Bluesky',
  google_business: 'Google Business',
};

const STATUS_STYLES: Record<string, string> = {
  connected: 'bg-green-500/10 text-green-400 border-green-500/30',
  token_expiring: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  disconnected: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  error: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const SETUP_STEPS = [
  { n: '1', title: 'Sign up free', body: 'Create a free account at studio.brightbean.xyz — no credit card, no limits.', link: STUDIO_URL },
  { n: '2', title: 'Connect social accounts', body: 'In Studio, go to social accounts and connect Instagram, Facebook, TikTok, etc. Note: Instagram/Facebook need your own Meta developer app (free) approved by Meta first.' },
  { n: '3', title: 'Create an API key', body: 'In Studio go to Organization → API Keys. Create a key with create_posts and view_analytics scopes. It looks like bb_studio_...' },
  { n: '4', title: 'Add the key to the CRM', body: 'Add BRIGHTBEAN_API_KEY to the environment variables in Vercel (and .env.production locally), then redeploy. This page will light up automatically.' },
];

const fmtValue = (m: DerivedMetric) => {
  if (m.kind === 'percent') return `${m.value.toFixed(1)}%`;
  if (m.kind === 'minutes') {
    const h = Math.floor(m.value / 60);
    return h > 0 ? `${h}h ${Math.round(m.value % 60)}m` : `${Math.round(m.value)}m`;
  }
  return Math.round(m.value).toLocaleString();
};

const AccountCard: React.FC<{ account: SocialAccount; canAnalytics: boolean }> = ({ account, canAnalytics }) => {
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<DerivedMetric[] | null>(null);
  const [engRate, setEngRate] = useState<DerivedMetric | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const Icon = PLATFORM_ICONS[account.platform] || Share2;

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/social?action=analytics&account_id=${account.id}&days=30`);
      const json = await res.json();
      if (json.success && json.analytics) {
        if (json.analytics.analytics_available === false) {
          setUnavailable(json.analytics.unavailable_reason || 'Analytics not available for this account yet');
        } else {
          setMetrics(json.analytics.hero_metrics || []);
          setEngRate(json.analytics.engagement?.rate || null);
        }
      } else {
        setUnavailable(json.error || 'Failed to load analytics');
      }
    } catch {
      setUnavailable('Network error loading analytics');
    }
    setLoading(false);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && metrics === null && !unavailable) loadAnalytics();
  };

  const allMetrics = engRate ? [...(metrics || []), engRate] : metrics || [];
  // Keep the card tidy: at most 6 tiles
  const shown = allMetrics.slice(0, 6);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-800/40 transition-colors">
        <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{account.account_name || PLATFORM_LABELS[account.platform] || account.platform}</p>
          <p className="text-xs text-gray-500">
            {PLATFORM_LABELS[account.platform] || account.platform}
            {account.account_handle ? ` · ${account.account_handle}` : ''}
          </p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize ${STATUS_STYLES[account.connection_status] || STATUS_STYLES.disconnected}`}>
          {account.connection_status.replace('_', ' ')}
        </span>
        {canAnalytics && (open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />)}
      </button>

      {open && canAnalytics && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-800/60">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading 30-day analytics…
            </div>
          ) : unavailable ? (
            <p className="text-xs text-gray-500 py-3">{unavailable}</p>
          ) : shown.length === 0 ? (
            <p className="text-xs text-gray-500 py-3">No analytics metrics returned for this account yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3">
              {shown.map(m => (
                <div key={m.key} className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{m.label}</p>
                  <p className="text-lg font-bold text-white mt-0.5">{fmtValue(m)}</p>
                  {m.delta !== null && m.delta !== undefined && (
                    <p className={`text-xs flex items-center gap-1 mt-0.5 ${m.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {m.delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {m.delta >= 0 ? '+' : ''}{m.delta.toFixed(1)}% vs prior 30d
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SocialMedia: React.FC = () => {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/social?action=status');
      const json: StatusResponse = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load social media status');
      setStatus(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const accounts = status?.accounts || [];
  const connected = accounts.filter(a => a.connection_status === 'connected').length;
  const canAnalytics = (status?.permissions || []).includes('view_analytics');

  return (
    <div className="p-4 lg:p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Social Media</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Scheduling & publishing via BrightBean Studio — free hosted plan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href={STUDIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold px-4 py-2 rounded-xl transition-colors"
          >
            Open Studio <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : status && !status.configured ? (
        /* ── Not configured: setup guide ── */
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Plug className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-bold text-white">Connect BrightBean Studio</h2>
              <p className="text-xs text-gray-500">One-time setup — takes about 10 minutes plus platform approvals</p>
            </div>
          </div>
          <div className="space-y-3">
            {SETUP_STEPS.map(s => (
              <div key={s.n} className="flex gap-3 bg-gray-800/40 rounded-xl p-4">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-black font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {s.n}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{s.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{s.body}</p>
                  {s.link && (
                    <a href={s.link} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 mt-1.5">
                      studio.brightbean.xyz <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-800/30 rounded-xl p-3 mt-4">
            <KeyRound className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
            The API key is a server-side secret (BRIGHTBEAN_API_KEY) — never put it in frontend code or commit it to git.
          </div>
        </div>
      ) : (
        /* ── Configured: status + accounts ── */
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Connected', value: connected, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
              { label: 'Total Accounts', value: accounts.length, icon: Share2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { label: 'Workspace', value: status?.workspace || '—', icon: Globe, color: 'text-amber-400', bg: 'bg-amber-500/10', text: true },
              { label: 'API Status', value: status?.apiError ? 'Error' : 'Live', icon: Activity, color: status?.apiError ? 'text-red-400' : 'text-green-400', bg: status?.apiError ? 'bg-red-500/10' : 'bg-green-500/10', text: true },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <p className="text-xl font-bold text-white truncate">{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>

          {status?.apiError && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> Studio API issue: {status.apiError}
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Compose & Schedule', href: `${STUDIO_URL}/composer`, icon: Share2 },
              { label: 'Content Calendar', href: `${STUDIO_URL}/calendar`, icon: Globe },
              { label: 'Unified Inbox', href: `${STUDIO_URL}/inbox`, icon: Activity },
            ].map(q => (
              <a key={q.label} href={q.href} target="_blank" rel="noopener noreferrer"
                className="bg-gray-900 border border-gray-800 hover:border-amber-500/40 rounded-xl p-4 flex items-center gap-3 transition-colors group">
                <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <q.icon className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-sm font-medium text-gray-300 group-hover:text-white">{q.label}</span>
                <ExternalLink className="w-3.5 h-3.5 text-gray-600 ml-auto" />
              </a>
            ))}
          </div>

          {/* Accounts */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide px-1">Connected Accounts</h2>
            {accounts.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-gray-900 border border-gray-800 rounded-xl">
                <Share2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No social accounts connected yet</p>
                <p className="text-sm mt-1">Connect Instagram, Facebook, TikTok and more in BrightBean Studio.</p>
                <a href={STUDIO_URL} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-sm mt-3">
                  Open Studio <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              accounts.map(a => (
                <AccountCard key={a.id} account={a} canAnalytics={canAnalytics} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SocialMedia;
