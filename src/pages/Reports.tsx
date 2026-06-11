import React, { useState, useEffect, useCallback } from 'react';
import { Download, TrendingUp, Phone, DollarSign, Target, Mail, MessageCircle, RefreshCw, AlertTriangle, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface DashboardData {
  kpis: {
    totalContacts: number;
    totalInteractions: number;
    activeDeals: number;
    pipelineValue: number;
    totalRevenue: number;
    overdueInvoices: number;
    hotLeads: number;
    unreadEmails: number;
    dealsWon: number;
  };
  pipeline: { stage: string; count: number; value: number }[];
  contactsBySource: { source: string; count: number }[];
  callVolume: { day: string; date: string; total: number; inbound: number; outbound: number }[];
  interactionsByType: { EMAIL: number; WHATSAPP: number; CALL: number; NOTE: number };
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

const Reports: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const exportCSV = () => {
    if (!data) return;
    const headers = ['Stage', 'Count', 'Value (JMD)'];
    const rows = (data.pipeline || []).map(s => [s.stage, s.count, s.value]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dhd-sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const kpis = data?.kpis;

  const channelData = data ? [
    { name: 'Email', value: data.interactionsByType.EMAIL, color: '#3b82f6' },
    { name: 'WhatsApp', value: data.interactionsByType.WHATSAPP, color: '#22c55e' },
    { name: 'Calls', value: data.interactionsByType.CALL, color: '#f59e0b' },
    { name: 'Notes', value: data.interactionsByType.NOTE, color: '#8b5cf6' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Reports</h1>
          <p className="text-gray-400 text-sm mt-1">Live analytics from Supabase</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={!data}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">Failed to load: {error}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Contacts', value: kpis?.totalContacts ?? '—', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Deals Won', value: kpis?.dealsWon ?? '—', icon: Target, color: 'text-green-400', bg: 'bg-green-500/10' },
          {
            label: 'Revenue (JMD)',
            value: kpis ? `${(kpis.totalRevenue / 1000).toFixed(0)}K` : '—',
            icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10'
          },
          { label: 'Interactions (30d)', value: kpis?.totalInteractions ?? '—', icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            {loading ? (
              <div className="h-8 bg-gray-800/40 rounded animate-pulse mb-1" />
            ) : (
              <p className="text-2xl font-bold text-white">{s.value}</p>
            )}
            <p className="text-sm text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Channel breakdown + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Channel mix */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Channel Mix (30 days)</h2>
          {loading ? (
            <div className="h-44 bg-gray-800/30 rounded-xl animate-pulse" />
          ) : channelData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={channelData} cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={3} dataKey="value">
                    {channelData.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-1">
                {channelData.map(c => (
                  <div key={c.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="text-sm text-gray-400">{c.name}</span>
                    </div>
                    <span className="text-sm font-bold text-white">{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-44 text-gray-600 text-sm">No interaction data yet</div>
          )}
        </div>

        {/* Pipeline value by stage */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Pipeline by Stage</h2>
          {loading ? (
            <div className="h-44 bg-gray-800/30 rounded-xl animate-pulse" />
          ) : (data?.pipeline?.length ?? 0) > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data!.pipeline} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 10 }}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="stage" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 10 }} width={90} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(v: any) => [`JMD ${Number(v).toLocaleString()}`, 'Value']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {(data?.pipeline || []).map(entry => (
                    <Cell key={entry.stage} fill={PIPELINE_COLORS[entry.stage] || '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-44 text-gray-600 text-sm">No pipeline data</div>
          )}
        </div>
      </div>

      {/* Monthly Revenue */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4">Monthly Revenue Trend (JMD)</h2>
        {loading ? (
          <div className="h-52 bg-gray-800/30 rounded-xl animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.monthlyRevenue || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }}
                tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                formatter={(v: any) => [`JMD ${Number(v).toLocaleString()}`, 'Revenue']}
              />
              <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Call Volume */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Call Volume (14 days)</h2>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Total</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Outbound</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Inbound</span>
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
              <Bar dataKey="inbound" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pipeline table */}
      {(data?.pipeline?.length ?? 0) > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-gray-800">
            <h2 className="font-semibold text-white">Pipeline Detail</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  {['Stage', 'Deals', 'Total Value (JMD)', '% of Pipeline'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data!.pipeline.map(s => {
                  const totalPipelineValue = data!.pipeline.reduce((acc, p) => acc + p.value, 0);
                  const pct = totalPipelineValue > 0 ? Math.round((s.value / totalPipelineValue) * 100) : 0;
                  return (
                    <tr key={s.stage} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIPELINE_COLORS[s.stage] || '#6b7280' }} />
                          <span className="text-sm font-medium text-white">{s.stage}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">{s.count}</td>
                      <td className="px-4 py-3 text-sm font-bold text-white">JMD {s.value.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PIPELINE_COLORS[s.stage] || '#6b7280' }} />
                          </div>
                          <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default Reports;
