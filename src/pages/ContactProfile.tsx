import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Building2, ShoppingCart, MessageCircle,
  PhoneCall, FileText, RefreshCw, AlertCircle, Clock, TrendingUp,
  DollarSign, Package, User, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  status: string;
  notes: string | null;
  tags: string[] | null;
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  first_order_date: string | null;
  last_order_date: string | null;
  created_at: string;
}

interface Interaction {
  id: string;
  type: 'WHATSAPP' | 'CALL' | 'EMAIL' | 'NOTE' | 'SMS' | 'MEETING';
  direction: 'INBOUND' | 'OUTBOUND';
  subject: string | null;
  content: string | null;
  metadata: Record<string, any> | null;
  timestamp: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  EMAIL:    { icon: Mail,           color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   label: 'Email' },
  WHATSAPP: { icon: MessageCircle,  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20', label: 'WhatsApp' },
  CALL:     { icon: PhoneCall,      color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20', label: 'Call' },
  NOTE:     { icon: FileText,       color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', label: 'Note' },
  SMS:      { icon: MessageCircle,  color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20',   label: 'SMS' },
  MEETING:  { icon: User,           color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20',   label: 'Meeting' },
};

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-600/30 text-gray-400',
  CONTACTED: 'bg-blue-500/20 text-blue-300',
  QUALIFYING: 'bg-amber-500/20 text-amber-300',
  VERIFIED_CUSTOMER: 'bg-green-500/20 text-green-300',
  CONVERTED: 'bg-emerald-500/20 text-emerald-300',
  LOST: 'bg-red-500/20 text-red-400',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ContactProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllInteractions, setShowAllInteractions] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/contacts?id=${id}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setContact(json.contact);
      setInteractions(json.interactions || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <div className="h-8 w-40 bg-gray-800 rounded-xl animate-pulse" />
        <div className="h-40 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="p-4 lg:p-6">
        <button onClick={() => navigate('/contacts')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Contacts
        </button>
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error || 'Contact not found'}
        </div>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[contact.status] || STATUS_COLORS.NEW;
  const visibleInteractions = showAllInteractions ? interactions : interactions.slice(0, 10);

  const initials = contact.name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">

      {/* Back + Refresh */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/contacts')}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Contacts
        </button>
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-xs transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Contact Header Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/30 to-orange-500/30 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-400 font-bold text-xl">{initials}</span>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-white">{contact.name}</h1>
                {contact.company && (
                  <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-0.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {contact.company}
                  </div>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                {contact.status.replace('_', ' ')}
              </span>
            </div>

            {/* Contact info row */}
            <div className="flex flex-wrap gap-4 mt-4">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-amber-400 transition-colors"
                >
                  <Mail className="w-4 h-4 text-gray-500" />
                  {contact.email}
                  <ExternalLink className="w-3 h-3 text-gray-600" />
                </a>
              )}
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-amber-400 transition-colors"
                >
                  <Phone className="w-4 h-4 text-gray-500" />
                  {contact.phone}
                </a>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-4">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 rounded-lg text-xs font-medium transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Send Email
                </a>
              )}
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 rounded-lg text-xs font-medium transition-colors"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  Call
                </a>
              )}
              <button
                onClick={() => navigate('/leads')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-300 rounded-lg text-xs font-medium transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                Create Lead
              </button>
            </div>
          </div>
        </div>

        {/* Notes */}
        {contact.notes && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-300">{contact.notes}</p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-500">Total Orders</span>
          </div>
          <p className="text-2xl font-bold text-white">{contact.total_orders || 0}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-gray-500">Total Revenue</span>
          </div>
          <p className="text-xl font-bold text-white">
            {(contact.total_revenue || 0) > 0
              ? `JMD ${contact.total_revenue.toLocaleString()}`
              : '—'}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-500">Avg Order Value</span>
          </div>
          <p className="text-xl font-bold text-white">
            {(contact.average_order_value || 0) > 0
              ? `JMD ${Math.round(contact.average_order_value).toLocaleString()}`
              : '—'}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-500">Interactions</span>
          </div>
          <p className="text-2xl font-bold text-white">{interactions.length}</p>
        </div>
      </div>

      {/* Interaction Timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">Activity Timeline</h2>
          <div className="flex gap-2">
            {(['EMAIL', 'WHATSAPP', 'CALL'] as const).map(type => {
              const count = interactions.filter(i => i.type === type).length;
              if (!count) return null;
              const cfg = TYPE_CONFIG[type];
              return (
                <span key={type} className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color} bg-gray-800`}>
                  {count} {cfg.label}
                </span>
              );
            })}
          </div>
        </div>

        {interactions.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm">No activity yet</p>
            <p className="text-xs mt-1">Interactions will appear here as they happen</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/40">
            {visibleInteractions.map((interaction) => {
              const cfg = TYPE_CONFIG[interaction.type] || TYPE_CONFIG.NOTE;
              const Icon = cfg.icon;
              return (
                <div key={interaction.id} className="flex gap-4 px-5 py-4 hover:bg-gray-800/20 transition-colors">
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-gray-600">·</span>
                      <span className="text-xs text-gray-500 capitalize">{interaction.direction?.toLowerCase()}</span>
                      <span className="text-xs text-gray-600">·</span>
                      <span className="text-xs text-gray-500">{timeAgo(interaction.timestamp)}</span>
                    </div>
                    {interaction.subject && (
                      <p className="text-sm font-medium text-white mt-0.5 truncate">{interaction.subject}</p>
                    )}
                    {interaction.content && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{interaction.content}</p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs text-gray-600 flex-shrink-0 text-right hidden sm:block">
                    {new Date(interaction.timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    <br />
                    {new Date(interaction.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}

            {interactions.length > 10 && (
              <button
                onClick={() => setShowAllInteractions(!showAllInteractions)}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-400 hover:text-white hover:bg-gray-800/30 transition-colors"
              >
                {showAllInteractions ? (
                  <><ChevronUp className="w-4 h-4" /> Show less</>
                ) : (
                  <><ChevronDown className="w-4 h-4" /> Show {interactions.length - 10} more interactions</>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Source + Meta */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-1">Source</p>
            <p className="text-white">{contact.source}</p>
          </div>
          {contact.first_order_date && (
            <div>
              <p className="text-xs text-gray-500 mb-1">First Order</p>
              <p className="text-white">{new Date(contact.first_order_date).toLocaleDateString()}</p>
            </div>
          )}
          {contact.last_order_date && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Last Order</p>
              <p className="text-white">{new Date(contact.last_order_date).toLocaleDateString()}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 mb-1">Added</p>
            <p className="text-white">{new Date(contact.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactProfile;
