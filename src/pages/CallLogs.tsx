import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  MessageSquare, Search, Filter, RefreshCw, Smartphone,
  ChevronDown, QrCode
} from 'lucide-react';
import CompanionConnect from '../components/CompanionConnect';

interface GSMCall {
  id: string;
  phoneNumber: string;
  phoneNormalized: string;
  callType: 'INCOMING' | 'OUTGOING' | 'MISSED' | 'UNKNOWN';
  duration: number;
  calledAt: string;
  contactId: string | null;
  contactName: string | null;
  deviceModel: string | null;
  repPhone: string | null;
  repName: string | null;
}

interface RepOption {
  phone: string;
  name: string | null;
}

interface WhatsAppCall {
  id: string;
  type: 'call';
  callType: string;
  status: string;
  duration: number;
  timestamp: string;
  endedAt?: string;
  chatId?: string;
  contactName?: string;
}

type ActiveTab = 'gsm' | 'whatsapp';

const formatDuration = (seconds: number) => {
  if (!seconds || seconds === 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatDateTime = (ts: string) => {
  const d = new Date(ts);
  return {
    date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
};

// ─── GSM call row icons / badges ─────────────────────────────────────────────

const gsmIcon = (type: string) => {
  switch (type) {
    case 'INCOMING': return <PhoneIncoming className="w-4 h-4 text-green-400" />;
    case 'OUTGOING': return <PhoneOutgoing className="w-4 h-4 text-blue-400" />;
    case 'MISSED':   return <PhoneMissed   className="w-4 h-4 text-red-400"  />;
    default:         return <Phone         className="w-4 h-4 text-gray-500" />;
  }
};

const gsmBadge = (type: string) => {
  const map: Record<string, string> = {
    INCOMING: 'bg-green-500/10 text-green-400',
    OUTGOING: 'bg-blue-500/10 text-blue-400',
    MISSED:   'bg-red-500/10 text-red-400',
    UNKNOWN:  'bg-gray-500/10 text-gray-400',
  };
  return map[type] || 'bg-gray-500/10 text-gray-400';
};

// ─── Component ────────────────────────────────────────────────────────────────

const CallLogs: React.FC = () => {
  const [tab, setTab]               = useState<ActiveTab>('gsm');
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [repFilter, setRepFilter]   = useState('all');
  const [reps, setReps]             = useState<RepOption[]>([]);
  const [showConnect, setShowConnect] = useState(false);

  // GSM state
  const [gsmCalls, setGsmCalls]   = useState<GSMCall[]>([]);
  const [gsmTotal, setGsmTotal]   = useState(0);
  const [gsmOffset, setGsmOffset] = useState(0);
  const [gsmLoading, setGsmLoading] = useState(false);
  const [gsmError, setGsmError]   = useState<string | null>(null);

  // WhatsApp call state
  const [waCalls, setWaCalls]     = useState<WhatsAppCall[]>([]);
  const [waLoading, setWaLoading] = useState(false);

  const PAGE = 100;

  // ─── Fetch GSM calls ─────────────────────────────────────────────────────

  const loadGSMCalls = useCallback(async (reset = false) => {
    setGsmLoading(true);
    setGsmError(null);
    const offset = reset ? 0 : gsmOffset;
    try {
      const params = new URLSearchParams({
        action: 'getGSMCalls',
        limit: String(PAGE),
        offset: String(offset),
        ...(typeFilter !== 'All' ? { type: typeFilter } : {}),
        ...(repFilter  !== 'all' ? { rep:  repFilter  } : {}),
      });
      const res  = await fetch(`/api/whatsapp?${params}`);
      const data = await res.json();
      if (data.success) {
        // Map snake_case DB fields to camelCase
        const mapped = (data.calls || []).map((c: any) => ({
          ...c,
          repPhone: c.rep_phone ?? null,
          repName:  c.rep_name  ?? null,
        }));
        setGsmCalls(prev => reset ? mapped : [...prev, ...mapped]);
        setGsmTotal(data.total ?? 0);
        setGsmOffset(offset + mapped.length);
      } else {
        setGsmError(data.error || 'Failed to load calls');
      }
    } catch (e: any) {
      setGsmError(e.message);
    }
    setGsmLoading(false);
  }, [gsmOffset, typeFilter, repFilter]);

  // Load unique reps for filter dropdown
  const loadReps = useCallback(async () => {
    try {
      const res  = await fetch('/api/whatsapp?action=getDevices');
      const data = await res.json();
      if (data.success) {
        setReps((data.devices || []).map((d: any) => ({
          phone: d.phone_number,
          name:  d.device_name || null,
        })));
      }
    } catch {}
  }, []);

  // ─── Fetch WhatsApp calls ─────────────────────────────────────────────────

  const loadWACalls = useCallback(async () => {
    setWaLoading(true);
    try {
      const res  = await fetch('/api/whatsapp?action=getAllCalls&limit=200');
      const data = await res.json();
      if (data.success) setWaCalls(data.calls || []);
    } catch {}
    setWaLoading(false);
  }, []);

  useEffect(() => { loadGSMCalls(true); setGsmOffset(0); }, [typeFilter, repFilter]);
  useEffect(() => { loadWACalls(); loadReps(); }, []);

  // ─── Filtering ───────────────────────────────────────────────────────────

  const filteredGSM = gsmCalls.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.contactName || '').toLowerCase().includes(q) ||
      c.phoneNumber.includes(q) ||
      (c.deviceModel || '').toLowerCase().includes(q) ||
      (c.repName  || '').toLowerCase().includes(q) ||
      (c.repPhone || '').includes(q)
    );
  });

  const filteredWA = waCalls.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.contactName || '').toLowerCase().includes(q);
  });

  // ─── Stats ───────────────────────────────────────────────────────────────

  const gsmStats = {
    total:    gsmTotal,
    incoming: gsmCalls.filter(c => c.callType === 'INCOMING').length,
    outgoing: gsmCalls.filter(c => c.callType === 'OUTGOING').length,
    missed:   gsmCalls.filter(c => c.callType === 'MISSED').length,
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Call Logs</h1>
          <p className="text-gray-400 text-sm mt-1">
            GSM cellular calls from your Android app · WhatsApp VoIP calls
          </p>
        </div>
        <button
          onClick={() => { loadGSMCalls(true); setGsmOffset(0); loadWACalls(); }}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('gsm')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'gsm'
              ? 'bg-amber-500 text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          GSM Calls
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            tab === 'gsm' ? 'bg-black/20 text-black' : 'bg-gray-700 text-gray-300'
          }`}>
            {gsmTotal}
          </span>
        </button>
        <button
          onClick={() => setTab('whatsapp')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'whatsapp'
              ? 'bg-emerald-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          WhatsApp
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            tab === 'whatsapp' ? 'bg-white/20' : 'bg-gray-700 text-gray-300'
          }`}>
            {waCalls.length}
          </span>
        </button>
      </div>

      {/* ── GSM TAB ─────────────────────────────────────────────────────── */}
      {tab === 'gsm' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Synced', value: gsmStats.total,    color: 'text-white'      },
              { label: 'Incoming',     value: gsmStats.incoming,  color: 'text-green-400'  },
              { label: 'Outgoing',     value: gsmStats.outgoing,  color: 'text-blue-400'   },
              { label: 'Missed',       value: gsmStats.missed,    color: 'text-red-400'    },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search contact, number, device..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-amber-500/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="bg-gray-900 border border-gray-800 rounded-xl py-2.5 px-3 text-sm text-white outline-none"
              >
                {['All', 'INCOMING', 'OUTGOING', 'MISSED'].map(t => (
                  <option key={t} value={t}>{t === 'All' ? 'All Types' : t.charAt(0) + t.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            {reps.length > 0 && (
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-gray-500" />
                <select
                  value={repFilter}
                  onChange={e => setRepFilter(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded-xl py-2.5 px-3 text-sm text-white outline-none"
                >
                  <option value="all">All Reps</option>
                  {reps.map(r => (
                    <option key={r.phone} value={r.phone}>
                      {r.name || r.phone}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => setShowConnect(true)}
              className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/40 text-amber-400 rounded-xl py-2.5 px-4 text-sm font-semibold hover:bg-amber-500/20"
            >
              <QrCode className="w-4 h-4" /> Connect Phone
            </button>
          </div>

          {showConnect && (
            <CompanionConnect asModal onClose={() => setShowConnect(false)} />
          )}

          {/* Empty state — no app installed yet */}
          {!gsmLoading && gsmTotal === 0 && !gsmError && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No GSM calls synced yet</h3>
              <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                Install the DHD-CRM companion app on your Android phone to automatically
                sync cellular call logs here. The app runs in the background and syncs
                every 60 minutes.
              </p>
              <div className="flex justify-center">
                <CompanionConnect />
              </div>
            </div>
          )}

          {/* Error */}
          {gsmError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              {gsmError}
            </div>
          )}

          {/* Table */}
          {filteredGSM.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      {['Type', 'Contact / Number', 'Sales Rep', 'Duration', 'Date & Time', 'Device', 'WhatsApp'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredGSM.map(call => {
                      const { date, time } = formatDateTime(call.calledAt);
                      const waNum = call.phoneNormalized || call.phoneNumber.replace(/\D/g, '');
                      return (
                        <tr key={call.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {gsmIcon(call.callType)}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${gsmBadge(call.callType)}`}>
                                {call.callType.charAt(0) + call.callType.slice(1).toLowerCase()}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-white">
                              {call.contactName || call.phoneNumber}
                            </p>
                            {call.contactName && (
                              <p className="text-xs text-gray-500">{call.phoneNumber}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {call.repPhone ? (
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {call.repName || <span className="text-gray-500 italic text-xs">Unnamed</span>}
                                </p>
                                <p className="text-xs text-blue-400 font-mono">{call.repPhone}</p>
                              </div>
                            ) : (
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {call.callType === 'MISSED' ? (
                              <span className="text-red-400">—</span>
                            ) : formatDuration(call.duration)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-300">{date}</p>
                            <p className="text-xs text-gray-500">{time}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {call.deviceModel || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {waNum && (
                              <a
                                href={`https://wa.me/${waNum}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-7 h-7 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg flex items-center justify-center transition-all"
                                title="Open in WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer */}
              <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
                <span>Showing {filteredGSM.length} of {gsmTotal} calls</span>
                {gsmOffset < gsmTotal && (
                  <button
                    onClick={() => loadGSMCalls(false)}
                    disabled={gsmLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
                  >
                    {gsmLoading ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    Load more
                  </button>
                )}
              </div>
            </div>
          )}

          {gsmLoading && gsmCalls.length === 0 && (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-6 h-6 text-gray-600 animate-spin" />
            </div>
          )}
        </>
      )}

      {/* ── WHATSAPP TAB ─────────────────────────────────────────────────── */}
      {tab === 'whatsapp' && (
        <>
          {/* Filters */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search contact..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-emerald-500/50"
            />
          </div>

          {waLoading && (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-6 h-6 text-gray-600 animate-spin" />
            </div>
          )}

          {!waLoading && waCalls.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
              <MessageSquare className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No WhatsApp calls logged yet.</p>
              <p className="text-gray-600 text-xs mt-1">
                Go to WhatsApp → Setup → Auto-Configure Webhook to enable CALL events.
              </p>
            </div>
          )}

          {filteredWA.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      {['Type', 'Contact', 'Duration', 'Status', 'Date & Time'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredWA.map(call => {
                      const { date, time } = formatDateTime(call.timestamp);
                      const isMissed  = call.status === 'missed' || call.status === 'rejected';
                      const isVideo   = call.callType === 'video';
                      return (
                        <tr key={call.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <MessageSquare className={`w-4 h-4 ${isMissed ? 'text-red-400' : 'text-emerald-400'}`} />
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                isMissed ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                              }`}>
                                {isVideo ? 'Video' : 'Voice'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-white">{call.contactName || call.chatId || '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {isMissed ? <span className="text-red-400">—</span> : formatDuration(call.duration)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                              call.status === 'answered' ? 'bg-green-500/10 text-green-400'
                              : call.status === 'missed' ? 'bg-red-500/10 text-red-400'
                              : 'bg-gray-500/10 text-gray-400'
                            }`}>
                              {call.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-300">{date}</p>
                            <p className="text-xs text-gray-500">{time}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-500">
                {filteredWA.length} WhatsApp calls
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CallLogs;
