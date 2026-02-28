import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard, Phone, CheckCircle2, ChartPie, FilePenLine,
  UserPlus, ShoppingCart, RefreshCw, MessageSquare, Users,
  Calendar, Receipt, Settings, BookOpen, LogOut, X,
  BarChart3, MessageCircle
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
  { section: 'CRM', path: '/leads', label: 'Lead Import', icon: UserPlus, role: 'all' },
  { section: 'CRM', path: '/woocommerce', label: 'WooCommerce', icon: ShoppingCart, role: 'all' },
  { section: 'CRM', path: '/call-sync', label: 'Call Sync', icon: RefreshCw, role: 'all' },
  { section: 'CRM', path: '/templates', label: 'Templates', icon: MessageSquare, role: 'all' },
  { section: 'CRM', path: '/whatsapp', label: 'WhatsApp Inbox', icon: MessageCircle, role: 'all' },
  { section: 'Analytics', path: '/team', label: 'Team', icon: Users, role: 'manager' },
  { section: 'Analytics', path: '/reports', label: 'Reports', icon: BarChart3, role: 'all' },
  { section: 'System', path: '/holidays', label: 'JA Holidays', icon: Calendar, role: 'all' },
  { section: 'System', path: '/invoices', label: 'Invoices', icon: Receipt, role: 'all' },
  { section: 'System', path: '/settings', label: 'Settings', icon: Settings, role: 'all' },
  { section: 'System', path: '/docs', label: 'Documentation', icon: BookOpen, role: 'all' },
];

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, onCloseSidebar }) => {
  const { state, logout } = useApp();
  const user = state.user;
  const currentPath = window.location.hash.replace('#', '') || '/dashboard';

  const filteredItems = NAV_ITEMS.filter(item => {
    if (item.role === 'manager' && user?.role !== 'manager') return false;
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
                {user?.role === 'manager' ? '👑 Manager' : '💼 Sales Rep'}
              </p>
            </div>
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
    </>
  );
};

export default Sidebar;
