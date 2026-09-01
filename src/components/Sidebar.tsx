import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard, Phone, CheckCircle2, ChartPie, FilePenLine,
  UserPlus, ShoppingCart, MessageSquare, Users,
  Calendar, Receipt, Settings, BookOpen, LogOut, X,
  BarChart3, MessageCircle, Mail, ContactRound, Smartphone, Mic, BrainCircuit,
  KeyRound, Loader2, CheckCircle, AlertCircle, Share2
} from 'lucide-react';

interface SidebarProps {
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
}

const NAV_ITEMS = [
  { section: 'Main', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, role: 'all' },
  { section: 'Main', path: '/calls', label: 'Call Logs', icon: Phone, role: 'all' },
  { section: 'Main', path: '/tasks', label: 'Tasks', icon: CheckCircle2, role: 'all' },
  { section: 'Main', path: '/pipeline', label: 'Pipeline', icon: ChartPie, role: 'all' },
  { section: 'Main', path: '/quotes', label: 'Quotes', icon: FilePenLine, role: 'all' },
  { section: 'CRM', path: '/contacts', label: 'Contacts', icon: ContactRound, role: 'all' },
  { section: 'CRM', path: '/leads', label: 'Lead Import', icon: UserPlus, role: 'all' },
  { section: 'CRM', path: '/woocommerce', label: 'WooCommerce', icon: ShoppingCart, role: 'all' },
  { section: 'CRM', path: '/companion', label: 'Companion App', icon: Smartphone, role: 'all' },
  { section: 'CRM', path: '/templates', label: 'Templates', icon: MessageSquare, role: 'all' },
  { section: 'CRM', path: '/whatsapp', label: 'WhatsApp Inbox', icon: MessageCircle, role: 'all' },
  { section: 'CRM', path: '/email', label: 'Email Inbox', icon: Mail, role: 'all' },
  { section: 'CRM', path: '/social', label: 'Social Media', icon: Share2, role: 'all' },
  { section: 'Analytics', path: '/team', label: 'Team', icon: Users, role: 'manager' },
  { section: 'Analytics', path: '/reports', label: 'Reports', icon: BarChart3, role: 'all' },
  { section: 'Analytics', path: '/coaching', label: 'Call Coaching', icon: BrainCircuit, role: 'manager' },
  { section: 'System', path: '/recording-settings', label: 'Recording Settings', icon: Mic, role: 'manager' },
  { section: 'System', path: '/holidays', label: 'JA Holidays', icon: Calendar, role: 'all' },
  { section: 'System', path: '/invoices', label: 'Invoices', icon: Receipt, role: 'all' },
  { section: 'System', path: '/settings', label: 'Settings', icon: Settings, role: 'all' },
  { section: 'System', path: '/docs', label: 'Documentation', icon: BookOpen, role: 'all' },
];

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, onCloseSidebar }) => {
  const { state, logout } = useApp();
  const { mustChangePassword, clearMustChangePassword } = useApp() as any;
  const user = state.user;

  const getPath = () => window.location.hash.replace('#', '') || '/dashboard';
  const [currentPath, setCurrentPath] = useState(getPath);
  const [waUnread, setWaUnread] = useState(0);

  // Change password modal state
  const [showChangePw, setShowChangePw] = useState(false);
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState('');
  const [cpSuccess, setCpSuccess] = useState(false);

  // Force modal open when user has a temp password they must change
  const isForced = mustChangePassword === true;
  useEffect(() => {
    if (isForced) { setShowChangePw(true); setCpError(''); setCpSuccess(false); }
  }, [isForced]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError('');
    if (cpNew !== cpConfirm) { setCpError('New passwords do not match'); return; }
    if (cpNew.length < 8) { setCpError('New password must be at least 8 characters'); return; }
    setCpLoading(true);
    try {
      const r = await fetch('/api/users?action=changePassword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user?.id, email: user?.email, currentPassword: cpCurrent, newPassword: cpNew })
      });
      const data = await r.json();
      if (data.success) {
        setCpSuccess(true);
        if (isForced && clearMustChangePassword) clearMustChangePassword();
        setTimeout(() => { setShowChangePw(false); setCpSuccess(false); setCpCurrent(''); setCpNew(''); setCpConfirm(''); }, 2000);
      } else {
        setCpError(data.error || 'Failed to change password');
      }
    } catch {
      setCpError('Network error');
    }
    setCpLoading(false);
  };

  useEffect(() => {
    const onHashChange = () => setCurrentPath(getPath());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const r = await fetch('/api/whatsapp?action=chatsFromDb');
        const data = await r.json();
        if (data.success && Array.isArray(data.chats)) {
          const total = data.chats.reduce((sum: number, c: any) => sum + (c.unread || 0), 0);
          setWaUnread(total);
        }
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredItems = NAV_ITEMS.filter(item => {
    if (item.role === 'manager' && !['manager', 'owner'].includes(user?.role || '')) return false;
    return true;
  });

  const sections = [...new Set(filteredItems.map(i => i.section))];

  const handleNav = (path: string) => {
    window.location.hash = `#${path}`;
    onCloseSidebar();
  };

  const handleLogout = () => {
    logout();
    window.location.hash = '#/login';
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onCloseSidebar}
      />

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-gray-900 border-r border-gray-800/50
        flex flex-col transition-transform duration-300
        lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>

        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-800/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center font-black text-black text-sm shadow-lg">
              DH
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">SalesTrail</p>
              <p className="text-gray-500 text-[10px]">Dirty Hand Designs</p>
            </div>
          </div>
          <button
            onClick={onCloseSidebar}
            className="lg:hidden p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map(section => (
            <div key={section} className="mb-6">
              <p className="text-[9px] uppercase tracking-widest text-gray-600 font-bold px-3 pb-2">
                {section}
              </p>
              <div className="space-y-0.5">
                {filteredItems
                  .filter(item => item.section === section)
                  .map(item => {
                    const isActive = currentPath === item.path ||
                      (item.path === '/dashboard' && currentPath === '/');
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNav(item.path)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                          ${isActive
                            ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-400 shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                        <span>{item.label}</span>
                        {item.path === '/tasks' && (
                          <span className="ml-auto text-[9px] bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center font-bold animate-pulse">
                            {(state.tasks || []).filter((t: any) => !t.completed && new Date(t.dueDate) < new Date()).length || ''}
                          </span>
                        )}
                        {item.path === '/whatsapp' && waUnread > 0 && (
                          <span className="ml-auto text-[9px] bg-green-500 text-white min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center font-bold">
                            {waUnread > 99 ? '99+' : waUnread}
                          </span>
                        )}
                        {item.path === '/woocommerce' && (
                          <span className="ml-auto w-2 h-2 bg-purple-500 rounded-full" />
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-3 border-t border-gray-800/50 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800/40">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-bold text-sm uppercase flex-shrink-0">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name || 'User'}</p>
              <p className="text-[10px] text-gray-500 capitalize">
                {user?.role === 'owner' ? '👑 Owner' : user?.role === 'manager' ? '🏆 Manager' : '💼 Sales Rep'}
              </p>
            </div>
            <button
              onClick={() => { setShowChangePw(true); setCpError(''); setCpSuccess(false); }}
              className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors flex-shrink-0"
              title="Change Password"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Change Password Modal */}
      {showChangePw && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">
                  {isForced ? 'Set Your Password' : 'Change Password'}
                </h3>
              </div>
              {/* Hide X when forced — user must change before continuing */}
              {!isForced && (
                <button onClick={() => setShowChangePw(false)} className="p-1 text-gray-500 hover:text-white rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="p-5">
              {isForced && !cpSuccess && (
                <div className="flex items-start gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>You're using a temporary password. Please set a new one before continuing — enter the temporary password in the "Current Password" field.</span>
                </div>
              )}
              {cpSuccess ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                  <p className="text-green-400 font-medium text-sm">Password changed successfully</p>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      {isForced ? 'Temporary Password' : 'Current Password'}
                    </label>
                    <input type="password" value={cpCurrent} onChange={e => setCpCurrent(e.target.value)} required
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 px-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">New Password</label>
                    <input type="password" value={cpNew} onChange={e => setCpNew(e.target.value)} required
                      placeholder="Min. 8 characters"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 px-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm New Password</label>
                    <input type="password" value={cpConfirm} onChange={e => setCpConfirm(e.target.value)} required
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 px-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                  {cpError && (
                    <div className="flex items-center gap-2 text-red-400 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {cpError}
                    </div>
                  )}
                  <button type="submit" disabled={cpLoading}
                    className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                    {cpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {cpLoading ? 'Updating…' : isForced ? 'Set Password & Continue' : 'Update Password'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
