import React, { useState, useEffect, useCallback } from 'react';
import { Phone, Clock, DollarSign, TrendingUp, AlertTriangle, CheckCircle2, MessageCircle, ArrowUpRight, Target, Activity, Zap, Mail, Users, RefreshCw, Receipt } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import ActionList from '../components/ActionList';

interface DashboardData {
  kpis: {
    totalContacts: number;
    totalInteractions: number;
    activeDeals: number;
    pipelineValue: number;
    totalRevenue: number;
    overdueInvoices: number;
    overdueInvoiceValue: number;
    pendingInvoiceValue: number;
    hotLeads: number;
    unreadEmails: number;
    dealsWon: number;
  };
  pipeline: { stage: string; count: number; value: number }[];
  contactsBySource: { source: string; count: number }[];
  callVolume: { day: string; date: string; total: number; inbound: number; outbound: number }[];
  interactionsByType: { EMAIL: number; WHATSAPP: number; CALL: number; NOTE: number };
  recentActivity: { type: string; direction: string; subject: string | null; content: string | null; contactName: string | null; timestamp: string }[];
  monthlyRevenue: { month: string; revenue: number }[];
}

const PIPELINE_COLORS: Record<string, string> = {
  'New Lead': '#6b7280',
  'Consultation': '#3b82f6',
  'Quote Sent': '#f59e0b',
  'Design Review': '#8b5cf6',
  'In Production': '#06b6d4',
  'Delivered': '#10b981',
  'Lost': '#ef4444',
};

const SOURCE_COLORS: Record<string, string> = {
  WOOCOMMERCE: '#8b5cf6',
  WHATSAPP: '#22c55e',
  WEBSITE: '#3b82f6',
  CSV_IMPORT: '#f59e0b',
  MANUAL: '#6b7280',
};

const TYPE_ICON: Record<string, React.ElementType> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  CALL: Phone,
  NOTE: Activity,
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(ms / 86400000);
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opportunityCount, setOpportunityCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/crm');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpis = data?.kpis;

  const statCards = kpis ? [
    {
      label: 'Total Contacts',
      value: kpis.totalContacts.toLocaleString(),
      sub: `${kpis.hotLeads} hot leads`,
      icon: Users,
      color: 'text-blue-400',
      bg: 'from-blue-500/20 to-blue-600/5',
      border: 'border-blue-500/20',
    },
    {
      label: 'Active Pipeline',
      value: kpis.activeDeals,
      sub: `JMD ${(kpis.pipelineValue / 1000).toFixed(0)}K value`,
      icon: TrendingUp,
      color: 'text-amber-400',
      bg: 'from-amber-500/20 to-amber-600/5',
      border: 'border-amber-500/20',
    },
    {
      label: 'Revenue (JMD)',
      value: `${(kpis.totalRevenue / 1_000_000).toFixed(1)}M`,
      sub: `${kpis.dealsWon} deals closed`,
      icon: DollarSign,
      color: 'text-green-400',
      bg: 'from-green-500/20 to-green-600/5',
      border: 'border-green-500/20',
    },
    {
      label: 'Overdue Invoices',
      value: kpis.overdueInvoices,
      sub: kpis.overdueInvoices > 0 ? `JMD ${(kpis.overdueInvoiceValue / 1000).toFixed(0)}K outstanding` : 'All invoices current',
      icon: Receipt,
      color: kpis.overdueInvoices > 0 ? 'text-red-400' : 'text-gray-400',
      bg: kpis.overdueInvoices > 0 ? 'from-red-500/20 to-red-600/5' : 'from-gray-500/10 to-gray-600/5',
      border: kpis.overdueInvoices > 0 ? 'border-red-500/20' : 'border-gray-700',
    },
  ] : [];

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            {new Date().toLocaleDateString('en-JM', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">Failed to load dashboard: {error}</p>
        </div>
      )}

      {/* Action Items */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Action Items
            {opportunityCount > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {opportunityCount}
              </span>
            )}
          </h2>
        </div>
        <div className="p-4">
          <ActionList onCountChange={setOpportunityCount} compact />
        </div>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <div key={s.label} className={`bg-gradient-to-br ${s.bg} border ${s.border} rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-gray-800/80 rounded-xl flex items-center justify-center">
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <ArrowUpRight className={`w-4 h-4 ${s.color} opacity-60`} />
              </div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
              <p className="text-xs text-gray-600 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Interaction type pills */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Emails (30d)', value: data.interactionsByType.EMAIL, icon: Mail, color: 'text-blue-400' },
            { label: 'WhatsApp (30d)', value: data.interactionsByType.WHATSAPP, icon: MessageCircle, color: 'text-green-400' },
            { label: 'Calls (30d)', value: data.interactionsByType.CALL, icon: Phone, color: 'text-amber-400' },
            { label: 'Unread Emails', value: kpis?.unreadEmails || 0, icon: Mail, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-2`} />
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Call Volume */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Call Volume (14 days)</h2>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Total</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Outbound</span>
            </div>
          </div>
          {loading ? (
            <div className="h-52 bg-gray-800/30 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.callVolume || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="day" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.8} />
                <Bar dataKey="outbound" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pipeline Breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Pipeline</h2>
          {loading ? (
            <div className="h-52 bg-gray-800/30 rounded-xl animate-pulse" />
          ) : data?.pipeline?.length ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={data.pipeline} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="count">
                    {data.pipeline.map((entry) => (
                      <Cell key={entry.stage} fill={PIPELINE_COLORS[entry.stage] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {data.pipeline.map(s => (
                  <div key={s.stage} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIPELINE_COLORS[s.stage] || '#6b7280' }} />
                      <span className="text-gray-400">{s.stage}</span>
                    </div>
                    <span className="text-white font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-600 text-sm">No pipeline data</div>
          )}
        </div>
      </div>

      {/* Revenue trend + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Monthly Revenue */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" /> Monthly Revenue (6 months)
          </h2>
          {loading ? (
            <div className="h-44 bg-gray-800/30 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data?.monthlyRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(v: any) => [`JMD ${Number(v).toLocaleString()}`, 'Revenue']}
                />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-gray-800">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" /> Recent Activity
            </h2>
          </div>
          <div className="divide-y divide-gray-800/50 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 bg-gray-800/40 rounded mb-2 animate-pulse" />
                ))}
              </div>
            ) : !data?.recentActivity?.length ? (
              <div className="p-8 text-center text-gray-600 text-sm">No recent activity</div>
            ) : data.recentActivity.map((a, i) => {
              const Icon = TYPE_ICON[a.type] || Activity;
              const typeColor = a.type === 'EMAIL' ? 'text-blue-400' : a.type === 'WHATSAPP' ? 'text-green-400' : a.type === 'CALL' ? 'text-amber-400' : 'text-gray-400';
              return (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${typeColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 truncate">
                      {a.contactName && <span className="text-white font-medium">{a.contactName} · </span>}
                      {a.subject || a.content || a.type}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{timeAgo(a.timestamp)}</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                    a.direction === 'INBOUND' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {a.direction?.toLowerCase() || a.type?.toLowerCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contacts by source */}
      {data?.contactsBySource?.length ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" /> Contacts by Source
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.contactsBySource.sort((a, b) => b.count - a.count).map(s => (
              <div key={s.source} className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-white">{s.count}</p>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">{s.source.replace('_', ' ').toLowerCase()}</p>
                <div className="w-full h-1 rounded-full mt-2" style={{ backgroundColor: SOURCE_COLORS[s.source] || '#6b7280', opacity: 0.6 }} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

    </div>
  );
};

export default Dashboard;
