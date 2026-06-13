import { useState, useEffect } from 'react';
import {
  Smartphone, Download, QrCode, CheckCircle2, Phone, Mic,
  RefreshCw, BarChart3, ChevronDown, ChevronUp, ExternalLink,
  Shield, Wifi, Clock, Copy, Check, Users, Pencil, Save, X,
  Circle, Activity
} from 'lucide-react';

const REPO = 'mannnnup-cyber/DHD-CRM-Companion';
const APK_URL = `https://github.com/${REPO}/releases/latest/download/DHD-CRM-Companion-signed.apk`;
const QR_URL  = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(APK_URL)}&bgcolor=1a1a2e&color=00c896&margin=12`;

const FEATURES = [
  { icon: Phone,     title: 'Call Log Sync',        desc: 'Automatically syncs your full call history to the CRM every 60 minutes.' },
  { icon: Mic,       title: 'Call Recording',        desc: 'Records all calls in the background. No button to press — just make your calls.' },
  { icon: RefreshCw, title: 'One-tap Upload',        desc: 'Tap Sync Now to instantly upload recordings and new calls to the CRM.' },
  { icon: BarChart3, title: 'AI Transcription',      desc: 'Recordings are transcribed via Whisper and analysed for sentiment automatically.' },
];

const STEPS = [
  { n: '1', title: 'Download the APK',      body: 'Tap the Download button below. Your browser will download the APK file.' },
  { n: '2', title: 'Allow unknown sources', body: 'Open the downloaded file. If prompted, tap "Allow from this source" — this is safe, it\'s your own company app.' },
  { n: '3', title: 'Install & open',        body: 'Follow the on-screen install steps, then open "DHD CRM Companion" from your app drawer.' },
  { n: '4', title: 'Scan the QR code',      body: 'In the app go to Settings → tap "Scan QR" → scan the QR code shown on this page. Your webhook URL is configured instantly.' },
  { n: '5', title: 'Grant permissions',     body: 'Allow Call Log and Microphone permissions when the app asks. Both are required for sync and recording.' },
  { n: '6', title: 'Make a call & sync',    body: 'Make any call, then tap Sync Now on the Home screen. Done — your call will appear in Call Logs.' },
];

export default function CompanionApp() {
  const [stepsOpen, setStepsOpen]     = useState(true);
  const [copied, setCopied]           = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(APK_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-[#0d1117] to-[#1a1f2e] border border-[#30363d] rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
        <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00c896] to-[#0090ff] flex items-center justify-center shadow-lg">
          <Smartphone className="text-white" size={38} />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-bold text-white">DHD CRM Companion</h1>
          <p className="text-[#8b949e] mt-1 text-sm leading-relaxed">
            Android app for sales reps. Syncs call logs, records calls, and feeds AI coaching insights straight to this CRM — automatically.
          </p>
          <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
            <span className="text-xs bg-[#00c89622] text-[#00c896] border border-[#00c89633] rounded-full px-3 py-1">Android 7.0+</span>
            <span className="text-xs bg-[#0090ff22] text-[#4da6ff] border border-[#0090ff33] rounded-full px-3 py-1">Free</span>
            <span className="text-xs bg-[#ffffff11] text-[#8b949e] border border-[#30363d] rounded-full px-3 py-1">~40 MB</span>
          </div>
        </div>
      </div>

      {/* ── Download + QR ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Download card */}
        <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[#8b949e] text-sm font-semibold uppercase tracking-wide">
            <Download size={14} />
            Download
          </div>

          <a
            href={APK_URL}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#00c896] to-[#0090ff] text-white font-bold rounded-xl py-4 text-base hover:opacity-90 transition-opacity"
            download
          >
            <Download size={18} />
            Download APK
          </a>

          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-2 bg-[#161b22] border border-[#30363d] text-[#8b949e] hover:text-white rounded-xl py-3 text-sm font-medium transition-colors"
          >
            {copied ? <Check size={14} className="text-[#00c896]" /> : <Copy size={14} />}
            {copied ? 'Link copied!' : 'Copy download link'}
          </button>

          <div className="flex items-start gap-2 text-xs text-[#656d76] bg-[#161b22] rounded-lg p-3">
            <Shield size={12} className="mt-0.5 flex-shrink-0 text-[#00c896]" />
            Signed with the DHD release key. Built automatically from source by GitHub Actions.
          </div>
        </div>

        {/* QR code card */}
        <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-5 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-[#8b949e] text-sm font-semibold uppercase tracking-wide self-start">
            <QrCode size={14} />
            Scan to download
          </div>
          <img
            src={QR_URL}
            alt="QR code — scan to download DHD CRM Companion APK"
            className="rounded-xl border border-[#30363d]"
            width={220}
            height={220}
          />
          <p className="text-xs text-[#656d76] text-center">
            Point your phone camera at this code to open the download link directly.
          </p>
        </div>
      </div>

      {/* ── Webhook QR for in-app setup ── */}
      <WebhookQR />

      {/* ── Features ── */}
      <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-4">What the app does</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map(f => (
            <div key={f.title} className="flex gap-3 bg-[#161b22] rounded-xl p-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#00c89622] flex items-center justify-center">
                <f.icon size={16} className="text-[#00c896]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{f.title}</div>
                <div className="text-xs text-[#656d76] mt-0.5 leading-relaxed">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Install steps ── */}
      <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl overflow-hidden">
        <button
          onClick={() => setStepsOpen(o => !o)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-[#161b22] transition-colors"
        >
          <span className="text-white font-semibold">Installation guide</span>
          {stepsOpen
            ? <ChevronUp size={16} className="text-[#8b949e]" />
            : <ChevronDown size={16} className="text-[#8b949e]" />
          }
        </button>
        {stepsOpen && (
          <div className="px-5 pb-5 space-y-3">
            {STEPS.map(s => (
              <div key={s.n} className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#00c89622] border border-[#00c89633] flex items-center justify-center text-xs font-bold text-[#00c896]">
                  {s.n}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{s.title}</div>
                  <div className="text-xs text-[#656d76] mt-0.5 leading-relaxed">{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── System requirements ── */}
      <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-3">Requirements</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Smartphone, label: 'Android 7.0+',       sub: 'Nougat or newer' },
            { icon: Wifi,       label: 'Internet required',   sub: 'For sync & transcription' },
            { icon: Clock,      label: 'Auto-syncs',          sub: 'Every 60 minutes' },
          ].map(r => (
            <div key={r.label} className="flex items-center gap-3 bg-[#161b22] rounded-xl p-3">
              <r.icon size={18} className="text-[#8b949e] flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-white">{r.label}</div>
                <div className="text-xs text-[#656d76]">{r.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Device Admin ── */}
      <DeviceAdmin />

      {/* ── Footer links ── */}
      <div className="flex flex-wrap gap-3 justify-center text-xs text-[#656d76]">
        <a
          href={`https://github.com/${REPO}/actions`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-[#8b949e] transition-colors"
        >
          <ExternalLink size={11} />
          Build history (GitHub Actions)
        </a>
        <span>·</span>
        <a
          href={`https://github.com/${REPO}/releases`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-[#8b949e] transition-colors"
        >
          <ExternalLink size={11} />
          All releases
        </a>
      </div>

    </div>
  );
}

// ── Device Admin ─────────────────────────────────────────────────────────────
interface Device {
  device_id: string;
  phone_number: string;
  device_name: string | null;
  device_model: string | null;
  is_active: boolean;
  last_heartbeat: string | null;
  created_at: string;
}

function DeviceAdmin() {
  const [devices, setDevices]     = useState<Device[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  async function loadDevices() {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp?action=getDevices');
      const data = await res.json();
      if (data.success) setDevices(data.devices);
      else setError(data.error || 'Failed to load devices');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDevices(); }, []);

  async function saveName(phone_number: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp?action=updateDeviceName', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number, device_name: editName.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        setDevices(prev => prev.map(d =>
          d.phone_number === phone_number ? { ...d, device_name: editName.trim() || null } : d
        ));
        setEditingId(null);
      } else {
        setError(data.error || 'Save failed');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function isOnline(heartbeat: string | null): boolean {
    if (!heartbeat) return false;
    return (Date.now() - new Date(heartbeat).getTime()) < 5 * 60 * 1000; // online if heartbeat < 5 min ago
  }

  function lastSeen(heartbeat: string | null): string {
    if (!heartbeat) return 'Never';
    const diff = Date.now() - new Date(heartbeat).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (m < 2)   return 'Just now';
    if (m < 60)  return `${m}m ago`;
    if (h < 24)  return `${h}h ago`;
    return `${d}d ago`;
  }

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00c89622] flex items-center justify-center">
            <Users size={16} className="text-[#00c896]" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm">Connected Devices</div>
            <div className="text-[#656d76] text-xs">Manage rep phones and assign names to each device</div>
          </div>
        </div>
        <button
          onClick={loadDevices}
          className="p-2 text-[#656d76] hover:text-white hover:bg-[#161b22] rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="p-5">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-8 text-[#656d76] text-sm">Loading devices…</div>
        ) : devices.length === 0 ? (
          <div className="text-center py-8">
            <Smartphone size={32} className="text-[#30363d] mx-auto mb-3" />
            <p className="text-[#8b949e] text-sm font-medium">No devices registered yet</p>
            <p className="text-[#656d76] text-xs mt-1">Devices appear here automatically after the first sync from the companion app.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map(device => {
              const online  = isOnline(device.last_heartbeat);
              const editing = editingId === device.device_id;
              return (
                <div key={device.device_id} className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: status dot + info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 mt-0.5">
                        {online
                          ? <Activity size={16} className="text-[#00c896]" />
                          : <Circle   size={16} className="text-[#656d76]" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Rep name (editable) */}
                        {editing ? (
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              autoFocus
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveName(device.phone_number); if (e.key === 'Escape') setEditingId(null); }}
                              placeholder="Rep name (e.g. John Smith)"
                              className="flex-1 bg-[#0d1117] border border-[#00c89666] rounded-lg px-3 py-1.5 text-sm text-white placeholder-[#656d76] focus:outline-none focus:border-[#00c896]"
                            />
                            <button
                              onClick={() => saveName(device.phone_number)}
                              disabled={saving}
                              className="p-1.5 bg-[#00c896] text-black rounded-lg hover:bg-[#00b085] disabled:opacity-50"
                            >
                              <Save size={13} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 text-[#656d76] hover:text-white hover:bg-[#30363d] rounded-lg"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-white">
                              {device.device_name || <span className="text-[#656d76] italic font-normal">Unnamed rep</span>}
                            </span>
                            <button
                              onClick={() => { setEditingId(device.device_id); setEditName(device.device_name || ''); }}
                              className="p-1 text-[#656d76] hover:text-[#00c896] rounded transition-colors"
                              title="Set rep name"
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                        )}

                        {/* Phone number */}
                        <div className="text-xs text-[#4da6ff] font-mono">{device.phone_number}</div>

                        {/* Device model */}
                        {device.device_model && (
                          <div className="text-xs text-[#656d76] mt-0.5">{device.device_model}</div>
                        )}
                      </div>
                    </div>

                    {/* Right: status badge + last seen */}
                    <div className="flex-shrink-0 text-right">
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        online
                          ? 'bg-[#00c89622] text-[#00c896] border border-[#00c89633]'
                          : 'bg-[#ffffff0a] text-[#656d76] border border-[#30363d]'
                      }`}>
                        {online ? 'Online' : 'Offline'}
                      </span>
                      <div className="text-[10px] text-[#656d76] mt-1">
                        {lastSeen(device.last_heartbeat)}
                      </div>
                      <div className="text-[10px] text-[#656d76]">
                        Since {new Date(device.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-[#656d76] mt-4 leading-relaxed">
          Devices register automatically on first sync. Set a rep name here — it will appear in Call Logs and Coaching Dashboard to identify whose calls are whose.
        </p>
      </div>
    </div>
  );
}

// ── Webhook QR helper ────────────────────────────────────────────────────────
function WebhookQR() {
  const [open, setOpen] = useState(false);

  // Build the webhook URL from current window origin
  const webhookUrl = `${window.location.origin.replace('/#', '')}/api/whatsapp?action=addGSMCall`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(webhookUrl)}&bgcolor=1a1a2e&color=00c896&margin=12`;

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-[#161b22] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0090ff22] flex items-center justify-center">
            <QrCode size={16} className="text-[#4da6ff]" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm">Webhook QR Code</div>
            <div className="text-[#656d76] text-xs">Scan this inside the companion app to connect it to this CRM instantly</div>
          </div>
        </div>
        {open
          ? <ChevronUp size={16} className="text-[#8b949e] flex-shrink-0" />
          : <ChevronDown size={16} className="text-[#8b949e] flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col sm:flex-row items-center gap-5">
          <img
            src={qr}
            alt="Webhook QR code for companion app"
            className="rounded-xl border border-[#30363d]"
            width={200}
            height={200}
          />
          <div className="space-y-3 text-sm">
            <p className="text-[#8b949e] leading-relaxed">
              In the companion app, go to the <strong className="text-white">Settings</strong> tab and tap <strong className="text-white">Scan QR Code</strong>. Point the camera at this QR code — your CRM connection will be configured automatically.
            </p>
            <div className="bg-[#161b22] rounded-lg p-3">
              <div className="text-xs text-[#656d76] mb-1">Webhook URL</div>
              <code className="text-xs text-[#00c896] break-all">{webhookUrl}</code>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#00c896]">
              <CheckCircle2 size={12} />
              Each rep scans the same QR — they're linked by phone number
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
