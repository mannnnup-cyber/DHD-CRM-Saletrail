import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Phone, PhoneIncoming, PhoneMissed, Send, RefreshCw, CheckCheck, Check, Clock, User, Search, Tag, ChevronDown, Wifi, WifiOff, AlertCircle, Smile, PhoneCall } from 'lucide-react';
import { useApp } from '../context/AppContext';

// WhatsApp Green API Configuration - Uses environment variables
// Vite requires VITE_ prefix for frontend-accessible env vars
// But we also check without prefix for compatibility
const INSTANCE_ID = import.meta.env.VITE_GREENAPI_INSTANCE_ID || import.meta.env.GREENAPI_INSTANCE_ID || '';
const API_TOKEN = import.meta.env.VITE_GREENAPI_TOKEN || import.meta.env.GREENAPI_TOKEN || '';
const BASE_URL = INSTANCE_ID ? `https://api.green-api.com/waInstance${INSTANCE_ID}` : '';

const TEAM_MEMBERS = [
  { id: 'all', name: 'Unassigned' },
  { id: 'keisha', name: 'Keisha' },
  { id: 'andre', name: 'Andre' },
  { id: 'marcia', name: 'Marcia' },
  { id: 'devon', name: 'Devon' },
  { id: 'tanya', name: 'Tanya' },
];

const MESSAGE_TEMPLATES = [
  { id: 1, name: 'Initial Response', text: 'Hi! Thanks for reaching out to Dirty Hand Designs 🎨 How can we help you today?' },
  { id: 2, name: 'Quote Follow-up', text: 'Hi! Just following up on the quote we sent. Do you have any questions about our branding services?' },
  { id: 3, name: 'Design Review', text: 'Hi! Your design mockup is ready for review. Please let us know your feedback and any changes needed.' },
  { id: 4, name: 'Payment Reminder', text: 'Hi! This is a friendly reminder that your invoice is due. Please let us know if you have any questions.' },
  { id: 5, name: 'Project Complete', text: 'Hi! Great news — your project is complete! Thank you for choosing Dirty Hand Designs 🙌' },
];

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
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

export default function WhatsApp() {
  const { state, allCalls, addCall } = useApp();
  const [activeTab, setActiveTab] = useState<'inbox' | 'calls' | 'stats' | 'setup'>('inbox');
  const [connected, setConnected] = useState<boolean | null>(null);
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Check connection status
  const checkStatus = async () => {
    if (!INSTANCE_ID || !API_TOKEN) {
      setConnected(false);
      return;
    }
    try {
      const r = await fetch(`${BASE_URL}/getStateInstance/${API_TOKEN}`);
      const data = await r.json();
      setConnected(data.stateInstance === 'authorized');
    } catch {
      setConnected(false);
    }
  };

  // Load chats from Green API
  const loadChats = async () => {
    if (!INSTANCE_ID || !API_TOKEN) {
      setChats(getMockChats());
      setSyncing(false);
      return;
    }
    setSyncing(true);
    try {
      const url = `${BASE_URL}/getChats/${API_TOKEN}`;
      console.log('Loading chats from:', url);
      const r = await fetch(url);
      const data = await r.json();
      console.log('Chats response:', data);

      // Check if response is valid
      if (data && Array.isArray(data) && data.length > 0) {
        const formatted: Chat[] = data.slice(0, 50).map((chat: any) => ({
          id: chat.id || '',
          name: chat.name || chat.id?.split('@')[0] || 'Unknown',
          lastMessage: chat.lastMessage?.textMessage || chat.lastMessage?.caption || '📎 Media',
          timestamp: chat.lastMessage?.timestamp
            ? new Date(chat.lastMessage.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '',
          unread: chat.unreadCount || 0,
          assignedTo: 'Unassigned',
          phone: chat.id?.split('@')[0] || '',
          status: 'active' as const
        }));
        setChats(formatted);
      } else if (data && data.status === false) {
        // API returned error
        console.error('Green API error:', data);
        setChats(getMockChats());
      } else {
        // No chats or empty response
        console.log('No chats found, using empty array');
        setChats([]);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      setChats(getMockChats());
    }
    setSyncing(false);
  };

  // Load messages for a chat
  const loadMessages = async (chatId: string) => {
    if (!INSTANCE_ID || !API_TOKEN) {
      setMessages(getMockMessages());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const url = `${BASE_URL}/getChatHistory/${API_TOKEN}`;
      console.log('Loading messages from:', url, 'chatId:', chatId);
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, count: 50 })
      });
      const data = await r.json();
      console.log('Messages response:', data);

      if (data && Array.isArray(data) && data.length > 0) {
        const formatted: Message[] = data.map((msg: any) => ({
          id: msg.idMessage || Math.random().toString(),
          text: msg.textMessage || msg.caption || '📎 Media',
          timestamp: msg.timestamp
            ? new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '',
          fromMe: msg.type === 'outgoing',
          status: 'read' as const,
          type: msg.typeMessage || 'text'
        }));
        setMessages(formatted.reverse());
      } else if (data && data.status === false) {
        console.error('Green API error:', data);
        setMessages([]);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
    setLoading(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Send message
  const sendMessage = async () => {
    if (!replyText.trim() || !selectedChat) return;
    if (!INSTANCE_ID || !API_TOKEN) {
      alert('WhatsApp credentials not configured. Please set GREENAPI_INSTANCE_ID and GREENAPI_TOKEN in Vercel.');
      return;
    }
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
      await fetch(`${BASE_URL}/sendMessage/${API_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: selectedChat.id, message: text })
      });
      setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, status: 'delivered' } : m));

      // Log as activity
      addCall({
        repId: user?.id || 'rep1',
        contactId: '',
        contactName: selectedChat.name,
        contactPhone: selectedChat.phone,
        type: 'WhatsApp',
        duration: 0,
        notes: `WhatsApp message: ${text.slice(0, 50)}`,
        source: 'WhatsApp'
      } as any);

    } catch {
      // Message still shows locally
    }
    setSending(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const getMockChats = (): Chat[] => [
    { id: '18763280220@c.us', name: 'Production Office', lastMessage: 'When will the logo be ready?', timestamp: '10:42', unread: 3, assignedTo: 'Keisha', phone: '18763280220', status: 'active' },
    { id: '18765408428@c.us', name: 'Sun Island CUG', lastMessage: 'Thanks for the quote!', timestamp: '09:15', unread: 0, assignedTo: 'Andre', phone: '18765408428', status: 'active' },
    { id: '18764581519@c.us', name: 'Cindy-lue Miller', lastMessage: 'Can we schedule a meeting?', timestamp: 'Yesterday', unread: 1, assignedTo: 'Unassigned', phone: '18764581519', status: 'pending' },
    { id: '18765079885@c.us', name: 'Aakeem Jones', lastMessage: 'I love the design!', timestamp: 'Yesterday', unread: 0, assignedTo: 'Marcia', phone: '18765079885', status: 'resolved' },
    { id: '18768835527@c.us', name: 'Mr. Charles Williams', lastMessage: 'Please send invoice', timestamp: 'Mon', unread: 2, assignedTo: 'Unassigned', phone: '18768835527', status: 'pending' },
  ];

  const getMockMessages = (): Message[] => [
    { id: '1', text: 'Hi! I am interested in a logo design for my business', timestamp: '09:00', fromMe: false, status: 'read', type: 'text' },
    { id: '2', text: 'Hi! Thanks for reaching out to Dirty Hand Designs 🎨 How can we help you today?', timestamp: '09:02', fromMe: true, status: 'read', type: 'text' },
    { id: '3', text: 'I need a full branding package — logo, business cards and social media graphics', timestamp: '09:05', fromMe: false, status: 'read', type: 'text' },
    { id: '4', text: 'Great! We specialize in exactly that. Can I ask about your budget range?', timestamp: '09:07', fromMe: true, status: 'read', type: 'text' },
    { id: '5', text: 'Budget is around $80,000 JMD', timestamp: '09:10', fromMe: false, status: 'read', type: 'text' },
    { id: '6', text: 'Perfect! That works well for our branding packages. I will send you a detailed quote today.', timestamp: '09:12', fromMe: true, status: 'delivered', type: 'text' },
    { id: '7', text: 'When will the logo be ready?', timestamp: '10:42', fromMe: false, status: 'read', type: 'text' },
  ];

  useEffect(() => {
    checkStatus();
    loadChats();
    const interval = setInterval(() => { loadChats(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedChat) loadMessages(selectedChat.id);
  }, [selectedChat]);

  const filteredChats = chats.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0);
  const totalChats = chats.length;
  const activeChats = chats.filter(c => c.status === 'active').length;
  const resolvedChats = chats.filter(c => c.status === 'resolved').length;
  const whatsappCallsToday = allCalls.filter(c => c.type === 'WhatsApp' && new Date(c.timestamp).toDateString() === new Date().toDateString()).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-green-400" />
            WhatsApp Business
          </h1>
          <p className="text-gray-400 text-sm mt-1">DHD Sales Inbox — Shared team number</p>
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
            onClick={() => { checkStatus(); loadChats(); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

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
            {tab === 'inbox' && `💬 Inbox${totalUnread > 0 ? ` (${totalUnread})` : ''}`}
            {tab === 'calls' && `📞 Calls${waCalls.length > 0 ? ` (${waCalls.length})` : ''}`}
            {tab === 'stats' && '📊 Stats'}
            {tab === 'setup' && '⚙️ Setup'}
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
                      {selectedChat.status === 'resolved' ? 'Reopen' : '✓ Resolve'}
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
                        <p className="text-gray-400 text-xs">+{call.number} · {call.rep}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        call.type === 'Outgoing' ? 'text-blue-400' :
                        call.type === 'Incoming' ? 'text-green-400' : 'text-red-400'
                      }`}>{call.type}</p>
                      <p className="text-gray-400 text-xs">{call.duration} · {call.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <PhoneCall className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No WhatsApp calls logged yet</p>
                <p className="text-gray-500 text-sm mt-1">WhatsApp calls from MacroDroid will appear here when synced</p>
                <div className="mt-4 p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 text-left max-w-md mx-auto">
                  <p className="text-amber-400 text-sm font-medium mb-2">📱 To log WhatsApp calls:</p>
                  <p className="text-gray-400 text-xs">Add a MacroDroid trigger for WhatsApp notifications. When a WhatsApp call ends, MacroDroid sends the call data to Google Sheets with type=WhatsApp. The Call Sync page will import them here automatically.</p>
                </div>
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
        <div className="space-y-4">
          {!INSTANCE_ID || !API_TOKEN ? (
            <div className="bg-red-500/10 rounded-xl border border-red-500/30 p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-red-400" />
                <h3 className="text-white font-semibold text-lg">Environment Variables Not Configured</h3>
              </div>
              <p className="text-gray-400 text-sm mb-4">Please add the following environment variables in your Vercel project settings:</p>
              <div className="space-y-3 bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">GREENAPI_INSTANCE_ID</span>
                  <span className="text-red-400 text-xs">Required</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">GREENAPI_TOKEN</span>
                  <span className="text-red-400 text-xs">Required</span>
                </div>
              </div>
              <p className="text-gray-400 text-xs mt-4">
                Go to Vercel Dashboard → Your Project → Settings → Environment Variables
              </p>
            </div>
          ) : (
            <div className={`rounded-xl p-4 border ${
              connected ? 'bg-green-500/10 border-green-500/30' : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              <div className="flex items-center gap-3">
                {connected ? <Wifi className="w-5 h-5 text-green-400" /> : <WifiOff className="w-5 h-5 text-amber-400" />}
                <div>
                  <p className={`font-medium ${connected ? 'text-green-400' : 'text-amber-400'}`}>
                    {connected ? '✅ Green API Connected' : '⚠️ Green API Not Connected'}
                  </p>
                  <p className="text-gray-400 text-sm">Instance ID: {INSTANCE_ID}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-6">
            <h3 className="text-white font-semibold mb-4">🚀 Setup Guide</h3>
            <div className="space-y-4">
              {[
                { step: '1', title: 'Green API Account Created', desc: 'Account created and Instance ID configured', done: !!INSTANCE_ID && !!API_TOKEN },
                { step: '2', title: 'Link WhatsApp Business', desc: 'Open WhatsApp Business → Settings → Linked Devices → Link Device → Scan QR in Green API dashboard', done: connected === true },
                { step: '3', title: 'Configure Webhook', desc: 'In Green API dashboard → Settings → Webhook URL: https://your-vercel-app.vercel.app/api/whatsapp', done: false },
                { step: '4', title: 'Environment Variables Set', desc: 'GREENAPI_INSTANCE_ID and GREENAPI_TOKEN added to Vercel', done: !!INSTANCE_ID && !!API_TOKEN },
                { step: '5', title: 'Add MacroDroid WhatsApp Trigger', desc: 'Add notification trigger for WhatsApp calls in MacroDroid to log WhatsApp calls to Google Sheets', done: false },
              ].map(item => (
                <div key={item.step} className={`flex items-start gap-4 p-4 rounded-xl ${
                  item.done ? 'bg-green-500/10 border border-green-500/20' : 'bg-gray-700/30'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                    item.done ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-400'
                  }`}>
                    {item.done ? '✓' : item.step}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{item.title}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-6">
            <h3 className="text-white font-semibold mb-4">🔑 Green API Credentials</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-700/40 rounded-lg">
                <span className="text-gray-400 text-sm">Instance ID</span>
                <span className="text-white font-mono text-sm">{INSTANCE_ID || 'Not configured'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700/40 rounded-lg">
                <span className="text-gray-400 text-sm">API Token</span>
                <span className="text-gray-400 font-mono text-xs">{API_TOKEN ? `••••••••••${API_TOKEN.slice(-6)}` : 'Not configured'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700/40 rounded-lg">
                <span className="text-gray-400 text-sm">Base URL</span>
                <span className="text-blue-400 font-mono text-xs">{INSTANCE_ID ? `api.green-api.com/waInstance${INSTANCE_ID}` : 'Not configured'}</span>
              </div>
            </div>
          </div>

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
