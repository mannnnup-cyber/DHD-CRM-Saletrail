import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Phone, Send, RefreshCw, CheckCheck, Check, Clock, User, Search, Tag, ChevronDown, Wifi, WifiOff, AlertCircle, Smile, Database, CheckCircle2, XCircle, Loader2, Plus, X, FileText, Download, Volume2, Paperclip, Bell, BellOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

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
  mediaUrl?: string;
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
  const { state, addCall } = useApp();
  const [activeTab, setActiveTab] = useState<'inbox' | 'stats' | 'setup'>('inbox');
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
  const [hasRealData, setHasRealData] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newMessagePhone, setNewMessagePhone] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingNew, setSendingNew] = useState(false);
  const [messageHistoryEnabled] = useState(false); // kept for legacy loadChats branch, unused
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef<number>(0);
  const chatMessagesCache = useRef<Record<string, Message[]>>({});
  const selectedChatRef = useRef<Chat | null>(null);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const fetchingAvatars = useRef<Set<string>>(new Set());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [msgSearchResults, setMsgSearchResults] = useState<any[]>([]);
  const [searchingMsgs, setSearchingMsgs] = useState(false);
  const [unifiedSearchActive, setUnifiedSearchActive] = useState(false);
  const [unifiedSearchQuery, setUnifiedSearchQuery] = useState('');
  const [unifiedSearchResults, setUnifiedSearchResults] = useState<any[]>([]);
  const [unifiedSearching, setUnifiedSearching] = useState(false);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachCaption, setAttachCaption] = useState('');
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [moreHistoryResult, setMoreHistoryResult] = useState<string | null>(null);
  const [sendingFile, setSendingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingWATarget = useRef<{ phone: string; name: string } | null>(null);

  const user = state.user;

  // Read navigation target written by WooCommerce (or any other page)
  useEffect(() => {
    const stored = localStorage.getItem('wa_open_contact');
    if (stored) {
      try { pendingWATarget.current = JSON.parse(stored); } catch {}
      localStorage.removeItem('wa_open_contact');
    }
  }, []);

  // After chats load: resolve pending navigation target
  useEffect(() => {
    const target = pendingWATarget.current;
    if (!target || chats.length === 0) return;
    pendingWATarget.current = null;

    const targetDigits = target.phone.replace(/\D/g, '');
    const match = chats.find(c => {
      const chatDigits = c.phone.replace(/\D/g, '');
      return chatDigits.endsWith(targetDigits) || targetDigits.endsWith(chatDigits);
    });

    if (match) {
      setSelectedChat(match);
      selectedChatRef.current = match;
      setChats(prev => prev.map(c => c.id === match.id ? { ...c, unread: 0 } : c));
      fetch('/api/whatsapp?action=readChat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: match.id })
      }).catch(() => {});
    } else {
      // No existing chat — open new message dialog pre-filled
      setNewMessagePhone(target.phone);
      setShowNewMessage(true);
    }
  }, [chats]);

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
        // STRICT check: Real data must have chats with actual names or phone numbers
        const MOCK_NAMES = ['Production Office', 'Sun Island CUG', 'Cindy-lue Miller', 'Aakeem Jones', 'Mr. Charles Williams'];
        const hasRealStructure = data.chats.some((chat: any) => {
          const name = chat.name || '';
          const id = chat.id || '';
          const isMockName = MOCK_NAMES.includes(name);
          // Real data: either has a proper name OR is a phone number with @c.us/@s.whatsapp.net/@g.us format
          const hasProperName = name.length > 0 && !isMockName && (
            !name.includes('@') ||
            name.includes('@c.us') ||
            name.includes('@s.whatsapp.net') ||
            name.includes('@g.us')
          );
          return id && hasProperName;
        });

        if (hasRealStructure || data.synced) {
          // Store messages cache if synced
          if (data.messages && typeof data.messages === 'object') {
            chatMessagesCache.current = data.messages;
          }

          const formatted: Chat[] = data.chats.slice(0, 300).map((chat: any) => ({
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
            // history synced marker
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
      if (chatMessagesCache.current[chatId]) {
        setMessages(chatMessagesCache.current[chatId]);
        lastMessageCountRef.current = chatMessagesCache.current[chatId].length;
        setLoading(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        return;
      }

      const r = await fetch(`/api/whatsapp?action=messages&chatId=${encodeURIComponent(chatId)}`);
      const data = await r.json();

      if (data.success && data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        let formatted: Message[];

        if (data.source === 'db') {
          // API already normalized these — timestamps are Unix ints, mediaUrl extracted
          formatted = data.messages.map((msg: any) => ({
            id: msg.id,
            text: msg.text || '',
            timestamp: msg.timestamp
              ? new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '',
            fromMe: msg.fromMe,
            status: 'read' as const,
            type: msg.type || 'text',
            mediaUrl: msg.mediaUrl || undefined
          }));
        } else {
          // Raw Green API getChatHistory format — newest first, needs reverse
          formatted = data.messages.map((msg: any) => {
            const mediaUrl =
              msg.imageMessage?.downloadUrl ||
              msg.videoMessage?.downloadUrl ||
              msg.audioMessage?.downloadUrl ||
              msg.documentMessage?.downloadUrl || undefined;
            const text =
              msg.textMessage || msg.text ||
              msg.imageMessage?.caption ||
              msg.videoMessage?.caption ||
              msg.documentMessage?.fileName || '';
            return {
              id: msg.idMessage || msg.id || Math.random().toString(),
              text,
              timestamp: msg.timestamp
                ? new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '',
              fromMe: msg.type === 'outgoing' || msg.fromMe === true,
              status: 'read' as const,
              type: msg.typeMessage || msg.type || 'text',
              mediaUrl
            };
          }).reverse();
        }

        setMessages(formatted);
        lastMessageCountRef.current = formatted.length;
        chatMessagesCache.current[chatId] = formatted;
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

  // Pull more message history for the current chat from Evolution API
  const loadMoreHistory = useCallback(async (chatId: string) => {
    if (!chatId || loadingMoreHistory) return;
    setLoadingMoreHistory(true);
    setMoreHistoryResult(null);
    try {
      const r = await fetch('/api/whatsapp?action=syncEvolutionMessages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, limit: 500 })
      });
      const data = await r.json();
      if (data.success) {
        setMoreHistoryResult(`✅ Pulled ${data.count} messages`);
        // Bust the cache and reload messages
        delete chatMessagesCache.current[chatId];
        await loadMessages(chatId);
      } else {
        setMoreHistoryResult(`❌ ${data.error || 'Failed to pull history'}`);
      }
    } catch (err) {
      setMoreHistoryResult('❌ Network error');
    }
    setLoadingMoreHistory(false);
    // Clear the result label after 4 seconds
    setTimeout(() => setMoreHistoryResult(null), 4000);
  }, [loadingMoreHistory, loadMessages]);

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
    console.log('[sendNewMessage] START - phone:', newMessagePhone, 'text:', newMessageText);

    if (!newMessagePhone.trim() || !newMessageText.trim()) {
      console.log('[sendNewMessage] VALIDATION FAILED - phone empty or text empty');
      return;
    }

    console.log('[sendNewMessage] Validation passed, formatting phone...');

    // Format phone number — strip non-digits, add Jamaica country code if needed
    let phone = newMessagePhone.replace(/\D/g, '');
    console.log('[sendNewMessage] After strip non-digits:', phone);

    // Jamaica numbers are 10 digits starting with 876 — prepend country code 1
    if (phone.length === 10 && phone.startsWith('876')) {
      phone = `1${phone}`;
      console.log('[sendNewMessage] Applied 10-digit rule:', phone);
    }
    // 7-digit local number — prepend 1876
    if (phone.length === 7) {
      phone = `1876${phone}`;
      console.log('[sendNewMessage] Applied 7-digit rule:', phone);
    }
    phone = `${phone}@c.us`;
    console.log('[sendNewMessage] Final formatted phone:', phone);

    setSendingNew(true);
    console.log('[sendNewMessage] Set sending state to true');

    try {
      console.log('[sendNewMessage] About to fetch /api/whatsapp?action=send');
      const r = await fetch('/api/whatsapp?action=send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: phone, message: newMessageText })
      });
      console.log('[sendNewMessage] Fetch completed, status:', r.status);

      const data = await r.json();
      console.log('[sendNewMessage] Response data:', data);

      if (data.success) {
        console.log('[sendNewMessage] SUCCESS - closing dialog and refreshing chats');
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
        console.log('[sendNewMessage] FAILURE - data.error:', data.error);
        alert('Failed to send message: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('[sendNewMessage] CATCH ERROR:', error);
      alert('Failed to send message: ' + String(error));
    }
    setSendingNew(false);
    console.log('[sendNewMessage] END - set sending state to false');
  };

  // Persist chat status change to DB so it survives refresh
  const updateChatStatus = async (chatId: string, status: 'active' | 'resolved' | 'pending', assignedTo?: string) => {
    try {
      await fetch('/api/whatsapp?action=updateChatStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, status, assignedTo })
      });
    } catch (err) {
      console.error('[updateChatStatus] failed:', err);
    }
  };

  // Mock helpers removed to reduce unused-symbol noise

  // Keep ref in sync so real-time callback can read it without stale closure
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  // Supabase real-time subscription — receive new messages instantly without polling
  useEffect(() => {
    if (!supabase || typeof (supabase as any).channel !== 'function') return;

    const channel = (supabase as any)
      .channel('whatsapp-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload: any) => {
        const msg = payload.new;
        if (!msg) return;

        const ts = msg.created_at ? new Date(msg.created_at) : new Date();
        const formattedMsg: Message = {
          id: msg.provider_message_id || msg.id,
          text: msg.body || '',
          timestamp: ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          fromMe: msg.direction === 'outbound',
          status: 'read',
          type: msg.type || 'text'
        };

        const rawTs = Math.floor(ts.getTime() / 1000);
        const isOpenChat = selectedChatRef.current?.id === msg.chat_id;

        // Append to visible conversation (avoid duplicate from optimistic send)
        if (isOpenChat) {
          setMessages(prev => {
            if (prev.some(m => m.id === formattedMsg.id)) return prev;
            return [...prev, formattedMsg];
          });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }

        // Browser notification for inbound messages in background chats
        if (!isOpenChat && msg.direction === 'inbound' && 'Notification' in window && Notification.permission === 'granted') {
          const senderName = msg.sender_name || (msg.chat_id || '').replace('@c.us', '');
          new Notification(`WhatsApp: ${senderName}`, {
            body: (msg.body || '').slice(0, 100) || 'New message',
            icon: '/favicon.ico',
            tag: msg.chat_id
          });
        }

        // Update (or create) chat entry in the sidebar list, move it to top
        setChats(prev => {
          const existing = prev.find(c => c.id === msg.chat_id);
          const snippet = (msg.body || '').slice(0, 80);
          const updatedChat: Chat = existing
            ? {
                ...existing,
                lastMessage: snippet,
                timestamp: formatChatTimestamp(rawTs),
                rawTimestamp: rawTs,
                unread: isOpenChat ? 0 : existing.unread + (msg.direction === 'inbound' ? 1 : 0)
              }
            : {
                id: msg.chat_id,
                name: msg.sender_name || (msg.chat_id || '').replace('@c.us', '').replace('@s.whatsapp.net', ''),
                lastMessage: snippet,
                timestamp: formatChatTimestamp(rawTs),
                rawTimestamp: rawTs,
                unread: msg.direction === 'inbound' && !isOpenChat ? 1 : 0,
                assignedTo: 'Unassigned',
                phone: (msg.chat_id || '').replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@g.us', ''),
                status: 'active'
              };
          return [updatedChat, ...prev.filter(c => c.id !== msg.chat_id)];
        });
      })
      .subscribe();

    return () => { (supabase as any).removeChannel(channel); };
  }, []); // subscribe once on mount

  // Initial load
  useEffect(() => {
    checkStatus();
    checkWebhookStatus();
    loadChats();
    // Silently sync contact names from Evolution API once on mount
    // so @lid JIDs resolve to real names on next chat load
    fetch('/api/whatsapp?action=syncContactNames', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .catch(() => {}); // fire-and-forget, non-blocking
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

  // Load a single avatar (cached, no duplicate fetches)
  const loadAvatar = useCallback(async (chatId: string) => {
    if (fetchingAvatars.current.has(chatId)) return;
    fetchingAvatars.current.add(chatId);
    try {
      const r = await fetch(`/api/whatsapp?action=avatar&chatId=${encodeURIComponent(chatId)}`);
      const data = await r.json();
      if (data.available && data.url) {
        setAvatars(prev => ({ ...prev, [chatId]: data.url }));
      }
    } catch {}
  }, []);

  // Load avatars for top visible chats after chat list updates
  useEffect(() => {
    if (chats.length === 0) return;
    let i = 0;
    const ids = chats.slice(0, 15).map(c => c.id).filter(id => !fetchingAvatars.current.has(id));
    const timer = setInterval(() => {
      if (i >= ids.length) { clearInterval(timer); return; }
      loadAvatar(ids[i]);
      i++;
    }, 250);
    return () => clearInterval(timer);
  }, [chats, loadAvatar]);

  // Load avatar for selected chat immediately
  useEffect(() => {
    if (selectedChat) loadAvatar(selectedChat.id);
  }, [selectedChat, loadAvatar]);

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  // Message search
  const searchMessages = useCallback(async (q: string) => {
    if (q.length < 2) { setMsgSearchResults([]); return; }
    setSearchingMsgs(true);
    try {
      const r = await fetch(`/api/whatsapp?action=searchMessages&q=${encodeURIComponent(q)}`);
      const data = await r.json();
      if (data.success) setMsgSearchResults(data.results || []);
    } catch {}
    setSearchingMsgs(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchMessages(msgSearchQuery), 400);
    return () => clearTimeout(t);
  }, [msgSearchQuery, searchMessages]);

  // Unified search (contacts + chats + messages)
  const searchUnified = useCallback(async (q: string) => {
    if (q.length < 2) { setUnifiedSearchResults([]); return; }
    setUnifiedSearching(true);
    try {
      const r = await fetch(`/api/whatsapp?action=searchUnified&q=${encodeURIComponent(q)}&limit=30`);
      const data = await r.json();
      if (data.success) {
        setUnifiedSearchResults(data.results || []);
      }
    } catch (err) {
      console.error('Unified search error:', err);
      setUnifiedSearchResults([]);
    }
    setUnifiedSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchUnified(unifiedSearchQuery), 300);
    return () => clearTimeout(t);
  }, [unifiedSearchQuery, searchUnified]);

  // Handle unified search result selection
  const selectUnifiedResult = (result: any) => {
    if (result.type === 'chat') {
      const chat = chats.find(c => c.id === result.id);
      if (chat) {
        setSelectedChat(chat);
        setUnifiedSearchActive(false);
        setUnifiedSearchQuery('');
      }
    } else if (result.type === 'message') {
      const chat = chats.find(c => c.id === result.chatId);
      if (chat) {
        setSelectedChat(chat);
        setUnifiedSearchActive(false);
        setUnifiedSearchQuery('');
        // Optional: jump to message (future enhancement)
      }
    } else if (result.type === 'contact') {
      // Optional: open contact in CRM (future enhancement)
      console.log('Contact selected:', result);
    }
  };

  // Send file attachment
  const sendAttachment = async () => {
    if (!attachFile || !selectedChat) return;
    if (attachFile.size > 4 * 1024 * 1024) {
      alert('File too large — max 4 MB');
      return;
    }
    setSendingFile(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(attachFile);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const r = await fetch('/api/whatsapp?action=sendFile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: selectedChat.id,
            fileBase64: base64,
            fileName: attachFile.name,
            mimeType: attachFile.type,
            caption: attachCaption
          })
        });
        const data = await r.json();
        if (data.success) {
          const previewMsg: Message = {
            id: data.messageId || Date.now().toString(),
            text: attachCaption || `[File: ${attachFile.name}]`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            fromMe: true,
            status: 'sent',
            type: attachFile.type.startsWith('image/') ? 'imageMessage' : 'documentMessage',
            mediaUrl: URL.createObjectURL(attachFile)
          };
          setMessages(prev => [...prev, previewMsg]);
          setAttachFile(null);
          setAttachCaption('');
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } else {
          alert('Failed to send file: ' + (data.error || 'Unknown error'));
        }
        setSendingFile(false);
      };
    } catch {
      setSendingFile(false);
    }
  };

  // (messageCount/loadingCount removed — Green API quota tracking no longer needed)

  const filteredChats = chats.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().replace(/\D/g, '');
    const nameMatch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    // Strip non-digits from both sides so 8768412776 matches 18768412776
    const phoneMatch = q.length > 0 && c.phone.replace(/\D/g, '').includes(q);
    return nameMatch || phoneMatch;
  });

  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0);
  const totalChats = chats.length;
  const activeChats = chats.filter(c => c.status === 'active').length;
  const resolvedChats = chats.filter(c => c.status === 'resolved').length;

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
          { label: 'Resolved Today', value: resolvedChats, color: 'purple' },
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
        {(['inbox', 'stats', 'setup'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all capitalize ${
              activeTab === tab ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'inbox' && `Inbox${totalUnread > 0 ? ` (${totalUnread})` : ''}`}
            {tab === 'stats' && 'Stats'}
            {tab === 'setup' && 'Setup'}
          </button>
        ))}
      </div>

      {/* INBOX TAB */}
      {activeTab === 'inbox' && (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Disconnect banner */}
          {connected === false && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm">
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              <span><strong>Green API disconnected</strong> — check the business phone is on and connected to WiFi. Messages sent to your number are not being received.</span>
            </div>
          )}
          <div className="flex-1 flex gap-4 min-h-0" style={{ height: 'calc(100vh - 340px)' }}>
          {/* Chat List */}
          <div className="w-80 flex-shrink-0 flex flex-col bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-3 border-b border-gray-700/50 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search chats, messages, contacts..."
                  value={unifiedSearchActive ? unifiedSearchQuery : searchQuery}
                  onChange={e => {
                    if (unifiedSearchActive) {
                      setUnifiedSearchQuery(e.target.value);
                    } else {
                      setSearchQuery(e.target.value);
                    }
                  }}
                  onFocus={() => setUnifiedSearchActive(true)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                />
              </div>
              {/* Unified search results dropdown */}
              {unifiedSearchActive && unifiedSearchQuery.length >= 2 && (
                <div className="absolute left-3 right-3 top-14 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                  {unifiedSearching && (
                    <div className="p-3 text-gray-400 text-xs text-center">Searching...</div>
                  )}
                  {!unifiedSearching && unifiedSearchResults.length === 0 && (
                    <div className="p-3 text-gray-500 text-xs text-center">No results found</div>
                  )}
                  {!unifiedSearching && unifiedSearchResults.length > 0 && (
                    <div className="space-y-0">
                      {/* Group by type */}
                      {unifiedSearchResults.filter((r: any) => r.type === 'chat').length > 0 && (
                        <>
                          <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase bg-gray-800/50 sticky top-0">Chats</div>
                          {unifiedSearchResults.filter((r: any) => r.type === 'chat').map((r: any) => (
                            <button
                              key={r.id}
                              onClick={() => selectUnifiedResult(r)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-700 border-b border-gray-700/30 transition-colors text-sm"
                            >
                              <p className="text-gray-200 font-medium">{r.name}</p>
                              <p className="text-gray-500 text-[11px]">{r.status} • {r.assignedTo}</p>
                            </button>
                          ))}
                        </>
                      )}
                      {unifiedSearchResults.filter((r: any) => r.type === 'message').length > 0 && (
                        <>
                          <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase bg-gray-800/50 sticky top-0">Messages</div>
                          {unifiedSearchResults.filter((r: any) => r.type === 'message').slice(0, 5).map((r: any) => (
                            <button
                              key={r.id}
                              onClick={() => selectUnifiedResult(r)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-700 border-b border-gray-700/30 transition-colors text-sm"
                            >
                              <p className="text-gray-300 text-xs font-medium">{r.chatName}</p>
                              <p className="text-gray-500 text-[11px] truncate">{r.text}</p>
                              <p className="text-gray-600 text-[10px]">{r.timestamp}</p>
                            </button>
                          ))}
                        </>
                      )}
                      {unifiedSearchResults.filter((r: any) => r.type === 'contact').length > 0 && (
                        <>
                          <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase bg-gray-800/50 sticky top-0">Contacts</div>
                          {unifiedSearchResults.filter((r: any) => r.type === 'contact').slice(0, 3).map((r: any) => (
                            <button
                              key={r.id}
                              onClick={() => selectUnifiedResult(r)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-700 border-b border-gray-700/30 transition-colors text-sm"
                            >
                              <p className="text-gray-200 font-medium">{r.name}</p>
                              <p className="text-gray-500 text-[11px]">{r.company || r.phone}</p>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* Click outside to close search */}
              {unifiedSearchActive && (
                <button
                  onClick={() => {
                    setUnifiedSearchActive(false);
                    setUnifiedSearchQuery('');
                  }}
                  className="w-full text-xs text-gray-500 hover:text-gray-300 py-1 transition-colors"
                >
                  Close search
                </button>
              )}
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
                    onClick={() => {
                      setSelectedChat(chat);
                      // Clear unread badge locally
                      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c));
                      // Mark as read on the phone
                      fetch('/api/whatsapp?action=readChat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chatId: chat.id })
                      }).catch(() => {});
                    }}
                    className={`w-full p-3 text-left hover:bg-gray-700/40 transition-colors border-b border-gray-700/30 ${
                      selectedChat?.id === chat.id ? 'bg-green-600/20 border-l-2 border-l-green-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                        {avatars[chat.id]
                          ? <img src={`/api/whatsapp?action=mediaProxy&url=${encodeURIComponent(avatars[chat.id])}`} alt="" className="w-full h-full object-cover" />
                          : chat.name.charAt(0).toUpperCase()}
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
          </div> {/* end chat list */}

          {/* Message Area */}
          <div className="flex-1 flex flex-col bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden">
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {avatars[selectedChat.id]
                        ? <img src={`/api/whatsapp?action=mediaProxy&url=${encodeURIComponent(avatars[selectedChat.id])}`} alt="" className="w-full h-full object-cover" />
                        : selectedChat.name.charAt(0).toUpperCase()}
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
                        const nextStatus = selectedChat.status === 'resolved' ? 'active' : 'resolved';
                        setChats(prev => prev.map(c =>
                          c.id === selectedChat.id ? { ...c, status: nextStatus } : c
                        ));
                        setSelectedChat(prev => prev ? { ...prev, status: nextStatus } : null);
                        // Persist status to DB so it survives page refresh
                        updateChatStatus(selectedChat.id, nextStatus);
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
                  {/* Load More History button — always at top of message thread */}
                  {!loading && selectedChat && (
                    <div className="flex flex-col items-center gap-1 pb-2">
                      <button
                        onClick={() => loadMoreHistory(selectedChat.id)}
                        disabled={loadingMoreHistory}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-600/70 rounded-full border border-gray-600/40 hover:border-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingMoreHistory
                          ? <><RefreshCw className="w-3 h-3 animate-spin" /> Pulling history…</>
                          : <><RefreshCw className="w-3 h-3" /> Load more history</>
                        }
                      </button>
                      {moreHistoryResult && (
                        <span className="text-xs text-gray-400">{moreHistoryResult}</span>
                      )}
                    </div>
                  )}
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
                          {/* Inline image */}
                          {msg.mediaUrl && msg.type === 'imageMessage' && (
                            <img
                              src={`/api/whatsapp?action=mediaProxy&url=${encodeURIComponent(msg.mediaUrl)}`}
                              alt="Image"
                              className="max-w-full rounded-lg mb-1 cursor-pointer"
                              onClick={() => window.open(`/api/whatsapp?action=mediaProxy&url=${encodeURIComponent(msg.mediaUrl!)}`, '_blank')}
                            />
                          )}
                          {/* Audio player */}
                          {msg.mediaUrl && msg.type === 'audioMessage' && (
                            <div className="flex items-center gap-2 mb-1">
                              <Volume2 className="w-4 h-4 flex-shrink-0 opacity-70" />
                              <audio controls className="w-48 h-8" src={`/api/whatsapp?action=mediaProxy&url=${encodeURIComponent(msg.mediaUrl)}`} />
                            </div>
                          )}
                          {/* Document / video download */}
                          {msg.mediaUrl && (msg.type === 'documentMessage' || msg.type === 'videoMessage') && (
                            <a
                              href={`/api/whatsapp?action=mediaProxy&url=${encodeURIComponent(msg.mediaUrl)}`}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 mb-1 underline opacity-80 hover:opacity-100 text-xs"
                            >
                              {msg.type === 'videoMessage' ? <Download className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                              {msg.type === 'videoMessage' ? 'Download video' : 'Download document'}
                            </a>
                          )}
                          {/* Text / caption */}
                          {msg.text ? (
                            <p className="text-sm leading-relaxed">{msg.text}</p>
                          ) : !msg.mediaUrl ? (
                            <p className="text-sm leading-relaxed italic opacity-60">Media message</p>
                          ) : null}
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
                  {/* File attachment preview */}
                  {attachFile && (
                    <div className="mb-2 flex items-center gap-3 p-3 bg-gray-700/60 rounded-xl border border-gray-600/50">
                      <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{attachFile.name}</p>
                        <p className="text-gray-500 text-[10px]">{(attachFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <input
                        type="text"
                        value={attachCaption}
                        onChange={e => setAttachCaption(e.target.value)}
                        placeholder="Caption (optional)"
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-green-500"
                      />
                      <button onClick={() => { setAttachFile(null); setAttachCaption(''); }} className="text-gray-500 hover:text-red-400">
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={sendAttachment}
                        disabled={sendingFile}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                      >
                        {sendingFile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Send
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                    className="hidden"
                    onChange={e => { if (e.target.files?.[0]) setAttachFile(e.target.files[0]); e.target.value = ''; }}
                  />
                  <div className="flex items-end gap-2">
                    <button
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="p-2 text-gray-400 hover:text-amber-400 transition-colors"
                      title="Message templates"
                    >
                      <Tag className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                      title="Attach file"
                    >
                      <Paperclip className="w-5 h-5" />
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
          </div> {/* end inner flex row */}
        </div>
      )}

      {/* STATS TAB */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Total Messages Today', value: chats.reduce((s, c) => s + c.unread, 0).toString(), icon: MessageCircle, color: 'green' },
            { label: 'Active Conversations', value: activeChats.toString(), icon: Send, color: 'blue' },
            { label: 'Resolved Conversations', value: resolvedChats.toString(), icon: Phone, color: 'purple' },
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

          {/* Browser Notifications */}
          <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${
            notifPermission === 'granted' ? 'bg-green-500/10 border-green-500/30' :
            notifPermission === 'denied' ? 'bg-red-500/10 border-red-500/30' :
            'bg-gray-800/40 border-gray-700/50'
          }`}>
            <div className="flex items-center gap-3">
              {notifPermission === 'granted' ? <Bell className="w-5 h-5 text-green-400" /> : <BellOff className="w-5 h-5 text-gray-400" />}
              <div>
                <p className="text-white text-sm font-medium">
                  {notifPermission === 'granted' ? 'Desktop notifications enabled' :
                   notifPermission === 'denied' ? 'Notifications blocked by browser' :
                   'Enable desktop notifications'}
                </p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {notifPermission === 'granted' ? 'You will be alerted when new messages arrive in background tabs' :
                   notifPermission === 'denied' ? 'Allow in browser site settings, then refresh' :
                   'Get alerted instantly when customers message you'}
                </p>
              </div>
            </div>
            {notifPermission === 'default' && (
              <button
                onClick={requestNotifPermission}
                className="flex-shrink-0 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Enable
              </button>
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
