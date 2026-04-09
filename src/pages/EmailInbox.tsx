import { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  MailOpen,
  Star,
  StarOff,
  Trash2,
  Send,
  RefreshCw,
  Search,
  Filter,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  UserPlus,
  ChevronDown,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
  Brain,
  Clock,
  Target,
  ArrowRight,
  Inbox,
  Settings
} from 'lucide-react';

// Database field names (snake_case) to component field names (camelCase)
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

const DEMO_EMAILS: Partial<Email>[] = [
  {
    from: 'sarah.chen@techcorp.com',
    fromName: 'Sarah Chen',
    subject: 'Quote for branding package - TechCorp',
    body: 'Hi there,\n\nI came across Dirty Hand Designs through a colleague recommendation. We\'re a tech startup looking to rebrand our entire company - logo, business cards, and social media templates.\n\nWe have a budget of around $5,000 and would like to complete this within the next 3 weeks if possible. Are you available for a call this week?\n\nLooking forward to hearing from you!\n\nBest,\nSarah Chen\nTechCorp CEO',
    date: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  },
  {
    from: 'mike.johnson@partnerships.io',
    fromName: 'Mike Johnson',
    subject: 'Partnership Opportunity - Referral Program',
    body: 'Hello,\n\nI run a digital marketing agency and we\'re always looking for reliable design partners. We frequently get branding requests from our clients but don\'t have an in-house team.\n\nWould you be interested in setting up a referral partnership? We could send clients your way and take a 15% commission on successful projects.\n\nLet me know if you\'d like to discuss this further.\n\nRegards,\nMike Johnson',
    date: new Date(Date.now() - 1000 * 60 * 45).toISOString()
  },
  {
    from: 'newsletter@designweekly.com',
    fromName: 'Design Weekly',
    subject: 'This Week in Design: Top Trends for 2026',
    body: 'Top Design Trends for 2026\n\n1. Minimalist Branding\n2. Sustainable Design\n3. Motion Graphics\n4. Custom Typography\n\nRead more...',
    date: new Date(Date.now() - 1000 * 60 * 120).toISOString()
  },
  {
    from: 'support@client-help.com',
    fromName: 'Help Center',
    subject: 'Re: Invoice #1234 - Payment Confirmation',
    body: 'Hi,\n\nI received the invoice but have a question about one of the line items. Can you clarify what the "design revision" charge covers?\n\nThanks,\nAlex',
    date: new Date(Date.now() - 1000 * 60 * 180).toISOString()
  },
  {
    from: 'lisa.park@retailplus.com',
    fromName: 'Lisa Park',
    subject: 'Quick question about logo design',
    body: 'Hi,\n\nI saw your portfolio and I\'m impressed! We\'re a small retail business looking for a new logo. Just curious about your pricing and timeline.\n\nNo rush, but would love to learn more when you have a moment.\n\nThanks,\nLisa',
    date: new Date(Date.now() - 1000 * 60 * 240).toISOString()
  }
];

export default function EmailInbox() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'lead' | 'support' | 'newsletter'>('all');
  const [filterScore, setFilterScore] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [showCompose, setShowCompose] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
  const [replyData, setReplyData] = useState({ body: '' });
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [imported, setImported] = useState(false);

  // Load emails from Supabase
  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/email?action=list');
      const data = await r.json();
      if (data.success) {
        // Map database fields (snake_case) to component fields (camelCase)
        const mappedEmails: Email[] = (data.emails || []).map((dbEmail: DbEmail) => ({
          id: dbEmail.id,
          from: dbEmail.from_email,
          fromName: dbEmail.from_name || dbEmail.from_email.split('@')[0],
          to: dbEmail.to_email,
          subject: dbEmail.subject,
          body: dbEmail.body,
          date: dbEmail.date,
          read: dbEmail.read,
          starred: dbEmail.starred,
          category: dbEmail.category,
          leadScore: dbEmail.lead_score,
          aiAnalysis: dbEmail.ai_analysis
        }));
        setEmails(mappedEmails);
      }
    } catch (error) {
      console.error('Error loading emails:', error);
    }
    setLoading(false);
  }, []);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const r = await fetch('/api/email?action=stats');
      const data = await r.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  // Sync emails from IMAP
  const syncEmails = async () => {
    if (!confirm('Sync emails from your IMAP mailbox? This will fetch the last 50 emails.')) return;
    setLoading(true);
    try {
      const r = await fetch('/api/email?action=sync', { method: 'POST' });
      const data = await r.json();
      if (data.success) {
        alert(`Synced ${data.synced} new emails! Total: ${data.total}`);
        await loadEmails();
        await loadStats();
      } else {
        alert(`Sync failed: ${data.error}\n\n${data.message || ''}`);
      }
    } catch (error) {
      alert('Failed to sync emails');
    }
    setLoading(false);
  };

  // Import demo emails
  const importDemoEmails = async () => {
    setLoading(true);
    try {
      await fetch('/api/email?action=import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: DEMO_EMAILS })
      });
      setImported(true);
      await loadEmails();
      await loadStats();
    } catch (error) {
      console.error('Error importing emails:', error);
    }
    setLoading(false);
  };

  // Initial load
  useEffect(() => {
    loadEmails();
    loadStats();
  }, [loadEmails, loadStats]);

  // Get AI suggestion
  const getAISuggestion = async (emailId: string) => {
    setAnalyzing(emailId);
    try {
      const r = await fetch(`/api/email?action=aiSuggest&emailId=${emailId}`);
      const data = await r.json();
      if (data.success) {
        setAiSuggestion(data.suggestion);
        setReplyData({ body: data.suggestion });
        setShowAI(true);
      }
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
    }
    setAnalyzing(null);
  };

  // Send email
  const sendEmail = async () => {
    if (!composeData.to || !composeData.subject || !composeData.body) return;
    setSending(true);
    try {
      const r = await fetch('/api/email?action=send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(composeData)
      });
      const data = await r.json();
      if (data.success) {
        setShowCompose(false);
        setComposeData({ to: '', subject: '', body: '' });
        alert('Email sent successfully!');
      } else {
        alert('Failed to send: ' + data.error);
      }
    } catch (error) {
      alert('Failed to send email');
    }
    setSending(false);
  };

  // Reply to email thread
  const replyToEmail = async () => {
    if (!selectedEmail || !replyData.body) return;
    setSending(true);
    try {
      // Get thread_id from selected email
      const r = await fetch('/api/email?action=list');
      const data = await r.json();
      if (data.success) {
        const dbEmail = (data.emails || []).find((e: DbEmail) => e.id === selectedEmail.id);
        const threadId = dbEmail?.thread_id || dbEmail?.id;

        const replyRes = await fetch('/api/email?action=reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId, replyBody: replyData.body })
        });
        const replyData = await replyRes.json();
        if (replyData.success) {
          setReplyData({ body: '' });
          setShowAI(false);
          setAiSuggestion('');
          alert('Reply sent successfully!');
        } else {
          alert('Failed to send reply: ' + replyData.error);
        }
      }
    } catch (error) {
      alert('Failed to send reply');
    }
    setSending(false);
  };

  // Mark as read
  const markRead = async (emailId: string) => {
    await fetch(`/api/email?action=markRead&emailId=${emailId}`);
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, read: true } : e));
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(prev => prev ? { ...prev, read: true } : null);
    }
  };

  // Toggle starred
  const toggleStar = async (email: Email) => {
    await fetch(`/api/email?action=markStarred&emailId=${email.id}&starred=${!email.starred}`);
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, starred: !e.starred } : e));
  };

  // Delete email
  const deleteEmail = async (emailId: string) => {
    if (!confirm('Delete this email?')) return;
    await fetch(`/api/email?action=delete&emailId=${emailId}`);
    setEmails(prev => prev.filter(e => e.id !== emailId));
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(null);
    }
    loadStats();
  };

  // Convert email to lead
  const convertToLead = async (email: Email) => {
    if (!confirm('Convert this email to a lead?')) return;
    const r = await fetch(`/api/email?action=convertToLead&emailId=${email.id}`);
    const data = await r.json();
    if (data.success) {
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, category: 'lead', leadScore: Math.max(e.leadScore, 70) } : e));
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(prev => prev ? { ...prev, category: 'lead', leadScore: Math.max(prev.leadScore, 70) } : null);
      }
      alert(`Converted to lead!\nName: ${data.lead.name}\nEmail: ${data.lead.email}\nScore: ${data.lead.score}`);
    } else {
      alert('Failed to convert: ' + (data.error || 'Unknown error'));
    }
  };

  // Filter emails
  const filteredEmails = emails.filter(email => {
    const matchesSearch = searchQuery === '' ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.fromName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.from.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = filterCategory === 'all' || email.category === filterCategory;

    let matchesScore = true;
    if (filterScore === 'hot') matchesScore = email.leadScore >= 80;
    else if (filterScore === 'warm') matchesScore = email.leadScore >= 50 && email.leadScore < 80;
    else if (filterScore === 'cold') matchesScore = email.leadScore < 50;

    return matchesSearch && matchesCategory && matchesScore;
  });

  // Select email
  const selectEmail = (email: Email) => {
    setSelectedEmail(email);
    if (!email.read) {
      markRead(email.id);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-gray-400';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <TrendingUp className="w-4 h-4" />;
    if (score >= 50) return <Minus className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'lead': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'support': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'newsletter': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-600/20 text-gray-400 border-gray-600/30';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'Positive':
      case 'Excited': return <span className="text-green-400">😊</span>;
      case 'Negative': return <span className="text-red-400">😔</span>;
      case 'Hesitant': return <span className="text-amber-400">🤔</span>;
      default: return <span className="text-gray-400">😐</span>;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail className="w-7 h-7 text-blue-400" />
            Email Inbox
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            AI-powered email management with lead scoring
            {stats && (
              <span className="ml-2 text-green-400">
                • {stats.hotLeads} hot leads
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!imported && emails.length === 0 && (
            <button
              onClick={importDemoEmails}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Zap className="w-4 h-4" />
              Load Demo Emails
            </button>
          )}
          <button
            onClick={syncEmails}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Inbox className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Sync Emails
          </button>
          <button
            onClick={() => { loadEmails(); loadStats(); }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
            Compose
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-6 gap-4 mb-6">
          <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-xs mb-1">Total Emails</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-xs mb-1">Unread</p>
            <p className="text-2xl font-bold text-amber-400">{stats.unread}</p>
          </div>
          <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
            <p className="text-gray-400 text-xs mb-1">Hot Leads</p>
            <p className="text-2xl font-bold text-red-400">{stats.hotLeads}</p>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
            <p className="text-gray-400 text-xs mb-1">Warm Leads</p>
            <p className="text-2xl font-bold text-amber-400">{stats.warmLeads}</p>
          </div>
          <div className="bg-gray-500/10 rounded-xl p-4 border border-gray-500/30">
            <p className="text-gray-400 text-xs mb-1">Cold</p>
            <p className="text-2xl font-bold text-gray-400">{stats.coldLeads}</p>
          </div>
          <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30">
            <p className="text-gray-400 text-xs mb-1">Avg Score</p>
            <p className="text-2xl font-bold text-blue-400">{stats.avgScore}</p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as any)}
          className="px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Categories</option>
          <option value="lead">Leads</option>
          <option value="support">Support</option>
          <option value="newsletter">Newsletters</option>
        </select>
        <select
          value={filterScore}
          onChange={(e) => setFilterScore(e.target.value as any)}
          className="px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Scores</option>
          <option value="hot">Hot (80+)</option>
          <option value="warm">Warm (50-79)</option>
          <option value="cold">Cold (&lt;50)</option>
        </select>
      </div>

      {/* Email List and View */}
      <div className="flex-1 flex gap-4 min-h-0" style={{ height: 'calc(100vh - 380px)' }}>
        {/* Email List */}
        <div className="w-96 flex-shrink-0 flex flex-col bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden">
          <div className="p-3 border-b border-gray-700/50 flex items-center justify-between">
            <span className="text-gray-400 text-sm">{filteredEmails.length} emails</span>
            {emails.length > 0 && (
              <span className="text-green-400 text-xs">
                <Sparkles className="w-3 h-3 inline mr-1" />
                AI Analyzed
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {emails.length === 0
                  ? 'No emails yet. Click "Load Demo Emails" to try it out!'
                  : 'No emails match your filters'}
              </div>
            ) : (
              filteredEmails.map(email => (
                <button
                  key={email.id}
                  onClick={() => selectEmail(email)}
                  className={`w-full p-3 text-left hover:bg-gray-700/40 transition-colors border-b border-gray-700/30 ${
                    selectedEmail?.id === email.id ? 'bg-blue-600/20 border-l-2 border-l-blue-500' : ''
                  } ${!email.read ? 'bg-gray-700/30' : ''}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className={`text-sm font-medium truncate ${!email.read ? 'text-white' : 'text-gray-300'}`}>
                      {email.fromName}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {email.starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                      <span className="text-gray-500 text-[10px]">{formatDate(email.date)}</span>
                    </div>
                  </div>
                  <p className={`text-xs truncate ${!email.read ? 'text-gray-200' : 'text-gray-400'}`}>
                    {email.subject}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getCategoryColor(email.category)}`}>
                      {email.category}
                    </span>
                    <span className={`text-[10px] flex items-center gap-1 ${getScoreColor(email.leadScore)}`}>
                      {getScoreIcon(email.leadScore)}
                      {email.leadScore}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Email View */}
        <div className="flex-1 flex flex-col bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden">
          {selectedEmail ? (
            <>
              {/* Email Header */}
              <div className="p-4 border-b border-gray-700/50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-white font-semibold text-lg">{selectedEmail.subject}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-400 text-sm">
                        From: <span className="text-white">{selectedEmail.fromName}</span>
                      </span>
                      <span className="text-gray-500 text-xs">&lt;{selectedEmail.from}&gt;</span>
                    </div>
                    <span className="text-gray-500 text-xs">{formatDate(selectedEmail.date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleStar(selectedEmail)}
                      className={`p-2 rounded-lg transition-colors ${
                        selectedEmail.starred
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-gray-700/50 text-gray-400 hover:text-amber-400'
                      }`}
                    >
                      {selectedEmail.starred ? <Star className="w-4 h-4 fill-amber-400" /> : <StarOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => deleteEmail(selectedEmail.id)}
                      className="p-2 bg-gray-700/50 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Lead Score and Category */}
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                    selectedEmail.leadScore >= 80
                      ? 'bg-red-500/10 border-red-500/30'
                      : selectedEmail.leadScore >= 50
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-gray-700/30 border-gray-600/30'
                  }`}>
                    {getScoreIcon(selectedEmail.leadScore)}
                    <span className={`font-bold ${getScoreColor(selectedEmail.leadScore)}`}>
                      {selectedEmail.leadScore}
                    </span>
                    <span className="text-gray-400 text-sm">Lead Score</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border ${getCategoryColor(selectedEmail.category)}`}>
                    {selectedEmail.category}
                  </span>
                  {selectedEmail.aiAnalysis && (
                    <button
                      onClick={() => setShowAI(!showAI)}
                      className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 rounded border border-purple-500/30 text-xs hover:bg-purple-500/30"
                    >
                      <Brain className="w-3 h-3" />
                      AI Analysis
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
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Intent</p>
                      <p className="text-white text-sm">{selectedEmail.aiAnalysis.intent}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Sentiment</p>
                      <p className="text-white text-sm flex items-center gap-1">
                        {getSentimentIcon(selectedEmail.aiAnalysis.sentiment)}
                        {selectedEmail.aiAnalysis.sentiment}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Urgency</p>
                      <p className={`text-sm font-medium ${
                        selectedEmail.aiAnalysis.urgency === 'High' ? 'text-red-400' :
                        selectedEmail.aiAnalysis.urgency === 'Low' ? 'text-gray-400' : 'text-amber-400'
                      }`}>
                        {selectedEmail.aiAnalysis.urgency}
                      </p>
                    </div>
                  </div>
                  {selectedEmail.aiAnalysis.keyPoints.length > 0 && (
                    <div className="mt-3">
                      <p className="text-gray-400 text-xs mb-1">Key Points</p>
                      <ul className="text-white text-sm list-disc list-inside">
                        {selectedEmail.aiAnalysis.keyPoints.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-3 p-2 bg-purple-500/10 rounded-lg">
                    <p className="text-gray-400 text-xs mb-1">Suggested Action</p>
                    <p className="text-green-400 text-sm">{selectedEmail.aiAnalysis.suggestedAction}</p>
                  </div>
                </div>
              )}

              {/* Email Body */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="prose prose-invert max-w-none">
                  {selectedEmail.body.split('\n').map((line, i) => (
                    <p key={i} className="text-gray-300 mb-2">{line}</p>
                  ))}
                </div>
              </div>

              {/* Reply Section */}
              <div className="p-4 border-t border-gray-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <span className="text-white font-medium">Reply</span>
                  {selectedEmail.aiAnalysis && !aiSuggestion && (
                    <button
                      onClick={() => getAISuggestion(selectedEmail.id)}
                      disabled={!!analyzing}
                      className="ml-auto flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs transition-colors"
                    >
                      {analyzing === selectedEmail.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {analyzing === selectedEmail.id ? 'Analyzing...' : 'AI Suggest Reply'}
                    </button>
                  )}
                  {aiSuggestion && (
                    <button
                      onClick={() => { setAiSuggestion(''); setReplyData({ body: '' }); }}
                      className="ml-auto flex items-center gap-1 px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-xs transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  value={replyData.body}
                  onChange={(e) => setReplyData({ body: e.target.value })}
                  placeholder="Type your reply..."
                  rows={4}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
                <div className="flex items-center justify-between mt-3">
                  {selectedEmail.category !== 'lead' && (
                    <button
                      onClick={() => convertToLead(selectedEmail)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-lg text-sm transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      Convert to Lead
                    </button>
                  )}
                  <button
                    onClick={replyToEmail}
                    disabled={!replyData.body.trim() || sending}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Compose Email</h3>
              <button onClick={() => setShowCompose(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">To</label>
                <input
                  type="email"
                  value={composeData.to}
                  onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                  placeholder="recipient@example.com"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Subject</label>
                <input
                  type="text"
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  placeholder="Email subject"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Message</label>
                <textarea
                  value={composeData.body}
                  onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                  placeholder="Type your message..."
                  rows={8}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCompose(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={sendEmail}
                  disabled={!composeData.to || !composeData.subject || !composeData.body || sending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
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
