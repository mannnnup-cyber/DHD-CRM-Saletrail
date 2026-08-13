import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, RefreshCw, ShoppingCart, MessageCircle,
  Mail, Phone, User, TrendingUp, ChevronRight, AlertCircle
} from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: 'MANUAL' | 'WOOCOMMERCE' | 'CSV_IMPORT' | 'WHATSAPP' | 'WEBSITE' | 'GSM';
  sources: string[] | null;
  status: 'NEW' | 'CONTACTED' | 'QUALIFYING' | 'VERIFIED_CUSTOMER' | 'CONVERTED' | 'LOST';
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  last_order_date: string | null;
  tags: string[] | null;
  created_at: string;
}

const SOURCE_LABELS: Record<string, { label: string; color: string; iconColor: string; icon: React.ElementType }> = {
  WOOCOMMERCE: { label: 'WooCommerce',  color: 'bg-purple-500/20', iconColor: 'text-purple-300', icon: ShoppingCart },
  WHATSAPP:    { label: 'WhatsApp',     color: 'bg-green-500/20',  iconColor: 'text-green-400',  icon: MessageCircle },
  WEBSITE:     { label: 'Email/Web',    color: 'bg-blue-500/20',   iconColor: 'text-blue-300',   icon: Mail },
  CSV_IMPORT:  { label: 'CSV Import',   color: 'bg-amber-500/20',  iconColor: 'text-amber-300',  icon: User },
  GSM:         { label: 'GSM Call',     color: 'bg-orange-500/20', iconColor: 'text-orange-300', icon: Phone },
  MANUAL:      { label: 'Manual',       color: 'bg-gray-500/20',   iconColor: 'text-gray-400',   icon: User },
};

const STATUS_COLORS: Record<string, string> = {
  NEW:               'bg-gray-600/30 text-gray-400',
  CONTACTED:         'bg-blue-500/20 text-blue-300',
  QUALIFYING:        'bg-amber-500/20 text-amber-300',
  VERIFIED_CUSTOMER: 'bg-green-500/20 text-green-300',
  CONVERTED:         'bg-emerald-500/20 text-emerald-300',
  LOST:              'bg-red-500/20 text-red-400',
};

function getContactSources(contact: Contact): string[] {
  if (contact.sources && contact.sources.length > 0) return contact.sources;
  return [contact.source || 'MANUAL'];
}

function SourceIcons({ contact, size = 'sm' }: { contact: Contact; size?: 'sm' | 'xs' }) {
  const srcs = getContactSources(contact);
  const iconSize = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const wrapSize = size === 'xs' ? 'w-5 h-5' : 'w-6 h-6';
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {srcs.map(s => {
        const def = SOURCE_LABELS[s] || SOURCE_LABELS.MANUAL;
        const Icon = def.icon;
        return (
          <span
            key={s}
            title={def.label}
            className={`inline-flex items-center justify-center ${wrapSize} rounded-full ${def.color} ${def.iconColor} flex-shrink-0`}
          >
            <Icon className={iconSize} />
          </span>
        );
      })}
    </div>
  );
}

const Contacts: React.FC = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/contacts');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setContacts(json.contacts || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const stored = localStorage.getItem('contacts_search');
    if (stored) { setSearch(stored); localStorage.removeItem('contacts_search'); }
  }, []);

  const filtered = contacts.filter(c => {
    if (filterSource !== 'all' && !getContactSources(c).includes(filterSource)) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.company?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalRevenue = contacts.reduce((s, c) => s + (c.total_revenue || 0), 0);
  const withOrders   = contacts.filter(c => (c.total_orders || 0) > 0).length;

  // Unique sources across all contacts (using the sources array)
  const allSources = [...new Set(contacts.flatMap(c => getContactSources(c)))];

  // Stat counts include contacts that have that source anywhere in their sources array
  const wooCount      = contacts.filter(c => getContactSources(c).includes('WOOCOMMERCE')).length;
  const whatsappCount = contacts.filter(c => getContactSources(c).includes('WHATSAPP')).length;

  return (
    <div className="p-4 lg:p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contacts</h1>
          <p className="text-gray-400 text-sm mt-0.5">{contacts.length} total · {withOrders} customers · JMD {totalRevenue.toLocaleString()} revenue</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Contacts', value: contacts.length,  icon: Users,          color: 'text-blue-400'   },
          { label: 'WooCommerce',    value: wooCount,          icon: ShoppingCart,   color: 'text-purple-400' },
          { label: 'WhatsApp',       value: whatsappCount,     icon: MessageCircle,  color: 'text-green-400'  },
          { label: 'Total Revenue',  value: `JMD ${(totalRevenue / 1000).toFixed(0)}k`, icon: TrendingUp, color: 'text-amber-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{stat.label}</span>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className="text-xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search name, email, phone, company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">All Sources</option>
            {allSources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]?.label || s}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">All Status</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFYING">Qualifying</option>
            <option value="VERIFIED_CUSTOMER">Customer</option>
            <option value="CONVERTED">Converted</option>
            <option value="LOST">Lost</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Contact List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">{contacts.length === 0 ? 'No contacts yet' : 'No contacts match your filters'}</p>
          <p className="text-sm mt-1">{contacts.length === 0 ? 'Run syncOrders to import WooCommerce customers' : 'Try clearing your filters'}</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {/* Table header — desktop */}
          <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_40px] gap-4 px-4 py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
            <span>Contact</span>
            <span>Contact Info</span>
            <span>Sources</span>
            <span>Status</span>
            <span>Orders</span>
            <span>Revenue</span>
            <span />
          </div>

          <div className="divide-y divide-gray-800/50">
            {filtered.map(contact => (
              <button
                key={contact.id}
                onClick={() => navigate(`/contacts/${contact.id}`)}
                className="w-full text-left hover:bg-gray-800/40 transition-colors"
              >
                {/* Mobile layout */}
                <div className="lg:hidden p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-400 font-bold text-sm">{contact.name?.[0]?.toUpperCase() || '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{contact.name}</p>
                    <p className="text-gray-400 text-xs truncate">{contact.email || contact.phone || '—'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <SourceIcons contact={contact} size="xs" />
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[contact.status] || STATUS_COLORS.NEW}`}>
                        {contact.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                  </div>
                  {contact.phone && (
                    <button
                      onClick={e => { e.stopPropagation(); localStorage.setItem('wa_open_contact', JSON.stringify({ phone: contact.phone!, name: contact.name })); navigate('/whatsapp'); }}
                      className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors flex-shrink-0"
                      title="Message on WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                </div>

                {/* Desktop layout */}
                <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_40px] gap-4 items-center px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-400 font-bold text-xs">{contact.name?.[0]?.toUpperCase() || '?'}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{contact.name}</p>
                      {contact.company && <p className="text-gray-500 text-xs truncate">{contact.company}</p>}
                    </div>
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    {contact.email && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 truncate">
                        <Mail className="w-3 h-3 flex-shrink-0 text-gray-600" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Phone className="w-3 h-3 flex-shrink-0 text-gray-600" />
                        <span>{contact.phone}</span>
                        <button
                          onClick={e => { e.stopPropagation(); localStorage.setItem('wa_open_contact', JSON.stringify({ phone: contact.phone!, name: contact.name })); navigate('/whatsapp'); }}
                          className="ml-1 p-0.5 rounded bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors"
                          title="Message on WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Multi-source icons — hover each for tooltip */}
                  <div>
                    <SourceIcons contact={contact} size="sm" />
                  </div>
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[contact.status] || STATUS_COLORS.NEW}`}>
                      {contact.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                  <div className="text-sm text-white font-medium">{contact.total_orders || 0}</div>
                  <div className="text-sm text-white">
                    {(contact.total_revenue || 0) > 0
                      ? `JMD ${contact.total_revenue.toLocaleString()}`
                      : <span className="text-gray-600">—</span>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
