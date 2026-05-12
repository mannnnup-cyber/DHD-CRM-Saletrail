import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail, Star, StarOff, Trash2, Send, RefreshCw, Search,
  Sparkles, TrendingUp, TrendingDown, Minus, MessageSquare,
  UserPlus, X, Loader2, Zap, Brain, Inbox, ChevronDown,
  ChevronRight, CheckCircle, AlertCircle, Info, Layout,
  List, FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DbEmail {
  id: string;
  message_id: string;
  thread_id: string;
  from_email: string;
  from_name: string;
  to_email: string;
  subject: string;
  body: string;
  body_html: string;
  date: string;
  read: boolean;
  starred: boolean;
  category: 'lead' | 'support' | 'newsletter' | 'other';
  lead_score: number;
  ai_analysis: {
    intent: string;
    sentiment: string;
    urgency: string;
    keyPoints: string[];
    suggestedAction: string;
  } | null;
  converted_to_lead: boolean;
}

interface Email {
  id: string;
  messageId: string;
  threadId: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
  category: 'lead' | 'support' | 'newsletter' | 'other';
  leadScore: number;
  convertedToLead: boolean;
  aiAnalysis: {
    intent: string;
    sentiment: string;
    urgency: string;
    keyPoints: string[];
    suggestedAction: string;
  } | null;
}

interface EmailStats {
  total: number;
  unread: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  avgScore: number;
}

interface Toast {
  id: string;
  msg: string;
  type: 'success' | 'error' | 'info';
}

interface Template {
  id: string;
  name: string;
  subject_template: string;
  body_template: string;
  usage_count: number;
}

const DEMO_EMAILS = [
  {
    from: 'sarah.chen@techcorp.com', fromName: 'Sarah Chen',
    subject: 'Quote for branding package - TechCorp',
    body: 'Hi there,\n\nI came across Dirty Hand Designs through a colleague recommendation. We\'re a tech startup looking to rebrand our entire company - logo, business cards, and social media templates.\n\nWe have a budget of around $5,000 and would like to complete this within the next 3 weeks if possible. Are you available for a call this week?\n\nLooking forward to hearing from you!\n\nBest,\nSarah Chen\nTechCorp CEO',
    date: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  },
  {
    from: 'mike.johnson@partnerships.io', fromName: 'Mike Johnson',
    subject: 'Partnership Opportunity - Referral Program',
    body: 'Hello,\n\nI run a digital marketing agency and we\'re always looking for reliable design partners. We frequently get branding requests from our clients but don\'t have an in-house team.\n\nWould you be interested in setting up a referral partnership? We could send clients your way and take a 15% commission on successful projects.\n\nLet me know if you\'d like to discuss this further.\n\nRegards,\nMike Johnson',
    date: new Date(Date.now() - 1000 * 60 * 45).toISOString()
  },
  {
    from: 'newsletter@designweekly.com', fromName: 'Design Weekly',
    subject: 'This Week in Design: Top Trends for 2026',
    body: 'Top Design Trends for 2026\n\n1. Minimalist Branding\n2. Sustainable Design\n3. Motion Graphics\n4. Custom Typography\n\nRead more...',
    date: new Date(Date.now() - 1000 * 60 * 120).toISOString()
  },
  {
    from: 'alex@client.com', fromName: 'Alex',
    subject: 'Re: Invoice #1234 - Payment Confirmation',
    body: 'Hi,\n\nI received the invoice but have a question about one of the line items. Can you clarify what the "design revision" charge covers?\n\nThanks,\nAlex',
    date: new Date(Date.now() - 1000 * 60 * 180).toISOString()
  },
  {
    from: 'lisa.park@retailplus.com', fromName: 'Lisa Park',
    subject: 'Quick question about logo design',
    body: 'Hi,\n\nI saw your portfolio and I\'m impressed! We\'re a small retail business looking for a new logo. Just curious about your pricing and timeline.\n\nNo rush, but would love to learn more when you have a moment.\n\nThanks,\nLisa',
    date: new Date(Date.now() - 1000 * 60 * 240).toISOString()
  }
];

// Strip raw MIME structure from bodies stored before the full-message parser fix.
// New syncs come through clean; this handles the localStorage cache.
function cleanBody(body: string): string {
  if (!body) return '';
  // If no MIME boundary present, nothing to clean
  if (!body.includes('Content-Type:') && !body.startsWith('--')) return body;

  const lines = body.split('\n');
  const out: string[] = [];
  let skipHeaders = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // MIME boundary — start skipping part headers
    if (trimmed.startsWith('--')) { skipHeaders = true; continue; }
    // Content-* headers after a boundary
    if (skipHeaders && (trimmed.startsWith('Content-') || trimmed === '')) {
      if (trimmed === '') skipHeaders = false; // blank line ends headers
      continue;
    }
    out.push(line);
  }

  return out.join('\n')
    // Decode quoted-printable soft line breaks first
    .replace(/=\r?\n/g, '')
    // Decode =XX sequences
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    // Strip any HTML tags that leaked through
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    // Collapse runs of blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function mapDbEmail(db: DbEmail): Email {
  return {
    id: db.id,
    messageId: db.message_id,
    threadId: db.thread_id || db.id,
    from: db.from_email,
    fromName: db.from_name || db.from_email.split('@')[0],
    to: db.to_email,
    subject: db.subject,
    body: cleanBody(db.body),
    date: db.date,
    read: db.read,
    starred: db.starred,
    category: db.category,
    leadScore: db.lead_score,
    convertedToLead: db.converted_to_lead,
    aiAnalysis: db.ai_analysis,
  };
}

export default function EmailInbox() {
  const [emails, setEmails]               = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading]             = useState(true);
  const [sending, setSending]             = useState(false);
  const [analyzing, setAnalyzing]         = useState<string | null>(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'lead' | 'support' | 'newsletter'>('all');
  const [filterScore, setFilterScore]     = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [showCompose, setShowCompose]     = useState(false);
  const [showAI, setShowAI]               = useState(false);
  const [composeData, setComposeData]     = useState({ to: '', subject: '', body: '', cc: '', bcc: '' });
  const [replyBody, setReplyBody]         = useState('');
  const [aiSuggestion, setAiSuggestion]   = useState('');
  const [stats, setStats]                 = useState<EmailStats | null>(null);
  const [threadView, setThreadView]       = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [templates, setTemplates]         = useState<Template[]>([]);
  const [showCc, setShowCc]               = useState(false);
  const [toasts, setToasts]               = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal]   = useState<{ msg: string; onConfirm: () => void } | null>(null);
  const [lastSynced, setLastSynced]       = useState<Date | null>(null);
  const [syncing, setSyncing]             = useState(false);
  const [dbMissing, setDbMissing]         = useState(false);

  const toastIdRef = useRef(0);

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const addToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = String(++toastIdRef.current);
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  const askConfirm = useCallback((msg: string, onConfirm: () => void) => {
    setConfirmModal({ msg, onConfirm });
  }, []);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/email?action=list');
      const data = await r.json();
      if (data.tableError) setDbMissing(true);
      if (data.success && (data.emails || []).length > 0) {
        setDbMissing(false);
        setEmails((data.emails || []).map(mapDbEmail));
      } else {
        const cached = JSON.parse(localStorage.getItem('dhd_cached_emails') || '[]');
        if (cached.length > 0) setEmails(cached.map(mapDbEmail));
      }
    } catch (e) {
      console.error('Error loading emails:', e);
      try {
        const cached = JSON.parse(localStorage.getItem('dhd_cached_emails') || '[]');
        if (cached.length > 0) setEmails(cached.map(mapDbEmail));
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch('/api/email?action=stats');
      const data = await r.json();
      if (data.success) setStats(data.stats);
    } catch {}
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const r = await fetch('/api/email?action=templates');
      const data = await r.json();
      if (data.success) setTemplates(data.templates || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadEmails();
    loadStats();
    loadTemplates();
  }, [loadEmails, loadStats, loadTemplates]);

  // Auto-sync on mount if IMAP is configured and last sync was >30 min ago
  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('dhd_crm_settings') || '{}');
      if (!settings.IMAP_HOST || !settings.IMAP_USER || !settings.IMAP_PASSWORD) return;
      const lastSyncTs = parseInt(localStorage.getItem('dhd_last_sync') || '0', 10);
      const minsAgo = (Date.now() - lastSyncTs) / 60000;
      if (minsAgo > 30) doSync(true); // silent = true
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Real-time new emails ───────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase || typeof supabase.channel !== 'function') return;
    const ch = supabase.channel('emails_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, (payload: any) => {
        const email = mapDbEmail(payload.new as DbEmail);
        setEmails(prev => prev.find(e => e.id === email.id) ? prev : [email, ...prev]);
        addToast(`New email from ${email.fromName}: ${email.subject}`, 'info');
        loadStats();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [addToast, loadStats]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const doSync = async (silent = false) => {
    if (syncing) return;
    setSyncing(true);
    if (!silent) setLoading(true);
    try {
      let storedSettings: Record<string, string> = {};
      try {
        const raw = localStorage.getItem('dhd_crm_settings');
        storedSettings = raw ? JSON.parse(raw) : {};
      } catch { /* ignore */ }

      const r = await fetch('/api/email?action=sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: storedSettings })
      });
      const data = await r.json();
      if (data.success) {
        if (data.emails && data.emails.length > 0) {
          try {
            const existing = JSON.parse(localStorage.getItem('dhd_cached_emails') || '[]');
            const existingIds = new Set(existing.map((e: any) => e.message_id));
            const fresh = data.emails.filter((e: any) => !existingIds.has(e.message_id));
            localStorage.setItem('dhd_cached_emails', JSON.stringify([...fresh, ...existing].slice(0, 200)));
          } catch { /* ignore */ }
        }
        localStorage.setItem('dhd_last_sync', String(Date.now()));
        setLastSynced(new Date());
        if (!silent || data.synced > 0) {
          addToast(`Synced ${data.synced} new email${data.synced !== 1 ? 's' : ''}${data.timeout ? ' (partial)' : ''}`);
        }
        await loadEmails();
        await loadStats();
      } else {
        const detail = data.error || data.message || 'Unknown error';
        const hint = data.hint ? ` · ${data.hint}` : '';
        if (!silent) addToast(`Sync failed: ${detail}${hint}`, 'error');
      }
    } catch {
      if (!silent) addToast('Failed to sync emails', 'error');
    }
    setSyncing(false);
    if (!silent) setLoading(false);
  };

  const syncEmails = () => doSync(false);

  const importDemoEmails = async () => {
    setLoading(true);
    try {
      await fetch('/api/email?action=import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: DEMO_EMAILS })
      });
      localStorage.setItem('dhd_last_sync', String(Date.now()));
      await loadEmails();
      await loadStats();
      addToast('Demo emails loaded and AI-analyzed');
    } catch {
      addToast('Failed to import demo emails', 'error');
    }
    setLoading(false);
  };

  const getAISuggestion = async (emailId: string) => {
    if (!selectedEmail) return;
    setAnalyzing(emailId);
    try {
      const r = await fetch('/api/email?action=aiSuggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId,
          fromName: selectedEmail.fromName,
          fromEmail: selectedEmail.from,
          subject: selectedEmail.subject,
          body: selectedEmail.body,
          aiAnalysis: selectedEmail.aiAnalysis,
        }),
      });
      const data = await r.json();
      if (data.success) {
        setAiSuggestion(data.suggestion);
        setReplyBody(data.suggestion);
        setShowAI(true);
      } else {
        addToast(data.error || 'AI suggestion unavailable — check OpenAI API key in Settings', 'info');
      }
    } catch {
      addToast('AI suggestion failed', 'error');
    }
    setAnalyzing(null);
  };

  const sendEmail = async () => {
    if (!composeData.to || !composeData.subject || !composeData.body) return;
    setSending(true);
    try {
      const payload: any = { to: composeData.to, subject: composeData.subject, body: composeData.body };
      if (composeData.cc)  payload.cc  = composeData.cc;
      if (composeData.bcc) payload.bcc = composeData.bcc;
      const r = await fetch('/api/email?action=send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (data.success) {
        setShowCompose(false);
        setComposeData({ to: '', subject: '', body: '', cc: '', bcc: '' });
        setShowCc(false);
        addToast('Email sent successfully');
      } else {
        addToast('Failed to send: ' + data.error, 'error');
      }
    } catch {
      addToast('Failed to send email', 'error');
    }
    setSending(false);
  };

  const replyToEmail = async () => {
    if (!selectedEmail || !replyBody.trim()) return;
    setSending(true);
    try {
      const r = await fetch('/api/email?action=reply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: selectedEmail.threadId, replyBody })
      });
      const data = await r.json();
      if (data.success) {
        setReplyBody('');
        setShowAI(false);
        setAiSuggestion('');
        addToast('Reply sent');
      } else {
        addToast('Failed to send reply: ' + data.error, 'error');
      }
    } catch {
      addToast('Failed to send reply', 'error');
    }
    setSending(false);
  };

  const markRead = async (emailId: string) => {
    await fetch(`/api/email?action=markRead&emailId=${emailId}`);
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, read: true } : e));
    if (selectedEmail?.id === emailId) setSelectedEmail(prev => prev ? { ...prev, read: true } : null);
  };

  const toggleStar = async (email: Email) => {
    await fetch(`/api/email?action=markStarred&emailId=${email.id}&starred=${!email.starred}`);
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, starred: !e.starred } : e));
    if (selectedEmail?.id === email.id) setSelectedEmail(prev => prev ? { ...prev, starred: !prev.starred } : null);
  };

  const deleteEmail = (emailId: string) => {
    askConfirm('Delete this email? This cannot be undone.', async () => {
      await fetch(`/api/email?action=delete&emailId=${emailId}`);
      setEmails(prev => prev.filter(e => e.id !== emailId));
      if (selectedEmail?.id === emailId) setSelectedEmail(null);
      loadStats();
      addToast('Email deleted');
    });
  };

  const convertToLead = async (email: Email) => {
    askConfirm(`Convert email from ${email.fromName} to a CRM lead?`, async () => {
      const r = await fetch(`/api/email?action=convertToLead&emailId=${email.id}`);
      const data = await r.json();
      if (data.success) {
        setEmails(prev => prev.map(e => e.id === email.id
          ? { ...e, category: 'lead', leadScore: Math.max(e.leadScore, 70), convertedToLead: true }
          : e
        ));
        if (selectedEmail?.id === email.id) {
          setSelectedEmail(prev => prev
            ? { ...prev, category: 'lead', leadScore: Math.max(prev.leadScore, 70), convertedToLead: true }
            : null
          );
        }
        const msg = data.alreadyExisted
          ? `${data.lead.name} already exists as a lead`
          : `${data.lead.name} added to CRM leads`;
        addToast(msg, data.alreadyExisted ? 'info' : 'success');
      } else {
        addToast('Failed to convert: ' + (data.error || 'Unknown error'), 'error');
      }
    });
  };

  const applyTemplate = async (templateId: string) => {
    if (!templateId) return;
    try {
      const r = await fetch('/api/email?action=useTemplate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, variables: {} })
      });
      const data = await r.json();
      if (data.success) {
        setComposeData(prev => ({ ...prev, subject: data.subject, body: data.body }));
        addToast('Template applied', 'info');
      }
    } catch {}
  };

  const selectEmail = (email: Email) => {
    setSelectedEmail(email);
    setShowAI(false);
    setAiSuggestion('');
    setReplyBody('');
    if (!email.read) markRead(email.id);
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  // Deduplicate by messageId (same email can appear from cache + API)
  const seenIds = new Set<string>();
  const dedupedEmails = emails.filter(e => {
    const key = e.messageId || e.id;
    if (seenIds.has(key)) return false;
    seenIds.add(key);
    return true;
  });

  const filteredEmails = dedupedEmails
    .filter(email => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || email.subject.toLowerCase().includes(q)
        || email.fromName.toLowerCase().includes(q)
        || email.from.toLowerCase().includes(q);
      const matchCat = filterCategory === 'all' || email.category === filterCategory;
      const matchScore = filterScore === 'all'
        ? true : filterScore === 'hot'  ? email.leadScore >= 80
               : filterScore === 'warm' ? email.leadScore >= 50 && email.leadScore < 80
               : email.leadScore < 50;
      return matchSearch && matchCat && matchScore;
    })
    // Always newest first
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Thread grouping: key = threadId, value = sorted emails (newest first)
  const threadMap = new Map<string, Email[]>();
  for (const e of filteredEmails) {
    const tid = e.threadId || e.id;
    if (!threadMap.has(tid)) threadMap.set(tid, []);
    threadMap.get(tid)!.push(e);
  }
  // Sort each thread descending
  threadMap.forEach(arr => arr.sort((a, b) => b.date.localeCompare(a.date)));
  // Thread list sorted by latest message
  const threadList = Array.from(threadMap.entries()).sort(([, a], [, b]) =>
    b[0].date.localeCompare(a[0].date)
  );

  // ── Formatting helpers ─────────────────────────────────────────────────────
  const fmtDate = (d: string) => {
    const date = new Date(d);
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hrs  = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 60) return `${mins}m ago`;
    if (hrs  < 24) return `${hrs}h ago`;
    if (days < 7)  return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const scoreColor = (s: number) => s >= 80 ? 'text-red-400' : s >= 50 ? 'text-amber-400' : 'text-gray-400';
  const scoreIcon  = (s: number) => s >= 80
    ? <TrendingUp className="w-3.5 h-3.5" />
    : s >= 50 ? <Minus className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />;

  const catColor = (c: string) => ({
    lead:       'bg-red-500/20 text-red-400 border-red-500/30',
    support:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
    newsletter: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    other:      'bg-gray-600/20 text-gray-400 border-gray-600/30',
  }[c] || 'bg-gray-600/20 text-gray-400 border-gray-600/30');

  const sentimentIcon = (s: string) => ({
    Positive: '😊', Excited: '😊', Negative: '😔', Hesitant: '🤔'
  }[s] || '😐');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium pointer-events-auto
            ${t.type === 'success' ? 'bg-green-900/90 border-green-500/50 text-green-200'
            : t.type === 'error'   ? 'bg-red-900/90 border-red-500/50 text-red-200'
            :                        'bg-gray-800/95 border-gray-600/50 text-gray-200'}`}>
            {t.type === 'success' ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
            : t.type === 'error'  ? <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            :                       <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />}
            {t.msg}
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <p className="text-white text-sm mb-5">{confirmModal.msg}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DB missing banner */}
      {dbMissing && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-sm">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-amber-300">
            Emails are stored locally only. Run <code className="bg-gray-800 px-1 rounded">supabase/email_schema.sql</code> in your Supabase SQL Editor to enable permanent storage.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail className="w-7 h-7 text-blue-400" /> Email Inbox
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            AI-powered email management with lead scoring
            {stats && <span className="ml-2 text-green-400">· {stats.hotLeads} hot leads</span>}
            {lastSynced && (
              <span className="ml-2 text-gray-500">· synced {Math.round((Date.now() - lastSynced.getTime()) / 60000) || '<1'}m ago</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {emails.length === 0 && (
            <button onClick={importDemoEmails} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <Zap className="w-4 h-4" /> Load Demo Emails
            </button>
          )}
          <button onClick={syncEmails} disabled={syncing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <Inbox className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Emails'}
          </button>
          <button onClick={() => { loadEmails(); loadStats(); }} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => { setShowCompose(true); loadTemplates(); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Send className="w-4 h-4" /> Compose
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Total',     value: stats.total,     color: 'text-white',        bg: '' },
            { label: 'Unread',    value: stats.unread,    color: 'text-amber-400',    bg: '' },
            { label: 'Hot Leads', value: stats.hotLeads,  color: 'text-red-400',      bg: 'bg-red-500/10 border-red-500/30' },
            { label: 'Warm',      value: stats.warmLeads, color: 'text-amber-400',    bg: 'bg-amber-500/10 border-amber-500/30' },
            { label: 'Cold',      value: stats.coldLeads, color: 'text-gray-400',     bg: '' },
            { label: 'Avg Score', value: stats.avgScore,  color: 'text-blue-400',     bg: 'bg-blue-500/10 border-blue-500/30' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-4 border ${s.bg || 'bg-gray-800/60 border-gray-700/50'}`}>
              <p className="text-gray-400 text-xs mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filters + View toggle */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Search emails..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as any)}
          className="px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm">
          <option value="all">All Categories</option>
          <option value="lead">Leads</option>
          <option value="support">Support</option>
          <option value="newsletter">Newsletters</option>
        </select>
        <select value={filterScore} onChange={e => setFilterScore(e.target.value as any)}
          className="px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm">
          <option value="all">All Scores</option>
          <option value="hot">Hot (80+)</option>
          <option value="warm">Warm (50-79)</option>
          <option value="cold">Cold (&lt;50)</option>
        </select>
        <button onClick={() => setThreadView(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            threadView ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-gray-700/50 border-gray-600/50 text-gray-400 hover:text-white'
          }`}>
          {threadView ? <Layout className="w-4 h-4" /> : <List className="w-4 h-4" />}
          {threadView ? 'Threaded' : 'Flat'}
        </button>
      </div>

      {/* Email List and View */}
      <div className="flex-1 flex gap-4 min-h-0" style={{ height: 'calc(100vh - 400px)' }}>

        {/* Email List */}
        <div className="w-96 flex-shrink-0 flex flex-col bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden">
          <div className="p-3 border-b border-gray-700/50 flex items-center justify-between">
            <span className="text-gray-400 text-sm">
              {threadView ? `${threadList.length} threads` : `${filteredEmails.length} emails`}
            </span>
            {emails.length > 0 && (
              <span className="text-green-400 text-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI Analyzed
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                {emails.length === 0 ? 'No emails yet — click "Sync Emails" to fetch from your inbox, or "Load Demo Emails" to try it out.' : 'No emails match your filters'}
              </div>
            ) : threadView ? (
              // Threaded view
              threadList.map(([tid, threadEmails]) => {
                const latest = threadEmails[0];
                const isExpanded = expandedThreads.has(tid);
                const hasUnread = threadEmails.some(e => !e.read);
                const isSelected = threadEmails.some(e => e.id === selectedEmail?.id);
                return (
                  <div key={tid}>
                    <button
                      onClick={() => {
                        if (threadEmails.length === 1) {
                          selectEmail(latest);
                        } else {
                          setExpandedThreads(prev => {
                            const n = new Set(prev);
                            n.has(tid) ? n.delete(tid) : n.add(tid);
                            return n;
                          });
                          selectEmail(latest);
                        }
                      }}
                      className={`w-full p-3 text-left hover:bg-gray-700/40 transition-colors border-b border-gray-700/30
                        ${isSelected ? 'bg-blue-600/20 border-l-2 border-l-blue-500' : ''}
                        ${hasUnread ? 'bg-gray-700/30' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {threadEmails.length > 1 && (
                            isExpanded
                              ? <ChevronDown className="w-3 h-3 text-gray-500 flex-shrink-0" />
                              : <ChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
                          )}
                          <span className={`text-sm font-medium truncate ${hasUnread ? 'text-white' : 'text-gray-300'}`}>
                            {latest.fromName}
                          </span>
                          {threadEmails.length > 1 && (
                            <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded-full">
                              {threadEmails.length}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {latest.starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                          <span className="text-gray-500 text-[10px]">{fmtDate(latest.date)}</span>
                        </div>
                      </div>
                      <p className={`text-xs truncate ${hasUnread ? 'text-gray-200' : 'text-gray-400'}`}>
                        {latest.subject}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${catColor(latest.category)}`}>
                          {latest.category}
                        </span>
                        <span className={`text-[10px] flex items-center gap-0.5 ${scoreColor(latest.leadScore)}`}>
                          {scoreIcon(latest.leadScore)} {latest.leadScore}
                        </span>
                      </div>
                    </button>
                    {/* Expanded thread messages */}
                    {isExpanded && threadEmails.slice(1).map(e => (
                      <button key={e.id} onClick={() => selectEmail(e)}
                        className={`w-full pl-8 pr-3 py-2 text-left hover:bg-gray-700/30 transition-colors border-b border-gray-700/20
                          ${selectedEmail?.id === e.id ? 'bg-blue-600/10 border-l-2 border-l-blue-400' : ''}
                          ${!e.read ? 'bg-gray-700/20' : ''}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs truncate ${!e.read ? 'text-gray-200' : 'text-gray-400'}`}>
                            {e.fromName}
                          </span>
                          <span className="text-gray-600 text-[10px]">{fmtDate(e.date)}</span>
                        </div>
                        <p className="text-gray-500 text-[11px] truncate">{e.body.slice(0, 60)}...</p>
                      </button>
                    ))}
                  </div>
                );
              })
            ) : (
              // Flat view
              filteredEmails.map(email => (
                <button key={email.id} onClick={() => selectEmail(email)}
                  className={`w-full p-3 text-left hover:bg-gray-700/40 transition-colors border-b border-gray-700/30
                    ${selectedEmail?.id === email.id ? 'bg-blue-600/20 border-l-2 border-l-blue-500' : ''}
                    ${!email.read ? 'bg-gray-700/30' : ''}`}>
                  <div className="flex items-start justify-between mb-1">
                    <span className={`text-sm font-medium truncate ${!email.read ? 'text-white' : 'text-gray-300'}`}>
                      {email.fromName}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {email.starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                      <span className="text-gray-500 text-[10px]">{fmtDate(email.date)}</span>
                    </div>
                  </div>
                  <p className={`text-xs truncate ${!email.read ? 'text-gray-200' : 'text-gray-400'}`}>
                    {email.subject}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${catColor(email.category)}`}>
                      {email.category}
                    </span>
                    <span className={`text-[10px] flex items-center gap-0.5 ${scoreColor(email.leadScore)}`}>
                      {scoreIcon(email.leadScore)} {email.leadScore}
                    </span>
                    {email.convertedToLead && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">
                        In CRM
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Email View */}
        <div className="flex-1 flex flex-col bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden min-w-0">
          {selectedEmail ? (
            <>
              {/* Email Header */}
              <div className="p-4 border-b border-gray-700/50">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1 mr-4">
                    <h2 className="text-white font-semibold text-lg leading-tight">{selectedEmail.subject}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-gray-400 text-sm">
                        From: <span className="text-white">{selectedEmail.fromName}</span>
                      </span>
                      <span className="text-gray-500 text-xs">&lt;{selectedEmail.from}&gt;</span>
                    </div>
                    <span className="text-gray-500 text-xs">{fmtDate(selectedEmail.date)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleStar(selectedEmail)}
                      className={`p-2 rounded-lg transition-colors ${
                        selectedEmail.starred ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700/50 text-gray-400 hover:text-amber-400'
                      }`}>
                      {selectedEmail.starred ? <Star className="w-4 h-4 fill-amber-400" /> : <StarOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => deleteEmail(selectedEmail.id)}
                      className="p-2 bg-gray-700/50 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Score + Category + AI button */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                    selectedEmail.leadScore >= 80 ? 'bg-red-500/10 border-red-500/30'
                    : selectedEmail.leadScore >= 50 ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-gray-700/30 border-gray-600/30'}`}>
                    {scoreIcon(selectedEmail.leadScore)}
                    <span className={`font-bold ${scoreColor(selectedEmail.leadScore)}`}>{selectedEmail.leadScore}</span>
                    <span className="text-gray-400 text-sm">Lead Score</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border ${catColor(selectedEmail.category)}`}>
                    {selectedEmail.category}
                  </span>
                  {selectedEmail.convertedToLead && (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded border border-green-500/30">
                      <CheckCircle className="w-3 h-3" /> In CRM
                    </span>
                  )}
                  {selectedEmail.aiAnalysis && (
                    <button onClick={() => setShowAI(p => !p)}
                      className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 rounded border border-purple-500/30 text-xs hover:bg-purple-500/30 transition-colors">
                      <Brain className="w-3 h-3" /> AI Analysis
                    </button>
                  )}
                </div>
              </div>

              {/* AI Analysis Panel */}
              {showAI && selectedEmail.aiAnalysis && (
                <div className="p-4 bg-purple-500/10 border-b border-purple-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-400 font-medium text-sm">AI Analysis</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Intent</p>
                      <p className="text-white text-sm">{selectedEmail.aiAnalysis.intent}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Sentiment</p>
                      <p className="text-white text-sm">{sentimentIcon(selectedEmail.aiAnalysis.sentiment)} {selectedEmail.aiAnalysis.sentiment}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Urgency</p>
                      <p className={`text-sm font-medium ${
                        selectedEmail.aiAnalysis.urgency === 'High' ? 'text-red-400'
                        : selectedEmail.aiAnalysis.urgency === 'Low' ? 'text-gray-400' : 'text-amber-400'}`}>
                        {selectedEmail.aiAnalysis.urgency}
                      </p>
                    </div>
                  </div>
                  {selectedEmail.aiAnalysis.keyPoints.length > 0 && (
                    <div className="mb-3">
                      <p className="text-gray-400 text-xs mb-1">Key Points</p>
                      <ul className="text-white text-sm list-disc list-inside space-y-0.5">
                        {selectedEmail.aiAnalysis.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <p className="text-gray-400 text-xs mb-1">Suggested Action</p>
                    <p className="text-green-400 text-sm">{selectedEmail.aiAnalysis.suggestedAction}</p>
                  </div>
                </div>
              )}

              {/* Email Body */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {selectedEmail.body.split('\n').map((line, i) => (
                    <p key={i} className="text-gray-300 text-sm leading-relaxed">{line || <br />}</p>
                  ))}
                </div>
              </div>

              {/* Reply */}
              <div className="p-4 border-t border-gray-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <span className="text-white font-medium text-sm">Reply</span>
                  {!aiSuggestion && (
                    <button onClick={() => getAISuggestion(selectedEmail.id)} disabled={!!analyzing}
                      className="ml-auto flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs transition-colors disabled:opacity-50">
                      {analyzing === selectedEmail.id
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing...</>
                        : <><Sparkles className="w-3 h-3" /> AI Suggest Reply</>}
                    </button>
                  )}
                  {aiSuggestion && (
                    <button onClick={() => { setAiSuggestion(''); setReplyBody(''); }}
                      className="ml-auto flex items-center gap-1 px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-xs transition-colors">
                      Clear
                    </button>
                  )}
                </div>
                <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)}
                  placeholder="Type your reply..." rows={4}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none text-sm" />
                <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                  {!selectedEmail.convertedToLead && (
                    <button onClick={() => convertToLead(selectedEmail)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-lg text-sm transition-colors">
                      <UserPlus className="w-4 h-4" /> Convert to Lead
                    </button>
                  )}
                  <button onClick={replyToEmail} disabled={!replyBody.trim() || sending}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sending ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center flex-col gap-4">
              <Mail className="w-16 h-16 text-gray-600" />
              <div className="text-center">
                <p className="text-white font-medium text-lg">Select an email to view</p>
                <p className="text-gray-400 text-sm mt-1">Choose from the list on the left</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Compose Email</h3>
              <button onClick={() => setShowCompose(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template picker */}
            {templates.length > 0 && (
              <div className="mb-4">
                <label className="text-gray-400 text-xs mb-1 block flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Use template
                </label>
                <select onChange={e => applyTemplate(e.target.value)} defaultValue=""
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Select a template...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">To</label>
                <input type="email" value={composeData.to}
                  onChange={e => setComposeData(p => ({ ...p, to: e.target.value }))}
                  placeholder="recipient@example.com"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
              </div>

              <div className="flex gap-3 items-center">
                <button onClick={() => setShowCc(p => !p)}
                  className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
                  + CC/BCC
                </button>
              </div>

              {showCc && (
                <>
                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">CC</label>
                    <input type="email" value={composeData.cc}
                      onChange={e => setComposeData(p => ({ ...p, cc: e.target.value }))}
                      placeholder="cc@example.com"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">BCC</label>
                    <input type="email" value={composeData.bcc}
                      onChange={e => setComposeData(p => ({ ...p, bcc: e.target.value }))}
                      placeholder="bcc@example.com"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
                  </div>
                </>
              )}

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Subject</label>
                <input type="text" value={composeData.subject}
                  onChange={e => setComposeData(p => ({ ...p, subject: e.target.value }))}
                  placeholder="Email subject"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Message</label>
                <textarea value={composeData.body}
                  onChange={e => setComposeData(p => ({ ...p, body: e.target.value }))}
                  placeholder="Type your message..." rows={8}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none text-sm" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowCompose(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button onClick={sendEmail}
                  disabled={!composeData.to || !composeData.subject || !composeData.body || sending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
