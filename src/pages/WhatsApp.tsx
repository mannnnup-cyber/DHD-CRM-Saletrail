import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Phone, PhoneIncoming, PhoneMissed, Send, RefreshCw, CheckCheck, Check, Clock, User, Search, Tag, ChevronDown, Wifi, WifiOff, AlertCircle, Smile, PhoneCall, Database, CheckCircle2, XCircle, Loader2, Plus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

// WhatsApp API is handled by backend /api/whatsapp
// Frontend calls /api/whatsapp which proxies to Green API
// This avoids CORS issues and keeps credentials secure

const formatChatTimestamp = (rawTimestamp: number): string => {
  if (!rawTimestamp) return '';
  const date = new Date(rawTimestamp * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const TEAM_MEMBERS = [
  { id: 'all', name: 'Unassigned' },
  { id: 'keisha', name: 'Keisha' },
  { id: 'andre', name: 'Andre' },
  { id: 'marcia', name: 'Marcia' },
  { id: 'devon', name: 'Devon' },
  { id: 'tanya', name: 'Tanya' },
];

const MESSAGE_TEMPLATES = [
  { id: 1, name: 'Initial Response', text: 'Hi! Thanks for reaching out to Dirty Hand Designs. How can we help you today?' },
  { id: 2, name: 'Quote Follow-up', text: 'Hi! Just following up on the quote we sent. Do you have any questions about our branding services?' },
  { id: 3, name: 'Design Review', text: 'Hi! Your design mockup is ready for review. Please let us know your feedback and any changes needed.' },
  { id: 4, name: 'Payment Reminder', text: 'Hi! This is a friendly reminder that your invoice is due. Please let us know if you have any questions.' },
  { id: 5, name: 'Project Complete', text: 'Hi! Great news — your project is complete! Thank you for choosing Dirty Hand Designs.' },
];

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  rawTimestamp: number;
  unread: number;
  assignedTo: string;
  phone: string;
  status: 'active' | 'resolved' | 'pending';
}

interface Message {
  id: string;
  text: string;
  timestamp: string;
  fromMe: boolean;
  status: 'sent' | 'delivered' | 'read';
  type: string;
}

interface WACall {
  name: string;
  number: string;
  type: string;
  duration: string;
  time: string;
  date: string;
  rep: string;
}

interface DBTestResult {
  success: boolean;
  connected: boolean;
  message: string;
  tableCounts?: Record<string, number>;
  tableErrors?: Record<string, string>;
  error?: string;
}

export default function WhatsApp() {
  const { state, allCalls, addCall } = useApp();
  const [activeTab, setActiveTab] = useState<'inbox' | 'calls' | 'stats' | 'setup'>('inbox');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<{ configured: boolean; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [assignDropdown, setAssignDropdown] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [waCalls, setWaCalls] = useState<WACall[]>([]);
  const [dbTestResult, setDbTestResult] = useState<DBTestResult | null>(null);
  const [testingDB, setTestingDB] = useState(false);
  const [hasRealData, setHasRealData] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newMessagePhone, setNewMessagePhone] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingNew, setSendingNew] = useState(false);
  const [messageHistoryEnabled, setMessageHistoryEnabled] = useState(false);
  const [enablingHistory, setEnablingHistory] = useState(false);
  const [syncingHistory, setSyncingHistory] = useState(false);
  const [historyLastSynced, setHistoryLastSynced] = useState<Date | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef<number>(0);
  const chatMessagesCache = useRef<Record<string, Message[]>>({});

  const user = state.user;

  // Extract WhatsApp calls from synced calls
  useEffect(() => {
    const whatsappCalls = allCalls
      .filter(c => c.type === 'WhatsApp')
      .map(c => ({
        name: (c as any).contactName || (c as any).notes || 'Unknown',
        number: (c as any).contactPhone || '',
        type: 'WhatsApp',
        duration: c.duration ? `${Math.floor(c.duration / 60)}m ${c.duration % 60}s` : '0s',
        time: new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date(c.timestamp).toLocaleDateString(),
        rep: (c as any).repName || c.repId || 'Unknown'
      }));
    setWaCalls(whatsappCalls);
  }, [allCalls]);

  // Check connection status via backend API
  const checkStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp?action=status');
      const data = await r.json();
      if (data.success) {
        setConnected(data.connected === true);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  // Check webhook status - call backend API which has access to env vars
  const checkWebhookStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp?action=webhookInfo');
      const data = await r.json();
      if (data.success) {
        setWebhookStatus({
          configured: data.configured || false,
          url: data.url || ''
        });
      } else {
        setWebhookStatus({ configured: false, url: '' });
      }
    } catch {
      setWebhookStatus({ configured: false, url: '' });
    }
  }, []);

  // Load chats from backend API (proxies to Green API)
  const loadChats = useCallback(async () => {
    setSyncing(true);
    try {
      // Use syncHistory if enabled to get full chat history with last messages
      const action = messageHistoryEnabled ? 'syncHistory' : 'chats';
      // Prefer DB-backed chats endpoint
      const r = await fetch(`/api/whatsapp?action=chatsFromDb`);
      let data = await r.json();

      // Fallback to provider if DB not available or empty
      if (!data?.success || !data?.chats || data.chats.length === 0) {
        const rp = await fetch(`/api/whatsapp?action=${action}`);
        data = await rp.json();
      }

      if (data.success && data.chats && Array.isArray(data.chats) && data.chats.length > 0) {
        // STRICT check: Real data must have chats with actual names
        const MOCK_NAMES = ['Production Office', 'Sun Island CUG', 'Cindy-lue Miller', 'Aakeem Jones', 'Mr. Charles Williams'];
        const hasRealStructure = data.chats.some((chat: any) => {
          const name = chat.name || '';
          const isMockName = MOCK_NAMES.includes(name);
          const hasProperName = name.length > 0 && !name.includes('@') && !isMockName;
          return chat.id && hasProperName;
        });

        if (hasRealStructure || data.synced) {
          // Store messages cache if synced
          if (data.messages && typeof data.messages === 'object') {
            chatMessagesCache.current = data.messages;
          }

          const formatted: Chat[] = data.chats.slice(0, 50).map((chat: any) => ({
            id: chat.id || '',
            name: chat.name || chat.phone || 'Unknown',
            lastMessage: chat.lastMessage || '',
            timestamp: chat.rawTimestamp ? formatChatTimestamp(chat.rawTimestamp) : (chat.timestamp || ''),
            rawTimestamp: chat.rawTimestamp || 0,
            unread: chat.unread || 0,
            assignedTo: 'Unassigned',
            phone: chat.phone || chat.id?.split('@')[0] || '',
            status: (chat.status || 'active') as 'active' | 'resolved' | 'pending'
          }));
          setChats(formatted);
          setHasRealData(true);

          if (data.synced) {
            setHistoryLastSynced(new Date());
          }
        } else {
          console.log('No real chat structure, showing empty');
          setChats([]);
          setHasRealData(false);
        }
      } else {
        setChats([]);
        setHasRealData(false);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      setChats([]);
      setHasRealData(false);
    }
    setSyncing(false);
  }, [messageHistoryEnabled]);

  // Load messages for a chat via backend API
  const loadMessages = useCallback(async (chatId: string) => {
    setLoading(true);
    try {
      // First check if we have cached messages from syncHistory
      if (chatMessagesCache.current[chatId]) {
        setMessages(chatMessagesCache.current[chatId]);
        lastMessageCountRef.current = chatMessagesCache.current[chatId].length;
        setLoading(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        return;
      }

      // Otherwise fetch from API
      const r = await fetch(`/api/whatsapp?action=messages&chatId=${encodeURIComponent(chatId)}`);
      const data = await r.json();

      if (data.success && data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        const formatted: Message[] = data.messages.map((msg: any) => ({
          id: msg.idMessage || msg.id || Math.random().toString(),
          text: msg.textMessage || msg.text || msg.caption || 'Media message',
          timestamp: msg.timestamp
            ? new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '',
          fromMe: msg.type === 'outgoing' || msg.type === 'outgoing' || msg.fromMe === true,
          status: 'read' as const,
          type: msg.typeMessage || msg.type || 'text'
        }));
        setMessages(formatted.reverse());
        lastMessageCountRef.current = formatted.length;

        // Cache the messages
        chatMessagesCache.current[chatId] = formatted.reverse();
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
    setLoading(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  // Send message via backend API
  const sendMessage = async () => {
    if (!replyText.trim() || !selectedChat) return;
    setSending(true);
    const text = replyText;
    setReplyText('');

    const newMsg: Message = {
      id: Date.now().toString(),
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fromMe: true,
      status: 'sent',
      type: 'text'
    };
    setMessages(prev => [...prev, newMsg]);

    try {
      const r = await fetch('/api/whatsapp?action=send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: selectedChat.id, message: text })
      });
      const data = await r.json();

      if (data.success) {
        setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, status: 'delivered' } : m));

        // Update chat's last message in the list
        setChats(prev => prev.map(c =>
          c.id === selectedChat.id
            ? { ...c, lastMessage: text.slice(0, 50), timestamp: newMsg.timestamp }
            : c
        ));

        // Log as WhatsApp activity (NOT a call)
        addCall({
          repId: user?.id || 'rep1',
          contactId: '',
          contactName: selectedChat.name,
          contactPhone: selectedChat.phone,
          type: 'WhatsApp',
          duration: 0,
          notes: `Sent: ${text.slice(0, 100)}`,
          source: 'WhatsApp',
          outcome: 'Message Sent'
        } as any);
      }
    } catch {
      // Message still shows locally
    }
    setSending(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Send new message to a new contact
  const sendNewMessage = async () => {
    if (!newMessagePhone.trim() || !newMessageText.trim()) return;

    // Format phone number — strip non-digits, add Jamaica country code if needed
    let phone = newMessagePhone.replace(/\D/g, '');
    // Jamaica numbers are 10 digits starting with 876 — prepend country code 1
    if (phone.length === 10 && phone.startsWith('876')) {
      phone = `1${phone}`;
    }
    // 7-digit local number — prepend 1876
    if (phone.length === 7) {
      phone = `1876${phone}`;
    }
    phone = `${phone}@c.us`;

    setSendingNew(true);
    try {
      const r = await fetch('/api/whatsapp?action=send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: phone, message: newMessageText })
      });
      const data = await r.json();

      if (data.success) {
        setShowNewMessage(false);
        setNewMessagePhone('');
        setNewMessageText('');
        // Refresh chat list from Green API so the new conversation appears correctly
        await loadChats();

        // Log as WhatsApp activity (NOT a call)
        addCall({
          repId: user?.id || 'rep1',
          contactId: '',
          contactName: newMessagePhone,
          contactPhone: newMessagePhone.replace(/\D/g, ''),
          type: 'WhatsApp',
          duration: 0,
          notes: `Sent: ${newMessageText.slice(0, 100)}`,
          source: 'WhatsApp',
          outcome: 'Message Sent'
        } as any);
      } else {
        alert('Failed to send message: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to send message');
    }
    setSendingNew(false);
  };

  // Enable message history - syncs chat history from WhatsApp
  const enableMessageHistory = async () => {
    setEnablingHistory(true);
    setSyncingHistory(true);
    try {
      // First, ensure webhooks are configured
      const webhookR = await fetch('/api/whatsapp?action=setWebhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: `${window.location.origin}/api/whatsapp`,
          incomingWebhook: true,
          outgoingWebhook: true,
          stateWebhook: true
        })
      });
      const webhookData = await webhookR.json();

      if (!webhookData.success) {
        alert('Failed to configure webhooks. Please try again.');
        setEnablingHistory(false);
        setSyncingHistory(false);
        return;
      }

      // Now sync the history
      const syncR = await fetch('/api/whatsapp?action=syncHistory');
      const syncData = await syncR.json();

      if (syncData.success && syncData.chats) {
        // Update chats with synced data
        const formatted: Chat[] = syncData.chats.map((chat: any) => ({
          id: chat.id || '',
          name: chat.name || chat.phone || 'Unknown',
          lastMessage: chat.lastMessage || '',
          timestamp: chat.rawTimestamp ? formatChatTimestamp(chat.rawTimestamp) : (chat.timestamp || ''),
          rawTimestamp: chat.rawTimestamp || 0,
          unread: chat.unread || 0,
          assignedTo: 'Unassigned',
          phone: chat.phone || chat.id?.split('@')[0] || '',
          status: 'active' as const
        }));

        setChats(formatted);
        setHasRealData(true);

        // Cache all messages
        if (syncData.messages) {
          chatMessagesCache.current = syncData.messages;
        }

        setMessageHistoryEnabled(true);
        setHistoryLastSynced(new Date());
        checkWebhookStatus();

        alert(`Message history synced! Loaded ${syncData.count} conversations. Click any chat to view messages.`);
      } else {
        alert('Failed to sync message history. Please try again.');
      }
    } catch (error) {
      console.error('Error syncing history:', error);
      alert('Failed to sync message history. Please try again.');
    }
    setEnablingHistory(false);
    setSyncingHistory(false);
  };

  // Test database connection
  const testDatabaseConnection = async () => {
    setTestingDB(true);
    try {
      const r = await fetch('/api/db-test');
      const data = await r.json();
      setDbTestResult(data);
    } catch (error: any) {
      setDbTestResult({
        success: false,
        connected: false,
        error: error.message,
        message: 'Failed to test database connection'
      });
    }
    setTestingDB(false);
  };

  // Mock helpers removed to reduce unused-symbol noise

  // Initial load
  useEffect(() => {
    checkStatus();
    checkWebhookStatus();
    loadChats();
  }, [checkStatus, checkWebhookStatus, loadChats]);

  // Poll for new messages every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      checkStatus();
      if (selectedChat) {
        loadMessages(selectedChat.id);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [checkStatus, selectedChat, loadMessages]);

  // Reload chats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      loadChats();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadChats]);

  useEffect(() => {
    if (selectedChat) loadMessages(selectedChat.id);
  }, [selectedChat, loadMessages]);

  const filteredChats = chats.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0);
  const totalChats = chats.length;
  const activeChats = chats.filter(c => c.status === 'active').length;
  const resolvedChats = chats.filter(c => c.status === 'resolved').length;
  const whatsappCallsToday = allCalls.filter(c => c.type === 'WhatsApp' && new Date(c.timestamp).toDateString() === new Date().toDateString()).length;

  // Determine if using real or mock data
  const isUsingRealData = hasRealData && connected === true;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-green-400" />
            WhatsApp Business
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            DHD Sales Inbox — Shared team number
            {isUsingRealData && <span className="ml-2 text-green-400">(Live Data)</span>}
            {!isUsingRealData && connected && <span className="ml-2 text-amber-400">(Using Mock Data - Check Setup)</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            connected === true ? 'bg-green-500/20 text-green-400' :
            connected === false ? 'bg-red-500/20 text-red-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {connected === true ? <Wifi className="w-4 h-4" /> :
             connected === false ? <WifiOff className="w-4 h-4" /> :
             <AlertCircle className="w-4 h-4" />}
            {connected === true ? 'Connected' : connected === false ? 'Disconnected' : 'Checking...'}
          </div>
          <button
            onClick={() => { checkStatus(); checkWebhookStatus(); loadChats(); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowNewMessage(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Message
          </button>
        </div>
      </div>

      {/* New Message Modal */}
      {showNewMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">New WhatsApp Message</h3>
              <button onClick={() => setShowNewMessage(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Phone Number</label>
                <input
                  type="text"
                  value={newMessagePhone}
                  onChange={(e) => setNewMessagePhone(e.target.value)}
                  placeholder="8761234567 or 18761234567"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Message</label>
                <textarea
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Type your message..."
                  rows={4}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewMessage(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={sendNewMessage}
                  disabled={!newMessagePhone.trim() || !newMessageText.trim() || sendingNew}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {sendingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Chats', value: totalChats, color: 'blue' },
          { label: 'Unread', value: totalUnread, color: 'red' },
          { label: 'Active', value: activeChats, color: 'green' },
          { label: 'Resolved', value: resolvedChats, color: 'gray' },
          { label: 'WA Calls Today', value: whatsappCallsToday, color: 'purple' },
        ].map((stat, i) => (
          <div key={i} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-xs mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${
              stat.color === 'blue' ? 'text-blue-400' :
              stat.color === 'red' ? 'text-red-400' :
              stat.color === 'green' ? 'text-green-400' :
              stat.color === 'purple' ? 'text-purple-400' : 'text-gray-400'
            }`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800/40 rounded-xl p-1">
        {(['inbox', 'calls', 'stats', 'setup'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all capitalize ${
              activeTab === tab ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'inbox' && `Inbox${totalUnread > 0 ? ` (${totalUnread})` : ''}`}
            {tab === 'calls' && `Calls${waCalls.length > 0 ? ` (${waCalls.length})` : ''}`}
            {tab === 'stats' && 'Stats'}
            {tab === 'setup' && 'Setup'}
          </button>
        ))}
      </div>

      {/* INBOX TAB */}
      {activeTab === 'inbox' && (
        <div className="flex-1 flex gap-4 min-h-0" style={{ height: 'calc(100vh - 320px)' }}>
          {/* Chat List */}
          <div className="w-80 flex-shrink-0 flex flex-col bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-3 border-b border-gray-700/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredChats.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  {syncing ? 'Loading chats...' : 'No chats found'}
                </div>
              ) : (
                filteredChats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full p-3 text-left hover:bg-gray-700/40 transition-colors border-b border-gray-700/30 ${
                      selectedChat?.id === chat.id ? 'bg-green-600/20 border-l-2 border-l-green-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {chat.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-white text-sm font-medium truncate">{chat.name}</span>
                          <span className="text-gray-500 text-[10px] flex-shrink-0 ml-2">{chat.timestamp}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-gray-400 text-xs truncate">{chat.lastMessage}</p>
                          {chat.unread > 0 && (
                            <span className="ml-2 flex-shrink-0 bg-green-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                              {chat.unread}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                            chat.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            chat.status === 'resolved' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            {chat.status}
                          </span>
                          {chat.assignedTo !== 'Unassigned' && (
                            <span className="text-[9px] text-blue-400">{chat.assignedTo}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Message Area */}
          <div className="flex-1 flex flex-col bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden">
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
                      {selectedChat.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium">{selectedChat.name}</p>
                      <p className="text-gray-400 text-xs">+{selectedChat.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setAssignDropdown(!assignDropdown)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                      >
                        <User className="w-3.5 h-3.5" />
                        {selectedChat.assignedTo}
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      {assignDropdown && (
                        <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 min-w-[140px]">
                          {TEAM_MEMBERS.map(member => (
                            <button
                              key={member.id}
                              onClick={() => {
                                setChats(prev => prev.map(c =>
                                  c.id === selectedChat.id ? { ...c, assignedTo: member.name } : c
                                ));
                                setSelectedChat(prev => prev ? { ...prev, assignedTo: member.name } : null);
                                setAssignDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                            >
                              {member.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setChats(prev => prev.map(c =>
                          c.id === selectedChat.id
                            ? { ...c, status: c.status === 'resolved' ? 'active' : 'resolved' }
                            : c
                        ));
                        setSelectedChat(prev => prev
                          ? { ...prev, status: prev.status === 'resolved' ? 'active' : 'resolved' }
                          : null
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedChat.status === 'resolved'
                          ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                          : 'bg-green-600/30 text-green-400 hover:bg-green-600/50'
                      }`}
                    >
                      {selectedChat.status === 'resolved' ? 'Reopen' : 'Resolve'}
                    </button>
                    <a
                      href={`https://wa.me/${selectedChat.phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-lg transition-colors"
                      title="Open in WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Messages */}
                <div
                  className="flex-1 overflow-y-auto p-4 space-y-3"
                  style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '20px 20px' }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <RefreshCw className="w-6 h-6 text-green-400 animate-spin" />
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl ${
                          msg.fromMe
                            ? 'bg-green-600 text-white rounded-br-sm'
                            : 'bg-gray-700 text-gray-100 rounded-bl-sm'
                        }`}>
                          <p className="text-sm leading-relaxed">{msg.text}</p>
                          <div className={`flex items-center gap-1 mt-1 ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[10px] opacity-70">{msg.timestamp}</span>
                            {msg.fromMe && (
                              msg.status === 'read' ? <CheckCheck className="w-3 h-3 text-blue-300" /> :
                              msg.status === 'delivered' ? <CheckCheck className="w-3 h-3 opacity-70" /> :
                              <Check className="w-3 h-3 opacity-70" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Box */}
                <div className="p-3 border-t border-gray-700/50">
                  {showTemplates && (
                    <div className="mb-3 bg-gray-700/50 rounded-xl p-3 border border-gray-600/50">
                      <p className="text-gray-400 text-xs mb-2 font-medium">Quick Templates:</p>
                      <div className="space-y-1">
                        {MESSAGE_TEMPLATES.map(t => (
                          <button
                            key={t.id}
                            onClick={() => { setReplyText(t.text); setShowTemplates(false); }}
                            className="w-full text-left px-3 py-2 bg-gray-800/50 hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <p className="text-amber-400 text-xs font-medium">{t.name}</p>
                            <p className="text-gray-300 text-xs truncate">{t.text}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <button
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="p-2 text-gray-400 hover:text-amber-400 transition-colors"
                      title="Message templates"
                    >
                      <Tag className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-yellow-400 transition-colors">
                      <Smile className="w-5 h-5" />
                    </button>
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Type a message... (Enter to send)"
                      rows={1}
                      className="flex-1 px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500 resize-none"
                      style={{ minHeight: '42px', maxHeight: '120px' }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!replyText.trim() || sending}
                      className="p-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl transition-colors"
                    >
                      {sending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center flex-col gap-4">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-10 h-10 text-green-400" />
                </div>
                <div className="text-center">
                  <p className="text-white font-medium text-lg">Select a conversation</p>
                  <p className="text-gray-400 text-sm mt-1">Choose a chat from the left to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CALLS TAB */}
      {activeTab === 'calls' && (
        <div className="space-y-4">
          <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-green-400" />
              WhatsApp Call Log
              <span className="ml-auto text-xs text-gray-500">{waCalls.length} calls logged</span>
            </h3>
            {waCalls.length > 0 ? (
              <div className="space-y-3">
                {waCalls.map((call, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        call.type === 'Outgoing' ? 'bg-blue-500/20' :
                        call.type === 'Incoming' ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        {call.type === 'Outgoing' ? <Phone className="w-5 h-5 text-blue-400" /> :
                         call.type === 'Incoming' ? <PhoneIncoming className="w-5 h-5 text-green-400" /> :
                         <PhoneMissed className="w-5 h-5 text-red-400" />}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{call.name || 'Unknown'}</p>
                        <p className="text-gray-400 text-xs">+{call.number} . {call.rep}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        call.type === 'Outgoing' ? 'text-blue-400' :
                        call.type === 'Incoming' ? 'text-green-400' : 'text-red-400'
                      }`}>{call.type}</p>
                      <p className="text-gray-400 text-xs">{call.duration} . {call.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <PhoneCall className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No WhatsApp calls logged yet</p>
                <p className="text-gray-500 text-sm mt-1">WhatsApp calls from MacroDroid will appear here when synced</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STATS TAB */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Total Messages Today', value: chats.reduce((s, c) => s + c.unread, 0).toString(), icon: MessageCircle, color: 'green' },
            { label: 'Active Conversations', value: activeChats.toString(), icon: Send, color: 'blue' },
            { label: 'WhatsApp Calls Today', value: whatsappCallsToday.toString(), icon: Phone, color: 'purple' },
            { label: 'Avg Response Time', value: '4 min', icon: Clock, color: 'amber' },
            { label: 'Conversations Resolved', value: resolvedChats.toString(), icon: CheckCheck, color: 'green' },
            { label: 'Unassigned Chats', value: chats.filter(c => c.assignedTo === 'Unassigned').length.toString(), icon: User, color: 'red' },
          ].map((stat, i) => (
            <div key={i} className="bg-gray-800/60 rounded-xl p-6 border border-gray-700/50">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                stat.color === 'green' ? 'bg-green-500/20' :
                stat.color === 'blue' ? 'bg-blue-500/20' :
                stat.color === 'purple' ? 'bg-purple-500/20' :
                stat.color === 'amber' ? 'bg-amber-500/20' : 'bg-red-500/20'
              }`}>
                <stat.icon className={`w-6 h-6 ${
                  stat.color === 'green' ? 'text-green-400' :
                  stat.color === 'blue' ? 'text-blue-400' :
                  stat.color === 'purple' ? 'text-purple-400' :
                  stat.color === 'amber' ? 'text-amber-400' : 'text-red-400'
                }`} />
              </div>
              <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-gray-400 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* SETUP TAB */}
      {activeTab === 'setup' && (
        <div className="space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto">
          {/* WhatsApp Configuration Status */}
          <div className={`rounded-xl p-4 border ${
            connected === true ? 'bg-green-500/10 border-green-500/30' :
            connected === false ? 'bg-red-500/10 border-red-500/30' :
            'bg-gray-700/30 border-gray-600/50'
          }`}>
            <div className="flex items-center gap-3">
              {connected === true ? <Wifi className="w-5 h-5 text-green-400" /> :
               connected === false ? <WifiOff className="w-5 h-5 text-red-400" /> :
               <AlertCircle className="w-5 h-5 text-gray-400" />}
              <div>
                <p className={`font-medium ${
                  connected === true ? 'text-green-400' :
                  connected === false ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {connected === true ? 'Green API Connected' :
                   connected === false ? 'Green API Not Connected' : 'Checking Connection...'}
                </p>
                <p className="text-gray-400 text-sm">
                  {connected === null ? 'Checking...' : 'Instance is authorized and ready'}
                </p>
              </div>
            </div>
          </div>

          {/* Webhook Status */}
          {connected && (
            <div className={`rounded-xl p-4 border ${
              webhookStatus?.configured ? 'bg-green-500/10 border-green-500/30' : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                {webhookStatus?.configured ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <AlertCircle className="w-5 h-5 text-amber-400" />}
                <p className={`font-medium ${webhookStatus?.configured ? 'text-green-400' : 'text-amber-400'}`}>
                  Webhook {webhookStatus?.configured ? 'Configured' : 'Not Configured'}
                </p>
              </div>
              {webhookStatus?.configured && (
                <p className="text-gray-400 text-xs">URL: {webhookStatus.url}</p>
              )}
              {!webhookStatus?.configured && (
                <div className="mt-3">
                  <p className="text-gray-400 text-sm mb-2">To receive real-time messages:</p>
                  <ol className="text-gray-500 text-xs list-decimal list-inside space-y-1">
                    <li>Go to Green API Dashboard</li>
                    <li>Select your instance</li>
                    <li>Go to Settings</li>
                    <li>Set Webhook URL to: <code className="bg-gray-800 px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/whatsapp</code></li>
                    <li>Save settings</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Enable Message History */}
          <div className={`rounded-xl border p-4 ${
            messageHistoryEnabled
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-blue-500/10 border-blue-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium flex items-center gap-2">
                  {messageHistoryEnabled ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : null}
                  {messageHistoryEnabled ? 'Message History Synced' : 'Enable Message History'}
                </h4>
                <p className="text-gray-400 text-xs mt-1">
                  {messageHistoryEnabled
                    ? historyLastSynced
                      ? `Last synced: ${historyLastSynced.toLocaleTimeString()}`
                      : 'Synced - click to re-sync'
                    : 'Load your WhatsApp chat history from Green API'
                  }
                </p>
              </div>
              <button
                onClick={enableMessageHistory}
                disabled={enablingHistory}
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${
                  messageHistoryEnabled
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                } ${enablingHistory ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {enablingHistory ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className={`w-4 h-4 ${syncingHistory ? 'animate-spin' : ''}`} />
                    {messageHistoryEnabled ? 'Re-sync' : 'Sync Now'}
                  </>
                )}
              </button>
            </div>
            {messageHistoryEnabled && chats.length > 0 && (
              <p className="text-green-400 text-xs mt-2">
                {chats.length} conversations loaded with last messages
              </p>
            )}
          </div>

          {/* Database Connection Test */}
          <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-400" />
                Database Connection
              </h3>
              <button
                onClick={testDatabaseConnection}
                disabled={testingDB}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {testingDB ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {testingDB ? 'Testing...' : 'Test Connection'}
              </button>
            </div>

            {dbTestResult && (
              <div className={`rounded-xl p-4 border ${
                dbTestResult.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  {dbTestResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <p className={`font-medium ${dbTestResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {dbTestResult.message}
                  </p>
                </div>

                {dbTestResult.error && (
                  <p className="text-red-400 text-xs mb-3">Error: {dbTestResult.error}</p>
                )}

                {dbTestResult.tableCounts && (
                  <div className="space-y-2">
                    <p className="text-gray-400 text-xs font-medium">Table Record Counts:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(dbTestResult.tableCounts).map(([table, count]) => (
                        <div key={table} className="bg-gray-800/50 rounded-lg p-2 text-center">
                          <p className="text-white font-bold">{count as number}</p>
                          <p className="text-gray-500 text-[10px]">{table}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dbTestResult.tableErrors && (
                  <div className="mt-3">
                    <p className="text-amber-400 text-xs font-medium mb-2">Missing Tables (run SQL schema):</p>
                    <div className="space-y-1">
                      {Object.entries(dbTestResult.tableErrors).map(([table, error]) => (
                        <p key={table} className="text-amber-300 text-xs">
                          . {table}: {error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!dbTestResult && (
              <p className="text-gray-500 text-sm text-center py-4">
                Click "Test Connection" to verify database connectivity
              </p>
            )}
          </div>

          {/* Setup Guide */}
          <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-6">
            <h3 className="text-white font-semibold mb-4">Setup Guide</h3>
            <div className="space-y-4">
              {[
                { step: '1', title: 'Green API Account Created', desc: 'Account created at green-api.com', done: connected !== null },
                { step: '2', title: 'Link WhatsApp Business', desc: 'Open WhatsApp Business . Settings . Linked Devices . Link Device . Scan QR in Green API dashboard', done: connected === true },
                { step: '3', title: 'Configure Webhook', desc: 'In Green API dashboard . Settings . Webhook URL: ' + (typeof window !== 'undefined' ? window.location.origin : '') + '/api/whatsapp', done: webhookStatus?.configured || false },
                { step: '4', title: 'Environment Variables Set', desc: 'GREENAPI_INSTANCE_ID and GREENAPI_TOKEN added to Vercel (check Vercel project settings)', done: connected !== null },
                { step: '5', title: 'Add MacroDroid WhatsApp Trigger', desc: 'Add notification trigger for WhatsApp calls in MacroDroid to log WhatsApp calls to Google Sheets', done: false },
              ].map(item => (
                <div key={item.step} className={`flex items-start gap-4 p-4 rounded-xl ${
                  item.done ? 'bg-green-500/10 border border-green-500/20' : 'bg-gray-700/30'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                    item.done ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-400'
                  }`}>
                    {item.done ? 'OK' : item.step}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{item.title}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Environment Variables Info */}
          <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-6">
            <h3 className="text-white font-semibold mb-4">Environment Variables</h3>
            <p className="text-gray-400 text-sm mb-4">
              Add these environment variables in Vercel Dashboard . Your Project . Settings . Environment Variables:
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-700/40 rounded-lg">
                <span className="text-gray-400 text-sm">GREENAPI_INSTANCE_ID</span>
                <span className="text-blue-400 text-xs">Required</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700/40 rounded-lg">
                <span className="text-gray-400 text-sm">GREENAPI_TOKEN</span>
                <span className="text-blue-400 text-xs">Required</span>
              </div>
            </div>
          </div>

          {/* Important Note */}
          <div className="bg-amber-500/10 rounded-xl border border-amber-500/30 p-4">
            <p className="text-amber-400 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Keep DHD Business Phone Online
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Green API works like WhatsApp Web. Your DHD Business phone must stay connected to WiFi at the office 24/7. Keep it plugged in and charging.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
