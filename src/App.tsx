import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CallLogs from './pages/CallLogs';
import Tasks from './pages/Tasks';
import Pipeline from './pages/Pipeline';
import Quotes from './pages/Quotes';
import LeadImport from './pages/LeadImport';
import WooCommerce from './pages/WooCommerce';
import CallSync from './pages/CallSync';
import Templates from './pages/Templates';
import Team from './pages/Team';
import Reports from './pages/Reports';
import Holidays from './pages/Holidays';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import Documentation from './pages/Documentation';
import WhatsApp from './pages/WhatsApp';
import ContactModal from './components/ContactModal';
import {
  Menu, Bell, Search, X, LogOut, User,
  ChevronDown, AlertTriangle
} from 'lucide-react';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 text-sm mb-6">{this.state.error}</p>
            <button
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-6 py-3 rounded-xl transition-colors"
            >
              Reset & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const JAMAICA_HOLIDAYS = [
  { date: '01-01', name: "New Year's Day" },
  { date: '02-24', name: "Bob Marley Birthday (observed)" },
  { date: '04-18', name: "Good Friday" },
  { date: '04-21', name: "Easter Monday" },
  { date: '05-23', name: "Labour Day" },
  { date: '08-01', name: "Emancipation Day" },
  { date: '08-06', name: "Independence Day" },
  { date: '10-20', name: "National Heroes Day" },
  { date: '12-25', name: "Christmas Day" },
  { date: '12-26', name: "Boxing Day" },
];

function getJamaicaHoliday(): string | null {
  const now = new Date();
  const monthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const holiday = JAMAICA_HOLIDAYS.find(h => h.date === monthDay);
  return holiday ? holiday.name : null;
}

const AppInner: React.FC = () => {
  const { state, logout } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(3);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const todayHoliday = getJamaicaHoliday();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
        setSearchResults([]);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results: any[] = [];
    (state.leads || []).slice(0, 3).forEach(l => {
      if (l.name?.toLowerCase().includes(q) || l.company?.toLowerCase().includes(q)) {
        results.push({ type: 'Lead', label: l.name, sub: l.company, path: '/leads' });
      }
    });
    (state.deals || []).slice(0, 3).forEach(d => {
      if (d.name?.toLowerCase().includes(q)) {
        results.push({ type: 'Deal', label: d.name, sub: d.stage, path: '/pipeline' });
      }
    });
    setSearchResults(results.slice(0, 6));
  }, [searchQuery, state.leads, state.deals]);

  const notifications = [
    { id: 1, text: 'New lead assigned to you', time: '5 min ago', read: false, color: 'bg-green-500' },
    { id: 2, text: 'Deal moved to Quote Sent', time: '1 hour ago', read: false, color: 'bg-blue-500' },
    { id: 3, text: 'Task overdue: Follow up with client', time: '2 hours ago', read: false, color: 'bg-red-500' },
    { id: 4, text: 'Quote approved by Kingston Media', time: '3 hours ago', read: true, color: 'bg-amber-500' },
    { id: 5, text: 'WooCommerce sync completed', time: '1 day ago', read: true, color: 'bg-purple-500' },
  ];

  if (!state.user) {
    return <Login />;
  }

  const handleLogout = () => {
    logout();
    window.location.hash = '#/login';
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="h-16 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800/50 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 z-30">

          {/* Left: Hamburger + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden lg:flex items-center gap-2">
              <div className="w-2 h-8 bg-gradient-to-b from-amber-400 to-green-500 rounded-full" />
              <span className="text-sm text-gray-400 font-medium">Dirty Hand Designs</span>
            </div>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-md mx-4" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search leads, deals, contacts..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
                onFocus={() => setShowSearch(true)}
                className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:bg-gray-800 transition-all"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-500 hover:text-white" />
                </button>
              )}
              {/* Search Results */}
              {showSearch && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => { window.location.hash = `#${r.path}`; setShowSearch(false); setSearchQuery(''); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors text-left"
                    >
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-medium">{r.type}</span>
                      <div>
                        <p className="text-sm text-white font-medium">{r.label}</p>
                        <p className="text-xs text-gray-500">{r.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Notifications + Profile */}
          <div className="flex items-center gap-2">

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
                className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="font-semibold text-white">Notifications</h3>
                    <button onClick={() => setUnreadCount(0)} className="text-xs text-amber-400 hover:text-amber-300">Mark all read</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map(n => (
                      <div key={n.id} className={`flex items-start gap-3 p-4 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${!n.read ? 'bg-gray-800/20' : ''}`}>
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white">{n.text}</p>
                          <p className="text-xs text-gray-500 mt-1">{n.time}</p>
                        </div>
                        {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
                className="flex items-center gap-2 p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-bold text-sm uppercase">
                  {state.user?.name?.[0] || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-white leading-tight">{state.user?.name}</p>
                  <p className="text-xs text-gray-500 capitalize leading-tight">{state.user?.role}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500 hidden md:block" />
              </button>
              {showProfile && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-gray-800">
                    <p className="font-semibold text-white">{state.user?.name}</p>
                    <p className="text-sm text-gray-400">{state.user?.email}</p>
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${state.user?.role === 'manager' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {state.user?.role === 'manager' ? '👑 Manager' : '💼 Sales Rep'}
                    </span>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => { window.location.hash = '#/settings'; setShowProfile(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <User className="w-4 h-4" />
                      Profile Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Jamaica Holiday Banner */}
        {todayHoliday && (
          <div className="bg-gradient-to-r from-green-900/40 via-amber-900/40 to-black/40 border-b border-amber-500/20 px-6 py-2 flex items-center gap-3">
            <span className="text-lg">🇯🇲</span>
            <p className="text-sm text-amber-300 font-medium">
              Today is <strong>{todayHoliday}</strong> — Jamaica Public Holiday. Call blocking is active.
            </p>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/calls" element={<CallLogs />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/leads" element={<LeadImport />} />
            <Route path="/woocommerce" element={<WooCommerce />} />
            <Route path="/call-sync" element={<CallSync />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/team" element={<Team />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/holidays" element={<Holidays />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/docs" element={<Documentation />} />
            <Route path="/whatsapp" element={<WhatsApp />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {/* Contact Modal */}
      {selectedContact && (
        <ContactModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <HashRouter>
          <AppInner />
        </HashRouter>
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;
