import React, { useState, useEffect } from 'react';
import { RefreshCw, Phone, PhoneIncoming, PhoneMissed, CheckCircle, AlertCircle, Wifi, WifiOff, Clock, User, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwE25FyY0KkTSfiIcWBCpYTzeQR6B6oECo3T7QFfa5OvWClRNYxXqOK72OBhr1bWC5Z/exec';

interface SheetCall {
  rep: string;
  number: string;
  type: string;
  duration: string;
  date: string;
  time: string;
  name: string;
  isValid: boolean;
}

function safeStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function isValidNumber(val: string): boolean {
  const s = safeStr(val);
  if (!s) return false;
  if (s === '?') return false;
  if (s.includes('[')) return false;
  if (s.toUpperCase().includes('VARIABLE')) return false;
  if (s.toUpperCase().includes('YOUR_NAME')) return false;
  if (s.length < 7) return false;
  return true;
}

function isValidRow(row: any): boolean {
  const rep = safeStr(row.rep);
  if (!rep) return false;
  if (rep.toUpperCase() === 'YOUR_NAME') return false;
  if (rep === 'Rep Name') return false;
  if (rep.toUpperCase() === 'VARIABLE') return false;
  return true;
}

function formatPhone(val: any): string {
  const s = safeStr(val);
  if (!s || !isValidNumber(s)) return s || 'Unknown';
  const cleaned = s.replace(/\D/g, '');
  if (cleaned.length === 10) return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  if (cleaned.length === 11) return `+${cleaned[0]} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  if (cleaned.length === 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return s;
}

// JSONP fetch - bypasses CORS completely
function fetchViaJSONP(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const callbackName = 'dhd_callback_' + Date.now();
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Request timed out after 15 seconds'));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete (window as any)[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    (window as any)[callbackName] = (data: any) => {
      cleanup();
      resolve(data);
    };

    script.src = `${url}&callback=${callbackName}`;
    script.onerror = () => {
      cleanup();
      reject(new Error('Failed to load script - check your Apps Script URL'));
    };
    document.head.appendChild(script);
  });
}

export default function CallSync() {
  const { setSyncedCalls } = useApp();
  const [calls, setCalls] = useState<SheetCall[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState('all');
  const [repFilter, setRepFilter] = useState('all');
  const [search, setSearch] = useState('');

  const syncNow = async () => {
    setSyncing(true);
    setError(null);
    try {
      const data = await fetchViaJSONP(`${APPS_SCRIPT_URL}?action=read`);

      if (!data || !data.success) {
        throw new Error(data?.error || 'Apps Script returned an error');
      }

      const rawData: any[] = data.data || [];

      const parsed: SheetCall[] = rawData
        .filter(isValidRow)
        .map((row: any) => ({
          rep: safeStr(row.rep),
          number: safeStr(row.number),
          type: safeStr(row.type) || 'Unknown',
          duration: safeStr(row.duration) || '0',
          date: safeStr(row.date),
          time: safeStr(row.time),
          name: safeStr(row.name),
          isValid: isValidNumber(safeStr(row.number)),
        }));

      setCalls(parsed);
      setConnected(true);
      setLastSync(new Date().toLocaleTimeString());
      // Update context so Team, Reports, Dashboard all reflect real data
      setSyncedCalls(parsed);
      localStorage.setItem('dhd_synced_calls', JSON.stringify(parsed));
      localStorage.setItem('dhd_last_sync', new Date().toISOString());

    } catch (err: any) {
      setError(err.message || 'Failed to sync. Make sure your Apps Script is deployed with JSONP support.');
      setConnected(false);

      // Try loading from cache
      const cached = localStorage.getItem('dhd_synced_calls');
      if (cached) {
        try {
          setCalls(JSON.parse(cached));
          const lastSyncTime = localStorage.getItem('dhd_last_sync');
          if (lastSyncTime) setLastSync('From cache — ' + new Date(lastSyncTime).toLocaleTimeString());
        } catch { /* ignore */ }
      }
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem('dhd_synced_calls');
    if (cached) {
      try {
        setCalls(JSON.parse(cached));
        const lastSyncTime = localStorage.getItem('dhd_last_sync');
        if (lastSyncTime) {
          setLastSync(new Date(lastSyncTime).toLocaleTimeString());
          setConnected(true);
        }
      } catch { /* ignore */ }
    }
  }, []);

  const reps = Array.from(new Set(calls.map(c => c.rep).filter(Boolean)));

  const filtered = calls.filter(c => {
    if (filter !== 'all' && safeStr(c.type).toLowerCase() !== filter) return false;
    if (repFilter !== 'all' && c.rep !== repFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        safeStr(c.number).toLowerCase().includes(q) ||
        safeStr(c.name).toLowerCase().includes(q) ||
        safeStr(c.rep).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const validCalls = calls.filter(c => c.isValid);
  const outgoing = validCalls.filter(c => safeStr(c.type).toLowerCase() === 'outgoing').length;
  const incoming = validCalls.filter(c => safeStr(c.type).toLowerCase() === 'incoming').length;
  const missed = validCalls.filter(c => safeStr(c.type).toLowerCase() === 'missed').length;

  const getCallIcon = (type: string) => {
    const t = safeStr(type).toLowerCase();
    if (t === 'outgoing') return <Phone className="w-4 h-4 text-blue-400" />;
    if (t === 'incoming') return <PhoneIncoming className="w-4 h-4 text-green-400" />;
    if (t === 'missed') return <PhoneMissed className="w-4 h-4 text-red-400" />;
    return <Phone className="w-4 h-4 text-gray-400" />;
  };

  const getCallBadge = (type: string) => {
    const t = safeStr(type).toLowerCase();
    if (t === 'outgoing') return 'bg-blue-500/20 text-blue-400';
    if (t === 'incoming') return 'bg-green-500/20 text-green-400';
    if (t === 'missed') return 'bg-red-500/20 text-red-400';
    return 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">📡 Call Sync</h1>
          <p className="text-gray-400 mt-1">Real call data from MacroDroid → Google Sheets → CRM</p>
        </div>
        <button
          onClick={syncNow}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-semibold rounded-lg transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Connection Status */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${connected ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-800 border-gray-700'}`}>
        {connected ? (
          <>
            <Wifi className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-green-400 font-semibold">Connected to Google Sheets</p>
              <p className="text-gray-400 text-sm">Last sync: {lastSync}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400 text-sm font-medium">{calls.length} calls loaded</span>
            </div>
          </>
        ) : (
          <>
            <WifiOff className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-gray-300 font-semibold">Not connected</p>
              <p className="text-gray-400 text-sm">Click "Sync Now" to fetch call data from Google Sheets</p>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400 font-semibold">Sync Error</p>
          </div>
          <p className="text-gray-400 text-sm">{error}</p>
          <div className="mt-3 p-3 bg-gray-900 rounded-lg">
            <p className="text-amber-400 text-sm font-semibold mb-2">⚠️ Apps Script needs JSONP support. Update your script:</p>
            <p className="text-gray-400 text-xs">In the <code className="text-green-400">doGet(e)</code> function, make sure you have the <code className="text-green-400">if (e.parameter.action === 'read')</code> block with <code className="text-green-400">ContentService.MimeType.JAVASCRIPT</code> and a callback parameter handler.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Calls</p>
          <p className="text-2xl font-bold text-white mt-1">{validCalls.length}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Outgoing</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{outgoing}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Incoming</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{incoming}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Missed</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{missed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name, number, rep..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
        >
          <option value="all">All Types</option>
          <option value="outgoing">Outgoing</option>
          <option value="incoming">Incoming</option>
          <option value="missed">Missed</option>
        </select>
        <select
          value={repFilter}
          onChange={e => setRepFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
        >
          <option value="all">All Reps</option>
          {reps.map(rep => (
            <option key={rep} value={rep}>{rep}</option>
          ))}
        </select>
      </div>

      {/* Call Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-4 py-3 text-gray-400 text-xs font-semibold uppercase">Rep</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs font-semibold uppercase">Type</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs font-semibold uppercase">Phone Number</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs font-semibold uppercase">Contact</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs font-semibold uppercase">Date</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs font-semibold uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Phone className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">
                      {calls.length === 0
                        ? 'Click "Sync Now" to load call data from Google Sheets'
                        : 'No calls match your filter'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((call, i) => (
                  <tr key={i} className={`hover:bg-gray-700/30 transition-colors ${!call.isValid ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-amber-500/20 rounded-full flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <span className="text-white text-sm font-medium">{call.rep || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 w-fit px-2 py-1 rounded-full text-xs font-medium ${getCallBadge(call.type)}`}>
                        {getCallIcon(call.type)}
                        {call.type || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-300 text-sm font-mono">
                        {call.isValid ? formatPhone(call.number) : (call.number || '—')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-300 text-sm">{call.name || 'Unknown'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                        <Calendar className="w-3.5 h-3.5" />
                        {call.date || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                        <Clock className="w-3.5 h-3.5" />
                        {call.time || '—'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-700 text-gray-400 text-sm flex items-center justify-between">
            <span>Showing {filtered.length} of {calls.length} entries</span>
            {calls.filter(c => !c.isValid).length > 0 && (
              <span className="text-yellow-400 text-xs">
                {calls.filter(c => !c.isValid).length} test/invalid entries excluded
              </span>
            )}
          </div>
        )}
      </div>

      {/* Apps Script Instructions */}
      <div className="bg-gray-800 rounded-xl border border-amber-500/30 p-5 space-y-4">
        <h3 className="text-amber-400 font-semibold">⚠️ Required: Update Your Apps Script for JSONP</h3>
        <p className="text-gray-400 text-sm">To fix CORS errors, your Apps Script must support JSONP. Replace your current script with this:</p>
        <pre className="bg-gray-900 rounded-lg p-4 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap">
{`function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  if (e.parameter.action === 'read') {
    var data = sheet.getDataRange().getValues();
    var rows = [];
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] !== '') {
        rows.push({
          rep: String(data[i][0] || ''),
          number: String(data[i][1] || ''),
          type: String(data[i][2] || ''),
          duration: String(data[i][3] || '0'),
          date: String(data[i][4] || ''),
          time: String(data[i][5] || ''),
          name: String(data[i][6] || '')
        });
      }
    }
    var output = JSON.stringify({ success: true, total: rows.length, data: rows });
    var callback = e.parameter.callback;
    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + output + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(output)
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // WRITE - MacroDroid logging a call
  sheet.appendRow([
    String(e.parameter.rep || ''),
    String(e.parameter.number || ''),
    String(e.parameter.type || ''),
    String(e.parameter.duration || '0'),
    new Date().toLocaleDateString(),
    new Date().toLocaleTimeString(),
    String(e.parameter.name || '')
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`}
        </pre>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-400">
          <div className="bg-gray-900 rounded p-3">
            <p className="text-white font-semibold mb-1">Step 1</p>
            <p>Open Apps Script → Paste code above → Save (Ctrl+S)</p>
          </div>
          <div className="bg-gray-900 rounded p-3">
            <p className="text-white font-semibold mb-1">Step 2</p>
            <p>Deploy → Manage Deployments → Edit → New Version → Deploy</p>
          </div>
          <div className="bg-gray-900 rounded p-3">
            <p className="text-white font-semibold mb-1">Step 3</p>
            <p>Paste new URL here and click Sync Now</p>
          </div>
        </div>
      </div>
    </div>
  );
}
