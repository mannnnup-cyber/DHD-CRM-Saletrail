import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Phone, Send, RefreshCw, CheckCheck, Check, Clock, User, Search, Tag, ChevronDown, Wifi, WifiOff, AlertCircle, Smile, Database, CheckCircle2, XCircle, Loader2, Plus, X, FileText, Download, Volume2, Paperclip, Bell, BellOff, ExternalLink, Image, Share2, Copy, Archive, CornerUpLeft, Info, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

// WhatsApp API is handled by backend /api/whatsapp (Evolution API / Baileys)
// This avoids CORS issues and keeps credentials secure

const formatChatTimestamp = (rawTimestamp: number | string): string => {
  if (!rawTimestamp) return '';
  // Accept unix seconds (number) OR ISO string
  const date = typeof rawTimestamp === 'string'
    ? new Date(rawTimestamp)
    : new Date(rawTimestamp * 1000);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Friendly label for message type previews in the chat list
const friendlyLastMessage = (text: string): string => {
  if (!text) return '';
  const map: Record<string, string> = {
    '[audioMessage]': '🎵 Voice note',
    '[pttMessage]': '🎤 Voice note',
    '[imageMessage]': '📷 Photo',
    '[videoMessage]': '🎥 Video',
    '[documentMessage]': '📄 Document',
    '[stickerMessage]': '🏷️ Sticker',
    '[reactionMessage]': '👍 Reaction',
    '[locationMessage]': '📍 Location',
    '[contactMessage]': '👤 Contact',
    '[conversation]': '',
    '[groupStatusMentionMessage]': '📢 Group update',
    '[secretEncryptedMessage]': '🔒 Encrypted message',
    '[pollCreationMessage]': '📊 Poll',
    '[pollCreationMessageV3]': '📊 Poll',
    '[buttonsMessage]': '🔘 Button message',
    '[listMessage]': '📋 List message',
    '[templateMessage]': '📝 Template',
    '[orderMessage]': '🛒 Order',
    '[productMessage]': '🛍️ Product',
    '[callLogMessage]': '📞 Call',
    '[protocolMessage]': '',
    '[senderKeyDistributionMessage]': '',
  };
  // If it matches [someType] pattern not in map, show generic label
  if (map[text] !== undefined) return map[text];
  if (/^\[.+\]$/.test(text)) return '📎 Attachment';
  return text;
};

// Format a message timestamp (unix seconds or ISO string) → "2:34 PM", "Yesterday 2:34 PM", "Jun 5, 2:34 PM"
const formatMessageTime = (ts: number | string): string => {
  if (!ts) return '';
  const date = typeof ts === 'number'
    ? new Date(ts > 1e10 ? ts : ts * 1000)
    : new Date(ts);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return timeStr;
  if (isYesterday) return `Yesterday ${timeStr}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
};

const UNASSIGNED = { id: 'all', name: 'Unassigned' };

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
  const [activeTab, setActiveTab] = useState<'inbox' | 'calls' | 'stats' | 'setup'>('inbox');
  const [chatFilter, setChatFilter] = useState<'all' | 'individual' | 'groups'>('all');
  const [allCalls, setAllCalls] = useState<any[]>([]);
  const [callingChatId, setCallingChatId] = useState<string | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<{ configured: boolean; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
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
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachCaption, setAttachCaption] = useState('');
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [moreHistoryResult, setMoreHistoryResult] = useState<string | null>(null);
  const [sendingFile, setSendingFile] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<any>(null);
  const [forwardingTo, setForwardingTo] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [msgReactions, setMsgReactions] = useState<Record<string, string>>({});
  const [configuringWebhook, setConfiguringWebhook] = useState(false);
  const [webhookConfigResult, setWebhookConfigResult] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([UNASSIGNED]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingWATarget = useRef<{ phone: string; name: string } | null>(null);

  const user = state.user;

  // Load team members from DB (replaces hardcoded array)
  useEffect(() => {
    fetch('/api/users?action=list')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.users?.length) {
          setTeamMembers([UNASSIGNED, ...d.users.map((u: any) => ({ id: u.id, name: u.name }))]);
        }
      })
      .catch(() => {});
  }, []);

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

  const [syncing2, setSyncing2] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Check connection status via backend API
  const checkStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp?action=status');
      const data = await r.json();
      if (data.success) {
        // null = unknown state (e.g. fresh DB wipe, can't reach Evolution API)
        // Don't show red banner for unknown — only for definite false
        if (data.connected === true) setConnected(true);
        else if (data.connected === false) setConnected(false);
        else setConnected(null); // unknown → keep checking spinner, no red banner
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(null); // network error → unknown, not disconnected
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

  // Load chats from backend API (database-backed, Evolution API)
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

          const formatted: Chat[] = data.chats.slice(0, 500).map((chat: any) => {
            const rawId: string = chat.id || '';
            const isLid = rawId.includes('@lid');
            const isGroup = rawId.includes('@g.us');
            const rawName: string = chat.name || '';
            const isNumericOnly = /^\d+$/.test(rawName.trim());
            // Extract phone from chat ID (before @suffix) for fallback
            const phoneFromId = rawId.includes('@') ? rawId.split('@')[0] : rawId;
            const displayName = rawName && !isNumericOnly
              ? rawName
              : isGroup ? 'Group Chat' : phoneFromId; // show phone instead of "Unknown contact"
            return ({
            id: rawId,
            name: displayName,
            lastMessage: friendlyLastMessage(chat.lastMessage || ''),
            // Format timestamp from either unix seconds or ISO string
            timestamp: chat.rawTimestamp
              ? formatChatTimestamp(chat.rawTimestamp)
              : chat.timestamp
                ? formatChatTimestamp(chat.timestamp)  // handles ISO string now
                : '',
            rawTimestamp: chat.rawTimestamp || 0,
            unread: chat.unread || 0,
            assignedTo: chat.assignedTo || 'Unassigned',
            // @lid = WhatsApp linked device ID (not a phone number) — show blank
            // @s.whatsapp.net = real phone number — extract digits before @
            phone: chat.id?.includes('@lid') ? '' : (chat.phone || chat.id?.split('@')[0] || ''),
            status: (chat.status || 'active') as 'active' | 'resolved' | 'pending'
          });});
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
        // API returns normalized DB records: { id, text, timestamp (unix secs), fromMe, type, mediaUrl }
        const formatted: Message[] = data.messages.map((msg: any) => ({
          id: msg.id,
          text: msg.text || '',
          timestamp: msg.timestamp || 0,
          fromMe: msg.fromMe === true,
          status: 'read' as const,
          type: msg.type || 'text',
          mediaUrl: msg.mediaUrl || undefined
        }));

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

    // Also load calls for this chat
    const loadCallsForChat = async () => {
      try {
        const callRes = await fetch(`/api/whatsapp?action=getCalls&chatId=${encodeURIComponent(chatId)}&limit=20`);
        const callData = await callRes.json();
        if (callData.success && callData.calls) {
          setCalls(callData.calls);
        }
      } catch (err) {
        console.error('Error loading calls:', err);
      }
    };
    loadCallsForChat();
  }, []);

  // Sync missed messages from Evolution API (catches webhooks that were missed)
  // Defined AFTER loadChats and loadMessages to avoid temporal dead zone (TDZ) error
  const syncNow = useCallback(async () => {
    setSyncing2(true);
    setSyncResult(null);
    try {
      const r = await fetch('/api/whatsapp?action=syncEvolutionMessages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 30 }) // sync top 30 most recent chats
      });
      const data = await r.json();
      if (data.success) {
        setSyncResult(`✓ Synced ${data.count ?? 0} messages from ${data.chatsProcessed ?? 0} chats`);
        // Clear message cache and reload
        chatMessagesCache.current = {};
        await loadChats();
        if (selectedChatRef.current) {
          await loadMessages(selectedChatRef.current.id);
        }
      } else {
        setSyncResult(`✗ Sync failed: ${data.error}`);
      }
    } catch (err: any) {
      setSyncResult(`✗ ${err.message}`);
    }
    setSyncing2(false);
    setTimeout(() => setSyncResult(null), 5000);
  }, [loadChats, loadMessages]);

  // Load all calls from all chats
  const loadAllCalls = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp?action=getAllCalls&limit=500');
      const data = await res.json();
      if (data.success && data.calls) {
        setAllCalls(data.calls);
      }
    } catch (err) {
      console.error('Error loading all calls:', err);
    }
  }, []);

  // Auto-configure Evolution API webhook with all required events (including CALL)
  const autoConfigureWebhook = useCallback(async () => {
    setConfiguringWebhook(true);
    setWebhookConfigResult(null);
    try {
      const webhookUrl = `${window.location.origin}/api/whatsapp`;
      const res = await fetch('/api/whatsapp?action=setWebhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl })
      });
      const data = await res.json();
      if (data.success) {
        setWebhookConfigResult('✓ Webhook configured! MESSAGES_UPSERT, CONNECTION_UPDATE, and CALL events are now enabled.');
        setWebhookStatus({ configured: true, url: webhookUrl });
      } else {
        setWebhookConfigResult(`✗ ${data.error || 'Failed to configure webhook'}`);
      }
    } catch (err: any) {
      setWebhookConfigResult(`✗ ${err.message}`);
    }
    setConfiguringWebhook(false);
    setTimeout(() => setWebhookConfigResult(null), 8000);
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
        const msg = data.count > 0
          ? `✓ Pulled ${data.count} messages for this chat`
          : `✓ Already up to date — no new messages found`;
        setMoreHistoryResult(msg);
        setSyncResult(msg); // also show in the always-visible sidebar toast
        // Bust the cache and reload messages
        delete chatMessagesCache.current[chatId];
        await loadMessages(chatId);
      } else {
        const err = `✗ ${data.error || 'Failed to pull history'}`;
        setMoreHistoryResult(err);
        setSyncResult(err);
      }
    } catch (err) {
      const msg = '✗ Network error pulling history';
      setMoreHistoryResult(msg);
      setSyncResult(msg);
    }
    setLoadingMoreHistory(false);
    // Clear the result label after 5 seconds
    setTimeout(() => { setMoreHistoryResult(null); setSyncResult(null); }, 5000);
  }, [loadingMoreHistory, loadMessages]);

  // Send message via backend API
  const sendMessage = async () => {
    if (!replyText.trim() || !selectedChat) return;
    setSending(true);
    const text = replyText;
    const quotedMsg = replyingTo;
    setReplyText('');
    setReplyingTo(null);

    const newMsg: Message = {
      id: Date.now().toString(),
      text,
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: true,
      status: 'sent',
      type: 'text',
      ...(quotedMsg ? { quotedText: quotedMsg.text || '[media]', quotedAuthor: quotedMsg.fromMe ? 'You' : selectedChat.name } : {})
    } as any;
    setMessages(prev => [...prev, newMsg]);

    try {
      const r = await fetch('/api/whatsapp?action=send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: selectedChat.id,
          message: text,
          ...(quotedMsg ? { quotedMessageId: quotedMsg.id, quotedText: quotedMsg.text } : {})
        })
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

  // Initiate a call — opens native phone dialer since WhatsApp API doesn't support outbound calls
  const initiateCall = async (chatId: string, isVideo?: boolean) => {
    // Extract phone number from chatId (e.g. "18765551234@s.whatsapp.net" → "18765551234")
    const phone = chatId.replace(/@[a-z.]+$/, '');

    // Show calling overlay for UX, then open phone dialer
    setCallingChatId(chatId);
    setCallTimer(0);

    // Start timer
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallTimer(prev => prev + 1);
    }, 1000);

    // Open phone dialer — works on mobile and some desktop setups
    if (phone) {
      window.open(`tel:+${phone}`, '_self');
    }
  };

  // End the current call
  const endCall = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallingChatId(null);
    setCallTimer(0);
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
        const rawTs = Math.floor(ts.getTime() / 1000);
        const formattedMsg: Message = {
          id: msg.provider_message_id || msg.id,
          text: msg.body || '',
          timestamp: rawTs,
          fromMe: msg.direction === 'outbound',
          status: 'read',
          type: msg.message_type || msg.type || 'text',
          mediaUrl: msg.media_url || undefined
        };

        const isOpenChat = selectedChatRef.current?.id === msg.chat_id;

        // Append to visible conversation
        // - Skip if same provider_message_id already exists (exact dup)
        // - Replace optimistic message (Date.now() id) if body+direction match
        if (isOpenChat) {
          setMessages(prev => {
            if (prev.some(m => m.id === formattedMsg.id)) return prev;
            // Replace matching optimistic message (sent from this session)
            const optimisticIdx = formattedMsg.fromMe
              ? prev.findIndex(m => m.text === formattedMsg.text && m.fromMe && m.status === 'sent')
              : -1;
            if (optimisticIdx !== -1) {
              const next = [...prev];
              next[optimisticIdx] = formattedMsg;
              return next;
            }
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
          const rawSnippet = (msg.body || '').slice(0, 80);
          const snippet = friendlyLastMessage(rawSnippet);
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

  // Poll chat LIST every 30 seconds to surface new conversations (quiet — no cache clear)
  // New messages inside open chats arrive via Supabase real-time subscription, not polling
  useEffect(() => {
    const interval = setInterval(() => {
      loadChats(); // updates unread counts & new chat entries without clearing message cache
    }, 30000);
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

  // Avatar loading disabled — Evolution API avatar endpoint not supported (returns 400)
  // Chats fall back to initials display which is already implemented

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

  // Toggle chat selection for bulk actions
  const toggleChatSelection = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelection = new Set(selectedChatIds);
    if (newSelection.has(chatId)) {
      newSelection.delete(chatId);
    } else {
      newSelection.add(chatId);
    }
    setSelectedChatIds(newSelection);
  };

  // Select all visible chats
  const selectAllChats = () => {
    if (selectedChatIds.size === filteredChats.length) {
      setSelectedChatIds(new Set());
    } else {
      setSelectedChatIds(new Set(filteredChats.map(c => c.id)));
    }
  };

  // Bulk update chats (resolve, assign, etc.)
  const bulkUpdateChats = async (updates: { status?: string; assignedTo?: string }) => {
    if (selectedChatIds.size === 0) return;
    setBulkActionInProgress(true);

    try {
      const res = await fetch('/api/whatsapp?action=bulkUpdateChats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatIds: Array.from(selectedChatIds),
          ...updates
        })
      });

      const data = await res.json();
      if (data.success) {
        // Update local state
        setChats(prev => prev.map(chat => {
          if (selectedChatIds.has(chat.id)) {
            return {
              ...chat,
              ...(updates.status && { status: updates.status }),
              ...(updates.assignedTo && { assignedTo: updates.assignedTo })
            };
          }
          return chat;
        }));
        setSelectedChatIds(new Set());
        alert(`✅ Updated ${selectedChatIds.size} chats`);
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Bulk update error:', err);
      alert('❌ Network error');
    }

    setBulkActionInProgress(false);
  };

  // Handle unified search result selection
  const selectUnifiedResult = (result: any) => {
    setUnifiedSearchActive(false);
    setUnifiedSearchQuery('');
    if (result.type === 'chat') {
      const chat = chats.find(c => c.id === result.id);
      if (chat) {
        setSelectedChat(chat);
      } else {
        // Fallback: construct chat from search result when IDs don't match in memory
        setSelectedChat({
          id: result.id,
          name: result.name || result.id,
          lastMessage: '',
          timestamp: '',
          rawTimestamp: 0,
          unread: 0,
          assignedTo: result.assignedTo || 'Unassigned',
          phone: result.phone || result.id.replace(/@[a-z.]+$/, ''),
          status: (result.status || 'active') as 'active' | 'resolved' | 'pending'
        });
      }
    } else if (result.type === 'message') {
      const chat = chats.find(c => c.id === result.chatId);
      if (chat) {
        setSelectedChat(chat);
      } else {
        setSelectedChat({
          id: result.chatId,
          name: result.chatName || result.chatId,
          lastMessage: result.text || '',
          timestamp: '',
          rawTimestamp: 0,
          unread: 0,
          assignedTo: 'Unassigned',
          phone: result.chatId.replace(/@[a-z.]+$/, ''),
          status: 'active' as 'active' | 'resolved' | 'pending'
        });
      }
    }
  };

  // Forward a message to a chosen chat
  const forwardMessage = async (targetChatId: string) => {
    if (!forwardMsg) return;
    setForwardingTo(targetChatId);
    try {
      await fetch('/api/whatsapp?action=send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: targetChatId, message: forwardMsg.text || '' })
      });
      setForwardMsg(null);
    } catch {}
    setForwardingTo(null);
  };

  // Send emoji reaction to a message
  const sendReaction = async (msgId: string, fromMe: boolean, emoji: string) => {
    if (!selectedChat) return;
    setEmojiPickerMsgId(null);
    setMsgReactions(prev => ({ ...prev, [msgId]: emoji }));
    try {
      await fetch('/api/whatsapp?action=sendReaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: selectedChat.id, messageId: msgId, fromMe, reaction: emoji })
      });
    } catch {}
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
    const isGroup = c.id.includes('@g.us');
    if (chatFilter === 'groups' && !isGroup) return false;
    if (chatFilter === 'individual' && isGroup) return false;
    // Show archived chats only in archive view; hide them in main inbox
    if (showArchived && (c as any).status !== 'archived') return false;
    if (!showArchived && (c as any).status === 'archived') return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().replace(/\D/g, '');
    const nameMatch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = q.length > 0 && (c.phone || '').replace(/\D/g, '').includes(q);
    return nameMatch || phoneMatch;
  });

  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0);
  const totalChats = chats.length;
  const activeChats = chats.filter(c => c.status === 'active').length;
  const resolvedChats = chats.filter(c => c.status === 'resolved').length;

  // Calculate call metrics
  const totalCalls = allCalls.length;
  const missedCalls = allCalls.filter(c => c.status === 'missed').length;
  const missedCallRate = totalCalls > 0 ? Math.round((missedCalls / totalCalls) * 100) : 0;
  const totalDuration = allCalls.reduce((sum, c) => sum + (c.duration || 0), 0);
  const avgCallDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
  const todaysCalls = allCalls.filter(c => new Date(c.timestamp).toDateString() === new Date().toDateString());
  const todaysMissedCalls = todaysCalls.filter(c => c.status === 'missed').length;

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
            onClick={() => { checkStatus(); checkWebhookStatus(); loadChats(); syncNow(); }}
            disabled={syncing || syncing2}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
            title="Refresh from database + pull latest from Evolution API"
          >
            <RefreshCw className={`w-4 h-4 ${(syncing || syncing2) ? 'animate-spin' : ''}`} />
            {syncing2 ? 'Syncing...' : 'Refresh'}
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

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800/40 rounded-xl p-1">
        {(['inbox', 'calls', 'stats', 'setup'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'calls' || tab === 'stats') loadAllCalls();
            }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all capitalize ${
              activeTab === tab ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'inbox' && `Inbox${totalUnread > 0 ? ` (${totalUnread})` : ''}`}
            {tab === 'calls' && 'Calls'}
            {tab === 'stats' && 'Stats'}
            {tab === 'setup' && 'Setup'}
          </button>
        ))}
      </div>

      {/* Sync result toast */}
      {syncResult && (
        <div className={`mx-2 flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
          syncResult.startsWith('✓') ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
        }`}>
          {syncResult}
        </div>
      )}

      {/* INBOX TAB */}
      {activeTab === 'inbox' && (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Disconnect banner */}
          {connected === false && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm">
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              <span><strong>WhatsApp disconnected</strong> — check that your Evolution API instance is running and the business phone is linked. Messages sent to your number are not being received.</span>
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

            {/* Chat type filter: All / Individual / Groups */}
            <div className="flex border-b border-gray-700/50">
              {(['all', 'individual', 'groups'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setChatFilter(f)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    chatFilter === f
                      ? 'text-green-400 border-b-2 border-green-400 bg-green-500/5'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'individual' ? '👤 People' : '👥 Groups'}
                </button>
              ))}
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedChatIds.size > 0 && (
              <div className="p-2 bg-blue-900/30 border-t border-blue-700/50 space-y-2">
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs text-blue-400 font-semibold">
                    {selectedChatIds.size} selected
                  </span>
                  <button
                    onClick={() => setSelectedChatIds(new Set())}
                    className="text-xs px-2 py-1 text-gray-400 hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <button
                    onClick={() => bulkUpdateChats({ status: 'resolved' })}
                    disabled={bulkActionInProgress}
                    className="flex-1 text-xs px-2 py-1.5 bg-green-600/50 hover:bg-green-600 text-green-100 rounded transition-colors disabled:opacity-50"
                  >
                    Mark Resolved
                  </button>
                  <button
                    onClick={() => bulkUpdateChats({ status: 'pending' })}
                    disabled={bulkActionInProgress}
                    className="flex-1 text-xs px-2 py-1.5 bg-yellow-600/50 hover:bg-yellow-600 text-yellow-100 rounded transition-colors disabled:opacity-50"
                  >
                    Mark Pending
                  </button>
                  <button
                    onClick={() => {
                      const assignTo = prompt('Assign to (team member name):', 'Sarah');
                      if (assignTo) bulkUpdateChats({ assignedTo: assignTo });
                    }}
                    disabled={bulkActionInProgress}
                    className="flex-1 text-xs px-2 py-1.5 bg-blue-600/50 hover:bg-blue-600 text-blue-100 rounded transition-colors disabled:opacity-50"
                  >
                    Assign to...
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {/* Select All / Bulk Selection Header */}
              {filteredChats.length > 1 && (
                <div className="p-2 border-b border-gray-700/30 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedChatIds.size === filteredChats.length && filteredChats.length > 0}
                    onChange={selectAllChats}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-xs text-gray-500">
                    {selectedChatIds.size > 0 ? `${selectedChatIds.size} selected` : 'Select all'}
                  </span>
                </div>
              )}

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
                      {/* Checkbox for bulk selection */}
                      <input
                        type="checkbox"
                        checked={selectedChatIds.has(chat.id)}
                        onChange={(e) => toggleChatSelection(chat.id, e as any)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded cursor-pointer mt-1 flex-shrink-0"
                      />
                      <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                        {avatars[chat.id]
                          ? <img src={`/api/whatsapp?action=mediaProxy&url=${encodeURIComponent(avatars[chat.id])}`} alt="" className="w-full h-full object-cover" />
                          : chat.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-white text-sm font-medium truncate">{chat.name}</span>
                          {chat.id.includes('@g.us') && (
                            <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded px-1 flex-shrink-0">GROUP</span>
                          )}
                          <span className="text-gray-500 text-[10px] flex-shrink-0 ml-2">{chat.timestamp}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-gray-400 text-xs truncate">{friendlyLastMessage(chat.lastMessage)}</p>
                          {chat.unread > 0 && (
                            <span className="ml-2 flex-shrink-0 bg-green-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                              {chat.unread}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                            chat.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            chat.status === 'resolved' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            <span>{chat.status === 'active' ? '🟢' : chat.status === 'resolved' ? '⏸' : '⚠️'}</span>
                            <span>{chat.status}</span>
                          </span>
                          {chat.assignedTo && chat.assignedTo !== 'Unassigned' && (
                            <span className="inline-flex items-center text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">
                              👤 {chat.assignedTo}
                            </span>
                          )}
                          {(!chat.assignedTo || chat.assignedTo === 'Unassigned') && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-600/20 text-gray-500">
                              Unassigned
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Archived toggle */}
            <button
              onClick={() => { setShowArchived(v => !v); setSelectedChat(null); }}
              className="flex items-center gap-2 px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300 border-t border-gray-700/40 transition-colors w-full"
            >
              <Archive className="w-3.5 h-3.5" />
              {showArchived ? 'Back to Inbox' : `Archived (${chats.filter(c => (c as any).status === 'archived').length})`}
            </button>
          </div> {/* end chat list */}

          {/* Message Area */}
          <div className="flex-1 flex flex-col bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden">
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
                  <button className="flex items-center gap-3 hover:bg-gray-700/30 rounded-lg px-2 py-1 -ml-2 transition-colors" onClick={() => setShowContactInfo(v => !v)} title="View contact info">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {avatars[selectedChat.id]
                        ? <img src={`/api/whatsapp?action=mediaProxy&url=${encodeURIComponent(avatars[selectedChat.id])}`} alt="" className="w-full h-full object-cover" />
                        : selectedChat.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="text-white font-medium flex items-center gap-1">{selectedChat.name}<ChevronRight className="w-3 h-3 text-gray-500" /></p>
                      <p className="text-gray-400 text-xs">{selectedChat.phone ? `+${selectedChat.phone}` : selectedChat.id?.split('@')[0] || ''}</p>
                    </div>
                  </button>
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
                      onClick={() => initiateCall(selectedChat.id, false)}
                      disabled={callingChatId !== null}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600/30 hover:bg-green-600/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs text-green-400 hover:text-green-300 transition-colors"
                      title="Make WhatsApp call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Call
                    </button>
                    <button
                      onClick={() => setShowMediaGallery(v => !v)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${showMediaGallery ? 'bg-purple-600/50 text-purple-300' : 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 hover:text-purple-300'}`}
                      title="Media gallery"
                    >
                      <Image className="w-3.5 h-3.5" />
                      Media
                    </button>
                    <button
                      onClick={() => {
                        const phone = (selectedChat.phone || selectedChat.id?.split('@')[0] || '').replace(/\D/g, '');
                        if (phone) localStorage.setItem('contacts_search', phone);
                        window.location.hash = '#/contacts';
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 rounded-lg text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      title="Find in CRM contacts"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Contact
                    </button>
                    <button
                      onClick={() => {
                        const nextStatus = selectedChat.status === 'resolved' ? 'active' : 'resolved';
                        setChats(prev => prev.map(c =>
                          c.id === selectedChat.id ? { ...c, status: nextStatus } : c
                        ));
                        setSelectedChat(prev => prev ? { ...prev, status: nextStatus } : null);
                        updateChatStatus(selectedChat.id, nextStatus);
                        if (nextStatus === 'resolved') setSelectedChat(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedChat.status === 'resolved'
                          ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                          : 'bg-green-600/30 text-green-400 hover:bg-green-600/50'
                      }`}
                      title={selectedChat.status === 'resolved' ? 'Move back to active inbox' : 'Mark done — removes from active inbox, keeps full history'}
                    >
                      {selectedChat.status === 'resolved' ? 'Reopen' : 'Resolve'}
                    </button>
                    <button
                      onClick={() => {
                        updateChatStatus(selectedChat.id, 'archived' as any);
                        setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, status: 'archived' as any } : c));
                        setSelectedChat(null);
                      }}
                      className="p-1.5 bg-gray-700/50 hover:bg-gray-600 text-gray-400 hover:text-white rounded-lg transition-colors"
                      title="Archive — hides from inbox, accessible via Archived link"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={`https://wa.me/${(selectedChat.phone || '').replace(/\D/g,'')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-gray-700/50 hover:bg-gray-600 text-gray-400 hover:text-white rounded-lg transition-colors"
                      title="Open on phone — launches WhatsApp app directly to this contact"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Media Gallery Panel */}
                {showMediaGallery && (
                  <div className="border-b border-gray-700/50 bg-gray-900/60">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/30">
                      <p className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Shared Media</p>
                      <button onClick={() => setShowMediaGallery(false)} className="text-gray-500 hover:text-white text-xs">Close</button>
                    </div>
                    {(() => {
                      const mediaMessages = messages.filter((m: any) =>
                        m.type === 'imageMessage' || m.type === 'videoMessage'
                      );
                      if (mediaMessages.length === 0) {
                        return <p className="text-gray-500 text-xs text-center py-6">No shared images or videos yet</p>;
                      }
                      return (
                        <div className="grid grid-cols-4 gap-1 p-2 max-h-48 overflow-y-auto">
                          {mediaMessages.map((m: any) => {
                            const proxyUrl = m.mediaUrl?.startsWith('blob:')
                              ? m.mediaUrl
                              : m.mediaUrl?.startsWith('http')
                                ? `/api/whatsapp?action=mediaProxy&url=${encodeURIComponent(m.mediaUrl)}`
                                : `/api/whatsapp?action=mediaProxy&msgId=${encodeURIComponent(m.id)}`;
                            return (
                              <button
                                key={m.id}
                                onClick={() => { setLightboxUrl(proxyUrl); }}
                                className="aspect-square rounded overflow-hidden bg-gray-800 hover:ring-2 hover:ring-purple-500 transition-all relative group"
                              >
                                {m.type === 'videoMessage' ? (
                                  <div className="w-full h-full flex items-center justify-center bg-gray-700">
                                    <span className="text-2xl">▶</span>
                                  </div>
                                ) : (
                                  <img src={proxyUrl} alt="" className="w-full h-full object-cover" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

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
                    (() => {
                      // Merge messages and calls into unified timeline
                      const timeline = [
                        ...messages.map((msg: any) => ({ ...msg, _type: 'message' })),
                        ...calls.map((call: any) => ({ ...call, _type: 'call' }))
                      ].sort((a, b) => {
                        const timeA = new Date(a.timestamp).getTime();
                        const timeB = new Date(b.timestamp).getTime();
                        return timeA - timeB;
                      });

                      return timeline.map(item => {
                        if (item._type === 'message') {
                          const msg = item as any;
                          return (
                            <div key={msg.id} className={`flex items-end gap-1 group ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                              {/* Hover actions — left side for incoming */}
                              {!msg.fromMe && (
                                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mb-1 flex-shrink-0">
                                  <button onClick={() => setReplyingTo(msg)} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-600 rounded-lg" title="Reply"><CornerUpLeft className="w-3 h-3" /></button>
                                  <button onClick={() => setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-600 rounded-lg" title="React"><Smile className="w-3 h-3" /></button>
                                  {msg.text && <button onClick={() => navigator.clipboard?.writeText(msg.text)} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-600 rounded-lg" title="Copy"><Copy className="w-3 h-3" /></button>}
                                  <button onClick={() => setForwardMsg(msg)} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-600 rounded-lg" title="Forward"><Share2 className="w-3 h-3" /></button>
                                </div>
                              )}
                        <div className={`max-w-xs lg:max-w-md rounded-2xl ${
                          msg.fromMe
                            ? 'bg-green-600 text-white rounded-br-sm'
                            : 'bg-gray-700 text-gray-100 rounded-bl-sm'
                        }`}>
                          {/* Quoted reply preview */}
                          {msg.quotedText && (
                            <div className={`mx-3 mt-2.5 px-2 py-1.5 rounded-lg border-l-2 text-xs opacity-80 ${msg.fromMe ? 'bg-green-700/50 border-white/40' : 'bg-gray-600/50 border-green-400'}`}>
                              <p className="font-medium mb-0.5">{msg.quotedAuthor || (msg.fromMe ? 'You' : selectedChat?.name)}</p>
                              <p className="truncate">{msg.quotedText}</p>
                            </div>
                          )}
                          <div className="px-4 py-2.5">
                          {/* ── Media rendering ─────────────────────────────────────
                               WhatsApp CDN URLs are encrypted and can't be shown directly.
                               We use Evolution API's /chat/getBase64FromMediaMessage endpoint
                               (via mediaProxy?msgId=) to decode them server-side.
                               Falls back to direct URL proxy if the message ID looks like a UUID. */}
                          {(() => {
                            const isMediaType = (t: string) =>
                              ['imageMessage','videoMessage','audioMessage','pttMessage','documentMessage','stickerMessage']
                                .some(m => t === m || t?.includes(m.replace('Message','')));
                            if (!isMediaType(msg.type || '')) return null;
                            // blob: URLs are local object URLs — use directly (server can't fetch them)
                            // http URLs from Evolution API need the server-side proxy for auth headers
                            // Fallback to msgId-based fetch for messages without a mediaUrl
                            const proxyUrl = msg.mediaUrl?.startsWith('blob:')
                              ? msg.mediaUrl
                              : msg.mediaUrl?.startsWith('http')
                                ? `/api/whatsapp?action=mediaProxy&url=${encodeURIComponent(msg.mediaUrl)}`
                                : `/api/whatsapp?action=mediaProxy&msgId=${encodeURIComponent(msg.id)}`;
                            const isImage = msg.type === 'imageMessage' || msg.type?.includes('image');
                            const isAudio = msg.type === 'audioMessage' || msg.type === 'pttMessage' || msg.type?.includes('audio');
                            const isVideo = msg.type === 'videoMessage' || msg.type?.includes('video');
                            const isDoc   = msg.type === 'documentMessage' || msg.type?.includes('document');
                            return (
                              <>
                                {isImage && (
                                  <img
                                    src={proxyUrl}
                                    alt="Image"
                                    className="max-w-full rounded-lg mb-1 cursor-pointer"
                                    onClick={() => setLightboxUrl(proxyUrl)}
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                )}
                                {isAudio && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <Volume2 className="w-4 h-4 flex-shrink-0 opacity-70" />
                                    <audio controls className="w-48 h-8" src={proxyUrl} />
                                  </div>
                                )}
                                {isVideo && (
                                  <video controls className="max-w-full rounded-lg mb-1 max-h-48" src={proxyUrl} />
                                )}
                                {isDoc && (
                                  <a
                                    href={proxyUrl}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 mb-1 underline opacity-80 hover:opacity-100 text-xs"
                                  >
                                    <FileText className="w-4 h-4" />
                                    Download document
                                  </a>
                                )}
                              </>
                            );
                          })()}
                          {/* Text / caption — hide raw type placeholders and [File: ...] when media is shown */}
                          {(() => {
                            const hasMedia = msg.mediaUrl && ['imageMessage','videoMessage','audioMessage','pttMessage','documentMessage','stickerMessage'].some(t => msg.type === t || msg.type?.includes(t.replace('Message','')));
                            const isPlaceholder = !msg.text || msg.text.match(/^\[.+Message\]$|^\[conversation\]$|^\[File:.+\]$|^\[.+\]$/);
                            if (isPlaceholder && hasMedia) return null;
                            if (isPlaceholder) return (
                              <p className="text-sm leading-relaxed italic opacity-60">
                                {friendlyLastMessage(msg.text || '') || 'Media message'}
                              </p>
                            );
                            return <p className="text-sm leading-relaxed">{msg.text}</p>;
                          })()}
                          <div className={`flex items-center gap-1 mt-1 ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[10px] opacity-70" title={msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}>{formatMessageTime(msg.timestamp)}</span>
                            {msg.fromMe && (
                              msg.status === 'read' ? <CheckCheck className="w-3 h-3 text-blue-300" title="Read" /> :
                              msg.status === 'delivered' ? <CheckCheck className="w-3 h-3 opacity-70" title="Delivered" /> :
                              <Check className="w-3 h-3 opacity-70" title="Sent" />
                            )}
                          </div>
                          </div>{/* end inner padding */}
                          {/* Reactions display */}
                          {msgReactions[msg.id] && (
                            <div className={`flex px-3 pb-2 ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-base bg-gray-800/60 rounded-full px-1.5 py-0.5 border border-gray-600/40">{msgReactions[msg.id]}</span>
                            </div>
                          )}
                          {/* Emoji picker */}
                          {emojiPickerMsgId === msg.id && (
                            <div className={`flex gap-1 px-3 pb-2 ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                              {['👍','❤️','😂','😮','😢','🙏','🔥','✅'].map(e => (
                                <button key={e} onClick={() => sendReaction(msg.id, msg.fromMe, e)} className="text-lg hover:scale-125 transition-transform">{e}</button>
                              ))}
                            </div>
                          )}
                        </div>
                              {/* Hover actions — right side for outgoing */}
                              {msg.fromMe && (
                                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mb-1 flex-shrink-0">
                                  <button onClick={() => setReplyingTo(msg)} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-600 rounded-lg" title="Reply"><CornerUpLeft className="w-3 h-3" /></button>
                                  <button onClick={() => setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-600 rounded-lg" title="React"><Smile className="w-3 h-3" /></button>
                                  {msg.text && <button onClick={() => navigator.clipboard?.writeText(msg.text)} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-600 rounded-lg" title="Copy"><Copy className="w-3 h-3" /></button>}
                                  <button onClick={() => setForwardMsg(msg)} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-600 rounded-lg" title="Forward"><Share2 className="w-3 h-3" /></button>
                                </div>
                              )}
                            </div>
                            );
                        } else if (item._type === 'call') {
                          const call = item as any;
                          const callStatusColor = call.status === 'answered' ? 'green' : call.status === 'missed' ? 'red' : 'gray';
                          const callStatusEmoji = call.status === 'answered' ? '☎️' : call.status === 'missed' ? '📞' : '🚫';
                          const callTypeText = call.callType === 'video' ? 'Video call' : 'Voice call';
                          const durationText = call.duration ? `${call.duration}s` : 'no duration';

                          return (
                            <div key={call.id} className="flex justify-center my-2">
                              <div className={`text-xs px-3 py-2 rounded-full bg-${callStatusColor}-500/20 text-${callStatusColor}-400 border border-${callStatusColor}-500/30 flex items-center gap-2`}>
                                <span>{callStatusEmoji}</span>
                                <span>{call.status === 'answered' ? 'Received' : 'Missed'} {callTypeText} - {durationText}</span>
                                <span className="text-[10px] opacity-70">{formatMessageTime(call.timestamp)}</span>
                              </div>
                            </div>
                          );
                        }
                      });
                    })()
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
                  {/* Reply preview bar */}
                  {replyingTo && (
                    <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-gray-700/60 rounded-xl border-l-2 border-green-500">
                      <CornerUpLeft className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-green-400 text-[10px] font-semibold mb-0.5">{replyingTo.fromMe ? 'You' : selectedChat?.name}</p>
                        <p className="text-gray-300 text-xs truncate">{replyingTo.text || '[media]'}</p>
                      </div>
                      <button onClick={() => setReplyingTo(null)} className="text-gray-500 hover:text-white flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
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
                      onPaste={e => { const img = Array.from(e.clipboardData?.items||[]).find((i:any)=>i.type.startsWith("image/")); if(img){e.preventDefault();const f=(img as any).getAsFile();if(f)setAttachFile(f);} }}
                      placeholder="Type a message or paste an image... (Enter to send)"
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

      {/* CALLS TAB */}
      {activeTab === 'calls' && (
        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
          <div className="space-y-2">
            {allCalls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-center px-6">
                <Phone className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-white font-medium mb-1">No call logs yet</p>
                <p className="text-sm text-gray-500 mb-4">
                  Calls appear here when customers call your WhatsApp Business number
                  and Evolution API sends the call webhook event.
                </p>
                <div className="bg-gray-800 rounded-lg p-4 text-left text-xs text-gray-400 space-y-2 w-full max-w-sm">
                  <p className="text-gray-300 font-medium mb-2">To enable call logging:</p>
                  <p>1. Go to the <strong className="text-white">Setup tab</strong> above</p>
                  <p>2. Click <strong className="text-green-400">⚡ Auto-Configure Webhook</strong></p>
                  <p>3. Make or receive a WhatsApp call</p>
                  <p className="text-gray-500 pt-1">This enables the <code className="bg-gray-700 px-1 rounded">CALL</code> event so Evolution API sends call notifications to your CRM.</p>
                </div>
                <button
                  onClick={() => setActiveTab('setup')}
                  className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Go to Setup →
                </button>
              </div>
            ) : (
              allCalls.map((call, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    // Find and open the chat for this call
                    const chat = chats.find(c => c.id === call.chatId);
                    if (chat) {
                      setSelectedChat(chat);
                      selectedChatRef.current = chat;
                      setActiveTab('inbox');
                    }
                  }}
                  className="p-4 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {/* Status icon */}
                      <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                        {call.status === 'missed' ? (
                          <Phone className="w-5 h-5 text-red-500 rotate-45" />
                        ) : (
                          <Phone className="w-5 h-5 text-green-500" />
                        )}
                      </div>

                      {/* Contact info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{call.contactName}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{call.callType === 'video' ? '🎥 Video' : '📞 Voice'}</span>
                          {call.status === 'missed' ? (
                            <span className="text-red-400">Missed</span>
                          ) : (
                            <span>{call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : 'Incoming'}</span>
                          )}
                        </div>
                      </div>

                      {/* Time */}
                      <div className="text-xs text-gray-500 flex-shrink-0 text-right">
                        {new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* STATS TAB */}
      {activeTab === 'stats' && (() => {
        const pendingChats = chats.filter(c => c.status === 'pending').length;
        const unassignedChats = chats.filter(c => c.assignedTo === 'Unassigned').length;
        const groupChats = chats.filter(c => c.id.includes('@g.us')).length;
        const individualChats = chats.filter(c => !c.id.includes('@g.us')).length;
        // Team workload
        const byAssignee = chats.reduce((acc: Record<string, number>, c) => {
          const key = c.assignedTo || 'Unassigned';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
        const teamRows = Object.entries(byAssignee).sort((a, b) => b[1] - a[1]);

        const StatCard = ({ label, value, color = 'gray', sub }: { label: string; value: string | number; color?: string; sub?: string }) => (
          <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-xs mb-1">{label}</p>
            <p className={`text-2xl font-bold ${
              color === 'green' ? 'text-green-400' : color === 'red' ? 'text-red-400' :
              color === 'blue' ? 'text-blue-400' : color === 'amber' ? 'text-amber-400' :
              color === 'purple' ? 'text-purple-400' : 'text-gray-300'
            }`}>{value}</p>
            {sub && <p className="text-gray-500 text-[11px] mt-0.5">{sub}</p>}
          </div>
        );

        return (
          <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">
            {/* Conversations */}
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">Conversations</p>
              <div className="grid grid-cols-4 gap-3">
                <StatCard label="Total Chats" value={totalChats} color="blue" />
                <StatCard label="Active" value={activeChats} color="green" sub={`${totalChats > 0 ? Math.round(activeChats/totalChats*100) : 0}% of total`} />
                <StatCard label="Resolved" value={resolvedChats} color="gray" sub={`${totalChats > 0 ? Math.round(resolvedChats/totalChats*100) : 0}% of total`} />
                <StatCard label="Pending" value={pendingChats} color="amber" />
              </div>
            </div>

            {/* Inbox health */}
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">Inbox Health</p>
              <div className="grid grid-cols-4 gap-3">
                <StatCard label="Unread Messages" value={totalUnread} color={totalUnread > 10 ? 'red' : 'green'} />
                <StatCard label="Unassigned" value={unassignedChats} color={unassignedChats > 5 ? 'red' : 'gray'} sub="need attention" />
                <StatCard label="Individual Chats" value={individualChats} color="blue" />
                <StatCard label="Group Chats" value={groupChats} color="purple" />
              </div>
            </div>

            {/* Call metrics */}
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">Calls</p>
              <div className="grid grid-cols-4 gap-3">
                <StatCard label="Total Calls" value={totalCalls} color="blue" />
                <StatCard label="Calls Today" value={todaysCalls.length} color="green" />
                <StatCard label="Missed Today" value={todaysMissedCalls} color={todaysMissedCalls > 0 ? 'red' : 'green'} />
                <StatCard label="Missed Rate" value={`${missedCallRate}%`} color={missedCallRate > 30 ? 'red' : missedCallRate > 15 ? 'amber' : 'green'} sub={`${missedCalls} of ${totalCalls} calls`} />
              </div>
              {avgCallDuration > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <StatCard label="Avg Call Duration" value={avgCallDuration >= 60 ? `${Math.floor(avgCallDuration/60)}m ${avgCallDuration%60}s` : `${avgCallDuration}s`} color="purple" />
                  <StatCard label="Total Call Time" value={totalDuration >= 3600 ? `${Math.floor(totalDuration/3600)}h ${Math.floor((totalDuration%3600)/60)}m` : totalDuration >= 60 ? `${Math.floor(totalDuration/60)}m ${totalDuration%60}s` : `${totalDuration}s`} color="blue" />
                </div>
              )}
            </div>

            {/* Team workload */}
            {teamRows.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">Team Workload</p>
                <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
                  {teamRows.map(([name, count], i) => (
                    <div key={name} className={`flex items-center justify-between px-4 py-3 ${i < teamRows.length - 1 ? 'border-b border-gray-700/30' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                          {name[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-sm text-gray-200">{name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${totalChats > 0 ? (count/totalChats*100) : 0}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-white w-6 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
                  {connected === true ? 'WhatsApp Connected' :
                   connected === false ? 'WhatsApp Not Connected' : 'Checking Connection...'}
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
              {/* Auto-configure button — shown always so you can re-run after code changes */}
              <div className="mt-3 space-y-2">
                <button
                  onClick={autoConfigureWebhook}
                  disabled={configuringWebhook}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {configuringWebhook ? (
                    <>
                      <span className="animate-spin">⟳</span>
                      Configuring…
                    </>
                  ) : (
                    <>⚡ Auto-Configure Webhook (includes CALL events)</>
                  )}
                </button>
                {webhookConfigResult && (
                  <p className={`text-xs px-1 ${webhookConfigResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                    {webhookConfigResult}
                  </p>
                )}
                {!webhookStatus?.configured && (
                  <p className="text-gray-500 text-xs">
                    Or manually set webhook URL to <code className="bg-gray-800 px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/whatsapp</code> and enable: MESSAGES_UPSERT, CONNECTION_UPDATE, CALL
                  </p>
                )}
              </div>
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
            <h3 className="text-white font-semibold mb-4">Evolution API Setup Guide</h3>
            <div className="space-y-4">
              {[
                { step: '1', title: 'Evolution API Server Running', desc: 'Your Evolution API instance should be running (Railway, Docker, or VPS). Check EVOLUTION_API_URL in Vercel env vars.', done: connected !== null },
                { step: '2', title: 'Link WhatsApp Business', desc: 'In Settings → Integrations → Link WhatsApp. Scan the QR code with your WhatsApp Business phone.', done: connected === true },
                { step: '3', title: 'Configure Webhook', desc: 'Click "Auto-Configure Webhook" above — sets URL and enables MESSAGES_UPSERT, CONNECTION_UPDATE, and CALL events automatically.', done: webhookStatus?.configured || false },
                { step: '4', title: 'Environment Variables Set', desc: 'EVOLUTION_API_URL and EVOLUTION_API_KEY added to Vercel project settings.', done: connected !== null },
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
              Add these in Vercel Dashboard → Your Project → Settings → Environment Variables:
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-700/40 rounded-lg">
                <span className="text-gray-400 text-sm">EVOLUTION_API_URL</span>
                <span className="text-blue-400 text-xs">Required</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700/40 rounded-lg">
                <span className="text-gray-400 text-sm">EVOLUTION_API_KEY</span>
                <span className="text-blue-400 text-xs">Required</span>
              </div>
            </div>
          </div>

          {/* Important Note */}
          <div className="bg-amber-500/10 rounded-xl border border-amber-500/30 p-4">
            <p className="text-amber-400 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Keep Evolution API Server Running
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Your Evolution API server must stay online 24/7 to receive messages. If hosted on Railway, ensure it has sufficient credits and the service isn't sleeping.
            </p>
          </div>
        </div>
      )}

      {/* CALLING UI OVERLAY */}
      {callingChatId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-3xl p-8 text-center max-w-sm w-full mx-4 border border-gray-700">
            {/* Contact Avatar */}
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6">
              {avatars[callingChatId]
                ? <img src={`/api/whatsapp?action=mediaProxy&url=${encodeURIComponent(avatars[callingChatId])}`} alt="" className="w-full h-full object-cover" />
                : selectedChat?.name.charAt(0).toUpperCase()}
            </div>

            {/* Contact Name */}
            <h2 className="text-white text-2xl font-bold mb-2">
              {selectedChat?.name}
            </h2>

            {/* Call Status */}
            <p className="text-gray-400 text-sm mb-6">
              Calling...
            </p>

            {/* Timer */}
            <div className="bg-gray-800/50 rounded-2xl py-4 px-6 mb-6">
              <p className="text-green-400 text-3xl font-bold font-mono">
                {`${Math.floor(callTimer / 60).toString().padStart(2, '0')}:${(callTimer % 60).toString().padStart(2, '0')}`}
              </p>
            </div>

            {/* End Call Button */}
            <button
              onClick={endCall}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full font-semibold transition-colors mb-4"
            >
              <Phone className="w-5 h-5 rotate-135" />
              End Call
            </button>

            {/* Speaker Toggle */}
            <button
              className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full text-sm transition-colors"
            >
              Speaker Off
            </button>
          </div>
        </div>
      )}

      {/* Forward Message Modal */}
      {forwardMsg && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setForwardMsg(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-green-400" />
                <h3 className="text-white font-semibold">Forward to...</h3>
              </div>
              <button onClick={() => setForwardMsg(null)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            {forwardMsg.text && (
              <div className="mx-4 mt-3 px-3 py-2 bg-gray-800 rounded-lg border-l-2 border-green-500">
                <p className="text-gray-300 text-xs truncate">{forwardMsg.text}</p>
              </div>
            )}
            <div className="max-h-72 overflow-y-auto py-2">
              {chats.filter(c => (c as any).status !== 'archived' && c.id !== selectedChat?.id).map(chat => (
                <button
                  key={chat.id}
                  onClick={() => forwardMessage(chat.id)}
                  disabled={forwardingTo === chat.id}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors disabled:opacity-60"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {chat.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white text-sm font-medium truncate">{chat.name}</p>
                    <p className="text-gray-500 text-[11px] truncate">{chat.lastMessage}</p>
                  </div>
                  {forwardingTo === chat.id && <Loader2 className="w-4 h-4 text-green-400 animate-spin flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contact Info Panel */}
      {showContactInfo && selectedChat && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowContactInfo(false)}>
          <div className="w-80 h-full bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="font-semibold text-white">Contact Info</h3>
              <button className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors" onClick={() => setShowContactInfo(false)}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-5 flex flex-col items-center gap-4 border-b border-gray-800">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                {avatars[selectedChat.id]
                  ? <img src={`/api/whatsapp?action=mediaProxy&url=${encodeURIComponent(avatars[selectedChat.id])}`} alt="" className="w-full h-full object-cover" />
                  : selectedChat.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white">{selectedChat.name}</p>
                <p className="text-sm text-gray-400 mt-0.5">{selectedChat.phone || selectedChat.id?.split('@')[0]}</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">Status</p>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${selectedChat.status === 'resolved' ? 'bg-green-400' : selectedChat.status === 'pending' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                  <span className="text-sm text-gray-300 capitalize">{selectedChat.status || 'open'}</span>
                </div>
              </div>
              {selectedChat.assignedTo && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">Assigned To</p>
                  <p className="text-sm text-gray-300">{selectedChat.assignedTo}</p>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">WhatsApp ID</p>
                <p className="text-sm text-gray-400 font-mono break-all">{selectedChat.id}</p>
              </div>
              {selectedChat.unread > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">Unread Messages</p>
                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-green-500/20 text-green-400 text-sm font-bold">{selectedChat.unread}</span>
                </div>
              )}
            </div>
            <div className="p-5 mt-auto border-t border-gray-800 space-y-2">
              <button
                onClick={() => {
                  const phone = (selectedChat.phone || selectedChat.id?.split('@')[0] || '').replace(/\D/g, '');
                  localStorage.setItem('contacts_search', phone);
                  window.location.hash = '#/contacts';
                  setShowContactInfo(false);
                }}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                <User className="w-4 h-4" /> Open in CRM
              </button>
              <button
                onClick={() => { window.open(`https://wa.me/${(selectedChat.phone || selectedChat.id?.split('@')[0] || '').replace(/\D/g, '')}`, '_blank'); setShowContactInfo(false); }}
                className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                <Phone className="w-4 h-4" /> Open in WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full bg-black/40" onClick={() => setLightboxUrl(null)}>
            <X className="w-6 h-6" />
          </button>
          <img src={lightboxUrl} alt="Media" className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
          <a href={lightboxUrl} download className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium" onClick={e => e.stopPropagation()}>
            <Download className="w-4 h-4" /> Download
          </a>
        </div>
      )}
    </div>
  );
}
